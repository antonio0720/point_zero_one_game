/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RESPONSE RANKING MODEL
 * FILE: backend/src/game/engine/chat/dl/ResponseRankingModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Backend-authoritative ranking layer for candidate helper, hater, ambient,
 * deal-room, system, and scene-sequenced replies.
 *
 * Backend-truth question
 * ----------------------
 *   "Given accepted transcript truth, encoded multi-turn intent, semantic
 *    embedding context, room/channel law, social pressure, and optional memory
 *    anchors, which candidate response best fits the current scene — and why?"
 *
 * Doctrine
 * --------
 * - This file does not create transcript truth.
 * - This file does not bypass moderation, channel policy, or orchestration.
 * - This file does not replace helper / hater planners.
 * - This file does rank already-lawful candidate lines and scene actions so the
 *   rest of backend chat can stay coherent, memorable, and pressure-aware.
 *
 * Why this file exists
 * --------------------
 * Point Zero One chat is not a flat chatbot surface. The same player turn may
 * need one of several valid answers:
 * - a helper recovery line,
 * - a hater puncture,
 * - a private negotiation feint,
 * - a public witness reaction,
 * - a system proof note,
 * - a deliberately withheld answer,
 * - or a short directed multi-message scene.
 *
 * The correct answer depends on more than keywords. It depends on:
 * - encoded intent over multiple turns,
 * - semantic fit to recent transcript windows,
 * - pressure / shield / sovereignty posture,
 * - whether public witnesses add value,
 * - whether silence is better than speech,
 * - whether the current channel is correct,
 * - whether helper rescue should preempt hater aggression,
 * - whether memory callbacks should be invoked,
 * - whether repetition would flatten the scene,
 * - and whether the candidate feels authored rather than synthetic.
 *
 * This file therefore turns many advisory inputs into one ranked,
 * proof-friendly, replay-friendly recommendation surface.
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
  type EmbeddingMessageInput,
  type EmbeddingSceneContext,
  type EmbeddingSemanticFamily,
  type EmbeddingVector,
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
} from './MessageEmbeddingClient';
import {
  CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
  type DialogueIntentKind,
  type DialogueRiskBand,
  type DialogueSocialPosture,
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
} from './DialogueIntentEncoder';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_RESPONSE_RANKING_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_RESPONSE_RANKING_MODEL' as const;

export const CHAT_RESPONSE_RANKING_MODEL_VERSION =
  '2026.03.14-response-ranking-model.v1' as const;

export const CHAT_RESPONSE_RANKING_RUNTIME_LAWS = Object.freeze([
  'Never emit transcript truth directly.',
  'Rank only already-legal candidate actions.',
  'Respect channel / mode / room semantics.',
  'Treat silence as an explicit candidate when the scene needs hold value.',
  'Prefer authored continuity over generic relevance.',
  'Prefer recovery over spectacle when churn and toxicity are both elevated.',
  'Prefer witness value when theatrical channels amplify meaning.',
  'Prefer privacy when embarrassment is high and public escalation is harmful.',
  'Treat repetition as a first-class penalty.',
  'Keep explanation surfaces rich enough for replay and proof.',
] as const);

export const CHAT_RESPONSE_RANKING_DEFAULTS = Object.freeze({
  candidateCutoff: 24,
  semanticWindowDepth: 12,
  maxSceneCallbacks: 4,
  repetitionPenaltyCeiling: 0.42,
  noveltyBias: 0.16,
  cinematicBias: 0.12,
  memoryBias: 0.18,
  silenceCandidateFloor: 0.34,
  hardSuppressionPenalty: 0.75,
  moderationPenalty: 0.55,
  helperRecoveryBias: 0.22,
  haterAttackBias: 0.18,
  negotiationBias: 0.15,
  publicWitnessBias: 0.14,
  privateRescueBias: 0.17,
} as const);

// ============================================================================
// MARK: Public types
// ============================================================================

export type ResponseCandidateSourceKind =
  | 'helper'
  | 'hater'
  | 'ambient'
  | 'system'
  | 'deal_room'
  | 'scene'
  | 'silence';

export type ResponseCandidateActionKind =
  | 'message'
  | 'scene'
  | 'hold'
  | 'redirect'
  | 'shadow'
  | 'moderation_handoff'
  | 'recovery';

export type ResponseCandidateIntentFamily =
  | 'rescue'
  | 'teaching'
  | 'taunt'
  | 'pressure'
  | 'negotiation'
  | 'witness'
  | 'reward'
  | 'threat'
  | 'proof'
  | 'silence';

export interface ResponseRankingDependencyBundle {
  embeddingClient?: Nullable<MessageEmbeddingClient>;
  intentEncoder?: Nullable<DialogueIntentEncoder>;
  now?: Nullable<() => UnixMs>;
}

export interface ResponseRankingContext {
  roomId: ChatRoomId;
  roomKind: ChatRoomKind;
  sessionId: Nullable<ChatSessionId>;
  actorUserId: Nullable<ChatUserId>;
  targetUserId: Nullable<ChatUserId>;
  activeChannel: ChatVisibleChannel;
  pressureTier: Nullable<PressureTier>;
  activeModeId: Nullable<string>;
  sovereigntyProximity: Score01;
  shieldIntegrity: Score01;
  publicWitnessHeat: Score01;
  helperUrgency: Score01;
  helperFatigue: Score01;
  haterPressure: Score01;
  toxicityRisk: Score01;
  churnRisk: Score01;
  recoveryPotential: Score01;
  currentSignals: readonly ChatSignalEnvelope[];
  transcriptWindow: readonly ResponseTranscriptTurn[];
  transcriptAnchorMessageIds?: readonly ChatMessageId[];
  sceneContext?: Nullable<EmbeddingSceneContext>;
  optionalSceneNotes?: Nullable<string[]>;
  nowMs?: Nullable<UnixMs>;
}

export interface ResponseTranscriptTurn {
  messageId: Nullable<ChatMessageId>;
  authoredBy: ResponseCandidateSourceKind | 'player';
  userId: Nullable<ChatUserId>;
  body: string;
  channel: ChatVisibleChannel;
  roomKind: ChatRoomKind;
  pressureTier: Nullable<PressureTier>;
  sequenceIndex: number;
  createdAt: UnixMs;
  semanticFamilies?: readonly EmbeddingSemanticFamily[];
}

export interface ResponseRankingCandidateInput {
  candidateId: string;
  sourceKind: ResponseCandidateSourceKind;
  actionKind: ResponseCandidateActionKind;
  intentFamily: ResponseCandidateIntentFamily;
  body: string;
  channelPreference: ChatVisibleChannel | 'same' | 'shadow';
  personaId?: Nullable<string>;
  sceneId?: Nullable<string>;
  callbackAnchorIds?: readonly string[];
  callbackQuoteIds?: readonly string[];
  semanticFamilies?: readonly EmbeddingSemanticFamily[];
  riskBand?: Nullable<DialogueRiskBand>;
  socialPosture?: Nullable<DialogueSocialPosture>;
  latencyClass?: 'instant' | 'short_delay' | 'dramatic_delay' | 'hold';
  moderationSensitivity?: Score01;
  recoveryValue?: Score01;
  aggressionValue?: Score01;
  teachingValue?: Score01;
  witnessValue?: Score01;
  negotiationValue?: Score01;
  silenceCompatibility?: Score01;
  repetitionKey?: Nullable<string>;
  dimensionBias?: Partial<Record<
    | 'intentAlignment'
    | 'embeddingResonance'
    | 'channelFitness'
    | 'pressureFitness'
    | 'witnessValue'
    | 'continuityValue'
    | 'noveltyValue'
    | 'latencyFitness'
    | 'recoveryFitness'
    | 'aggressionFitness'
    | 'teachingFitness'
    | 'negotiationFitness'
    | 'memoryFitness'
    | 'cinematicFitness',
    Score01
  >>;
  metadata?: Record<string, JsonValue>;
}

export interface RankedResponseCandidate extends ResponseRankingCandidateInput {
  dimensionBias: Partial<Record<
    | 'intentAlignment'
    | 'embeddingResonance'
    | 'channelFitness'
    | 'pressureFitness'
    | 'witnessValue'
    | 'continuityValue'
    | 'noveltyValue'
    | 'latencyFitness'
    | 'recoveryFitness'
    | 'aggressionFitness'
    | 'teachingFitness'
    | 'negotiationFitness'
    | 'memoryFitness'
    | 'cinematicFitness',
    Score01
  >>;
}

export interface ResponseRankingDimensionBreakdown {
  intentAlignment: Score01;
  embeddingResonance: Score01;
  channelFitness: Score01;
  pressureFitness: Score01;
  witnessValue: Score01;
  continuityValue: Score01;
  noveltyValue: Score01;
  latencyFitness: Score01;
  recoveryFitness: Score01;
  aggressionFitness: Score01;
  teachingFitness: Score01;
  negotiationFitness: Score01;
  memoryFitness: Score01;
  cinematicFitness: Score01;
  repetitionPenalty: Score01;
  moderationPenalty: Score01;
  suppressionPenalty: Score01;
  silenceBonus: Score01;
  overall: Score01;
}

export interface ResponseRankingExplanation {
  summary: string;
  strongestReasons: string[];
  weakestReasons: string[];
  channelRead: string;
  pressureRead: string;
  memoryRead: string;
  continuityRead: string;
  riskRead: string;
}

export interface ResponseRankingResult {
  modelVersion: string;
  roomId: ChatRoomId;
  activeChannel: ChatVisibleChannel;
  ranked: RankedResponseDecision[];
  top: Nullable<RankedResponseDecision>;
  silenceCandidateIncluded: boolean;
  rankingSummary: string;
  sceneDisposition:
    | 'respond_now'
    | 'delay'
    | 'hold'
    | 'redirect'
    | 'moderation_gate'
    | 'recovery_override';
  computedAt: UnixMs;
}

export interface RankedResponseDecision {
  candidateId: string;
  sourceKind: ResponseCandidateSourceKind;
  actionKind: ResponseCandidateActionKind;
  intentFamily: ResponseCandidateIntentFamily;
  recommendedChannel: ChatVisibleChannel | 'shadow';
  score: Score100;
  normalizedScore: Score01;
  rank: number;
  dimensions: ResponseRankingDimensionBreakdown;
  explanation: ResponseRankingExplanation;
  callbackAnchorIds: string[];
  callbackQuoteIds: string[];
  repetitionKey: Nullable<string>;
  personaId: Nullable<string>;
  sceneId: Nullable<string>;
  body: string;
  metadata: Record<string, JsonValue>;
}

// ============================================================================
// MARK: Internal working surfaces
// ============================================================================

interface ResponseRankingWorkingSurface {
  nowMs: UnixMs;
  volatility: Score01;
  stability: Score01;
  novelty: Score01;
  continuity: Score01;
  repetitionHeat: Score01;
  relationshipContinuity: Score01;
  primaryIntentKind: Nullable<DialogueIntentKind>;
  intentEntropy: Score01;
  publicWitnessNeed: Score01;
  privacyNeed: Score01;
  negotiationNeed: Score01;
  rescueNeed: Score01;
  aggressionWindow: Score01;
  silenceValue: Score01;
  semanticQueryVector: Nullable<EmbeddingVector>;
  transcriptEmbeddingVector: Nullable<EmbeddingVector>;
  recentTurnBodies: string[];
}

interface RankedCandidateScratch {
  candidate: RankedResponseCandidate;
  dimensions: ResponseRankingDimensionBreakdown;
  explanation: ResponseRankingExplanation;
  semanticSimilarity: Score01;
  provisionalScore: Score01;
}

// ============================================================================
// MARK: Ranking model
// ============================================================================

export class ResponseRankingModel {
  private readonly embeddingClient: MessageEmbeddingClient;
  private readonly intentEncoder: DialogueIntentEncoder;
  private readonly now: () => UnixMs;

  constructor(deps: ResponseRankingDependencyBundle = {}) {
    this.embeddingClient =
      deps.embeddingClient ?? createMessageEmbeddingClient();
    this.intentEncoder =
      deps.intentEncoder ?? createDialogueIntentEncoder({
        embeddingClient: this.embeddingClient,
      });
    this.now = deps.now ?? (() => asUnixMs(Date.now()));
  }

  public rankCandidates(
    context: ResponseRankingContext,
    rawCandidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    const nowMs = context.nowMs ?? this.now();
    const candidates = this.normalizeCandidates(rawCandidates);
    const workingSurface = this.buildWorkingSurface(context, candidates, nowMs);

    const scratches = candidates
      .map((candidate) => this.rankOneCandidate(candidate, context, workingSurface))
      .sort((a, b) => b.provisionalScore - a.provisionalScore)
      .slice(0, CHAT_RESPONSE_RANKING_DEFAULTS.candidateCutoff)
      .map((scratch, index) => this.finalizeRankedDecision(scratch, index + 1, context, workingSurface));

    const top = scratches[0] ?? null;
    const sceneDisposition = this.computeSceneDisposition(context, scratches, workingSurface);
    const rankingSummary = this.buildRankingSummary(context, scratches, sceneDisposition, workingSurface);

    return {
      modelVersion: CHAT_RESPONSE_RANKING_MODEL_VERSION,
      roomId: context.roomId,
      activeChannel: context.activeChannel,
      ranked: scratches,
      top,
      silenceCandidateIncluded: scratches.some((item) => item.sourceKind === 'silence'),
      rankingSummary,
      sceneDisposition,
      computedAt: nowMs,
    };
  }

  public rankHelperCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    return this.rankCandidates(
      {
        ...context,
        helperUrgency: clamp01(context.helperUrgency * 1.12 + 0.05),
        haterPressure: clamp01(context.haterPressure * 0.92),
      },
      candidates,
    );
  }

  public rankHaterCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    return this.rankCandidates(
      {
        ...context,
        haterPressure: clamp01(context.haterPressure * 1.14 + 0.04),
        helperUrgency: clamp01(context.helperUrgency * 0.94),
      },
      candidates,
    );
  }

  public rankSceneCandidates(
    context: ResponseRankingContext,
    candidates: readonly ResponseRankingCandidateInput[],
  ): ResponseRankingResult {
    return this.rankCandidates(
      {
        ...context,
        publicWitnessHeat: clamp01(context.publicWitnessHeat * 1.08 + 0.03),
      },
      candidates,
    );
  }

  private normalizeCandidates(
    rawCandidates: readonly ResponseRankingCandidateInput[],
  ): RankedResponseCandidate[] {
    const normalized: RankedResponseCandidate[] = rawCandidates.map((candidate) => ({
      ...candidate,
      channelPreference: candidate.channelPreference ?? 'same',
      latencyClass: candidate.latencyClass ?? 'instant',
      moderationSensitivity: clamp01(candidate.moderationSensitivity ?? 0.25),
      recoveryValue: clamp01(candidate.recoveryValue ?? (candidate.intentFamily === 'rescue' ? 0.72 : 0.22)),
      aggressionValue: clamp01(candidate.aggressionValue ?? (candidate.intentFamily === 'taunt' || candidate.intentFamily === 'pressure' ? 0.72 : 0.16)),
      teachingValue: clamp01(candidate.teachingValue ?? (candidate.intentFamily === 'teaching' ? 0.74 : 0.18)),
      witnessValue: clamp01(candidate.witnessValue ?? (candidate.intentFamily === 'witness' ? 0.78 : 0.28)),
      negotiationValue: clamp01(candidate.negotiationValue ?? (candidate.intentFamily === 'negotiation' ? 0.82 : 0.2)),
      silenceCompatibility: clamp01(candidate.silenceCompatibility ?? (candidate.sourceKind === 'silence' ? 0.9 : 0.22)),
      repetitionKey: candidate.repetitionKey ?? null,
      callbackAnchorIds: [...(candidate.callbackAnchorIds ?? [])],
      callbackQuoteIds: [...(candidate.callbackQuoteIds ?? [])],
      semanticFamilies: [...(candidate.semanticFamilies ?? [])],
      dimensionBias: { ...(candidate.dimensionBias ?? {}) },
      metadata: { ...(candidate.metadata ?? {}) },
    }));

    const hasSilence = normalized.some((candidate) => candidate.sourceKind === 'silence');
    if (!hasSilence) {
      normalized.push(this.buildDefaultSilenceCandidate());
    }
    return normalized;
  }

  private buildDefaultSilenceCandidate(): RankedResponseCandidate {
    return {
      candidateId: 'system::silence::default-hold',
      sourceKind: 'silence',
      actionKind: 'hold',
      intentFamily: 'silence',
      body: '',
      channelPreference: 'same',
      latencyClass: 'hold',
      moderationSensitivity: clamp01(0.02),
      recoveryValue: clamp01(0.3),
      aggressionValue: clamp01(0.02),
      teachingValue: clamp01(0.08),
      witnessValue: clamp01(0.18),
      negotiationValue: clamp01(0.22),
      silenceCompatibility: clamp01(0.94),
      callbackAnchorIds: [],
      callbackQuoteIds: [],
      semanticFamilies: [],
      repetitionKey: 'system::silence::default-hold',
      dimensionBias: {} as never,
      metadata: { generated: true },
    };
  }

  private buildWorkingSurface(
    context: ResponseRankingContext,
    candidates: readonly RankedResponseCandidate[],
    nowMs: UnixMs,
  ): ResponseRankingWorkingSurface {
    const transcriptBodies = context.transcriptWindow.map((turn) => turn.body).filter(Boolean);
    const recentTurnBodies = transcriptBodies.slice(-CHAT_RESPONSE_RANKING_DEFAULTS.semanticWindowDepth);
    const transcriptEmbedding = recentTurnBodies.length
      ? this.embeddingClient.embedTranscriptWindow({
          messages: recentTurnBodies.map((body, turnIndex) => ({
            messageId: (`window::${turnIndex}` as ChatMessageId),
            text: body,
            channel: context.activeChannel,
            createdAtMs: asUnixMs(nowMs - (recentTurnBodies.length - turnIndex) * 1000),
          })),
          sceneContext: context.sceneContext ?? this.buildSceneContext(context),
        })
      : null;

    const encodedIntent = this.intentEncoder.encodeSequence({
      turns: context.transcriptWindow.map((turn) => ({
        messageId: turn.messageId ?? (`turn::${turn.sequenceIndex}` as ChatMessageId),
        text: turn.body,
        channel: turn.channel,
        createdAtMs: turn.createdAt,
      })),
      sceneContext: context.sceneContext ?? this.buildSceneContext(context),
    });

    const semanticQueryVector = transcriptEmbedding ?? null;
    const volatility = clamp01(context.toxicityRisk * 0.44 + context.haterPressure * 0.24 + context.churnRisk * 0.18 + (1 - context.shieldIntegrity) * 0.14);
    const stability = clamp01(1 - volatility * 0.66 + context.recoveryPotential * 0.22 + (1 - context.toxicityRisk) * 0.12);
    const novelty = clamp01(
      0.25 +
      this.computeTranscriptNovelty(recentTurnBodies, candidates) * 0.75
    );
    const continuity = clamp01(
      0.28 +
      this.computeTranscriptContinuity(context.transcriptWindow) * 0.72
    );
    const repetitionHeat = clamp01(
      1 - novelty * 0.62 + this.computeRepetitionHeat(candidates) * 0.38
    );
    const relationshipContinuity = clamp01(
      this.computeRelationshipContinuity(context.transcriptWindow) * 0.72 +
      continuity * 0.28
    );
    const publicWitnessNeed = clamp01(context.publicWitnessHeat * 0.58 + context.haterPressure * 0.16 + context.sovereigntyProximity * 0.12 + (1 - context.shieldIntegrity) * 0.14);
    const privacyNeed = clamp01(context.churnRisk * 0.28 + context.toxicityRisk * 0.32 + context.helperUrgency * 0.16 + (1 - context.shieldIntegrity) * 0.08 + (1 - context.publicWitnessHeat) * 0.16);
    const negotiationNeed = clamp01((context.activeChannel === 'DEAL_ROOM' ? 0.78 : 0.18) + context.recoveryPotential * 0.05);
    const rescueNeed = clamp01(context.helperUrgency * 0.45 + context.churnRisk * 0.3 + context.toxicityRisk * 0.1 + (1 - context.shieldIntegrity) * 0.15);
    const aggressionWindow = clamp01(context.haterPressure * 0.46 + context.publicWitnessHeat * 0.18 + (1 - context.shieldIntegrity) * 0.14 + context.sovereigntyProximity * 0.1 + (1 - context.helperUrgency) * 0.12);
    const silenceValue = clamp01(
      0.2 +
      (context.toxicityRisk * 0.18) +
      (context.churnRisk * 0.14) +
      (negotiationNeed * 0.16) +
      ((1 - context.publicWitnessHeat) * 0.08) +
      (stability * 0.08)
    );

    return {
      nowMs,
      volatility,
      stability,
      novelty,
      continuity,
      repetitionHeat,
      relationshipContinuity,
      primaryIntentKind: encodedIntent.dominantSequenceIntent ?? null,
      intentEntropy: clamp01(0.5),
      publicWitnessNeed,
      privacyNeed,
      negotiationNeed,
      rescueNeed,
      aggressionWindow,
      silenceValue,
      semanticQueryVector,
      transcriptEmbeddingVector: transcriptEmbedding ?? null,
      recentTurnBodies,
    };
  }

  private buildSceneContext(context: ResponseRankingContext): EmbeddingSceneContext {
    return {
      roomId: context.roomId,
      roomKind: context.roomKind,
      channel: context.activeChannel,
      pressureTier: context.pressureTier ?? null,
      activeModeId: context.activeModeId ?? null,
      sovereigntyProximity: context.sovereigntyProximity,
      publicWitnessHeat: context.publicWitnessHeat,
      helperUrgency: context.helperUrgency,
      haterPressure: context.haterPressure,
      toxicityRisk: context.toxicityRisk,
      churnRisk: context.churnRisk,
      notes: [...(context.optionalSceneNotes ?? [])],
    } as EmbeddingSceneContext;
  }

  private rankOneCandidate(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): RankedCandidateScratch {
    const dimensions: ResponseRankingDimensionBreakdown = {
      intentAlignment: this.scoreIntentAlignment(candidate, context, surface),
      embeddingResonance: this.scoreEmbeddingResonance(candidate, context, surface),
      channelFitness: this.scoreChannelFitness(candidate, context, surface),
      pressureFitness: this.scorePressureFitness(candidate, context, surface),
      witnessValue: this.scoreWitnessValue(candidate, context, surface),
      continuityValue: this.scoreContinuityValue(candidate, context, surface),
      noveltyValue: this.scoreNoveltyValue(candidate, context, surface),
      latencyFitness: this.scoreLatencyFitness(candidate, context, surface),
      recoveryFitness: this.scoreRecoveryFitness(candidate, context, surface),
      aggressionFitness: this.scoreAggressionFitness(candidate, context, surface),
      teachingFitness: this.scoreTeachingFitness(candidate, context, surface),
      negotiationFitness: this.scoreNegotiationFitness(candidate, context, surface),
      memoryFitness: this.scoreMemoryFitness(candidate, context, surface),
      cinematicFitness: this.scoreCinematicFitness(candidate, context, surface),
      repetitionPenalty: this.computeRepetitionPenalty(candidate, context, surface),
      moderationPenalty: this.computeModerationPenalty(candidate, context, surface),
      suppressionPenalty: this.computeSuppressionPenalty(candidate, context, surface),
      silenceBonus: this.computeSilenceBonus(candidate, context, surface),
      overall: clamp01(0),
    };

    const semanticSimilarity = this.computeSemanticSimilarity(candidate, context, surface);
    const provisionalScore = this.composeOverallScore(candidate, dimensions, semanticSimilarity, context, surface);
    dimensions.overall = provisionalScore;

    const explanation = this.buildExplanation(candidate, dimensions, context, surface);

    return {
      candidate,
      dimensions,
      explanation,
      semanticSimilarity,
      provisionalScore,
    };
  }


  /**
   * IntentAlignment
   * --------------------------------------------------------------------------
   * Measures how strongly a candidate matches the encoded multi-turn intent package.
   */
  private scoreIntentAlignment(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'intentAlignment');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'intentAlignment');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'intentAlignment');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'intentAlignment');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['intentAlignment'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['intentAlignment']! * 0.18)
      : result;
  }

  /**
   * EmbeddingResonance
   * --------------------------------------------------------------------------
   * Measures semantic closeness between the candidate and the active transcript window.
   */
  private scoreEmbeddingResonance(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'embeddingResonance');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'embeddingResonance');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'embeddingResonance');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'embeddingResonance');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['embeddingResonance'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['embeddingResonance']! * 0.18)
      : result;
  }

  /**
   * ChannelFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate belongs in the current visible channel and room posture.
   */
  private scoreChannelFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'channelFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'channelFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'channelFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'channelFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['channelFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['channelFitness']! * 0.18)
      : result;
  }

  /**
   * PressureFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate fits the active pressure / shield / sovereignty regime.
   */
  private scorePressureFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'pressureFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'pressureFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'pressureFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'pressureFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['pressureFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['pressureFitness']! * 0.18)
      : result;
  }

  /**
   * WitnessValue
   * --------------------------------------------------------------------------
   * Measures whether the scene benefits from public witnesses rather than privacy or silence.
   */
  private scoreWitnessValue(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'witnessValue');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'witnessValue');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'witnessValue');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'witnessValue');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['witnessValue'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['witnessValue']! * 0.18)
      : result;
  }

  /**
   * ContinuityValue
   * --------------------------------------------------------------------------
   * Measures continuity with recent dialogue rhythm, persona, and scene-state.
   */
  private scoreContinuityValue(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'continuityValue');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'continuityValue');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'continuityValue');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'continuityValue');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['continuityValue'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['continuityValue']! * 0.18)
      : result;
  }

  /**
   * NoveltyValue
   * --------------------------------------------------------------------------
   * Rewards freshness and punishes stale restatements of the same tactical line.
   */
  private scoreNoveltyValue(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'noveltyValue');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'noveltyValue');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'noveltyValue');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'noveltyValue');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['noveltyValue'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['noveltyValue']! * 0.18)
      : result;
  }

  /**
   * LatencyFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate timing feels immediate, delayed, or intentionally withheld.
   */
  private scoreLatencyFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'latencyFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'latencyFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'latencyFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'latencyFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['latencyFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['latencyFitness']! * 0.18)
      : result;
  }

  /**
   * RecoveryFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate helps stabilization when the scene is fracture-prone.
   */
  private scoreRecoveryFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'recoveryFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'recoveryFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'recoveryFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'recoveryFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['recoveryFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['recoveryFitness']! * 0.18)
      : result;
  }

  /**
   * AggressionFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate’s hostility level fits the current target window.
   */
  private scoreAggressionFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'aggressionFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'aggressionFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'aggressionFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'aggressionFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['aggressionFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['aggressionFitness']! * 0.18)
      : result;
  }

  /**
   * TeachingFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate is useful as a helper teaching line rather than pure comfort.
   */
  private scoreTeachingFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'teachingFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'teachingFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'teachingFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'teachingFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['teachingFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['teachingFitness']! * 0.18)
      : result;
  }

  /**
   * NegotiationFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate fits a deal-room or bluff-reveal posture.
   */
  private scoreNegotiationFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'negotiationFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'negotiationFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'negotiationFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'negotiationFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['negotiationFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['negotiationFitness']! * 0.18)
      : result;
  }

  /**
   * MemoryFitness
   * --------------------------------------------------------------------------
   * Measures whether memory callbacks amplify the candidate rather than making it feel synthetic.
   */
  private scoreMemoryFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'memoryFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'memoryFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'memoryFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'memoryFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['memoryFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['memoryFitness']! * 0.18)
      : result;
  }

  /**
   * CinematicFitness
   * --------------------------------------------------------------------------
   * Measures whether the candidate fits a directed scene instead of flattening the moment.
   */
  private scoreCinematicFitness(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const modeWeight = this.lookupModeWeight(context.activeModeId, 'cinematicFitness');
    const roomWeight = this.lookupRoomWeight(context.roomKind, 'cinematicFitness');
    const channelWeight = this.lookupChannelWeight(candidate.channelPreference, context.activeChannel, 'cinematicFitness');
    const intentWeight = this.lookupIntentWeight(candidate.intentFamily, surface.primaryIntentKind, 'cinematicFitness');
    const volatilityPenalty = clamp01(1 - surface.volatility * 0.35);
    const stabilityBoost = clamp01(0.2 + surface.stability * 0.8);
    const continuityBoost = clamp01(0.2 + surface.continuity * 0.8);
    const noveltyBoost = clamp01(0.2 + surface.novelty * 0.8);
    const relationBoost = clamp01(0.2 + surface.relationshipContinuity * 0.8);
    const result = clamp01(
      modeWeight * 0.16 +
      roomWeight * 0.11 +
      channelWeight * 0.12 +
      intentWeight * 0.18 +
      volatilityPenalty * 0.08 +
      stabilityBoost * 0.08 +
      continuityBoost * 0.09 +
      noveltyBoost * 0.08 +
      relationBoost * 0.10
    );
    return candidate.dimensionBias['cinematicFitness'] != null
      ? clamp01(result * 0.82 + candidate.dimensionBias['cinematicFitness']! * 0.18)
      : result;
  }


  private computeSemanticSimilarity(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    if (!candidate.body || !surface.semanticQueryVector) {
      return candidate.sourceKind === 'silence' ? surface.silenceValue : clamp01(0.22);
    }

    const embeddingInput: EmbeddingMessageInput = {
      messageId: (candidate.candidateId as ChatMessageId),
      text: candidate.body,
      channel: this.resolveCandidateChannel(candidate, context) as ChatVisibleChannel,
      createdAtMs: surface.nowMs,
      sceneContext: context.sceneContext ?? this.buildSceneContext(context),
    };

    const embeddedCandidate = this.embeddingClient.embedMessage(embeddingInput);

    const similarity = this.embeddingClient.cosineSimilarity(
      surface.semanticQueryVector,
      embeddedCandidate,
    );

    return clamp01(similarity.clipped01);
  }

  private composeOverallScore(
    candidate: RankedResponseCandidate,
    dimensions: ResponseRankingDimensionBreakdown,
    semanticSimilarity: Score01,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const base =
      dimensions.intentAlignment * 0.12 +
      dimensions.embeddingResonance * 0.1 +
      dimensions.channelFitness * 0.08 +
      dimensions.pressureFitness * 0.08 +
      dimensions.witnessValue * 0.06 +
      dimensions.continuityValue * 0.08 +
      dimensions.noveltyValue * 0.06 +
      dimensions.latencyFitness * 0.05 +
      dimensions.recoveryFitness * 0.08 +
      dimensions.aggressionFitness * 0.08 +
      dimensions.teachingFitness * 0.05 +
      dimensions.negotiationFitness * 0.05 +
      dimensions.memoryFitness * 0.06 +
      dimensions.cinematicFitness * 0.05 +
      semanticSimilarity * 0.1;

    const policyBias = this.computePolicyBias(candidate, context, surface);
    const penalties =
      dimensions.repetitionPenalty * 0.5 +
      dimensions.moderationPenalty * 0.3 +
      dimensions.suppressionPenalty * 0.2;
    const bonuses =
      dimensions.silenceBonus * 0.24 +
      policyBias * 0.18;

    return clamp01(base - penalties + bonuses);
  }

  private computePolicyBias(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    let bias = 0.0;

    if (candidate.intentFamily === 'rescue') {
      bias += context.helperUrgency * CHAT_RESPONSE_RANKING_DEFAULTS.helperRecoveryBias;
    }
    if (candidate.intentFamily === 'taunt' || candidate.intentFamily === 'pressure') {
      bias += context.haterPressure * CHAT_RESPONSE_RANKING_DEFAULTS.haterAttackBias;
    }
    if (candidate.intentFamily === 'negotiation') {
      bias += surface.negotiationNeed * CHAT_RESPONSE_RANKING_DEFAULTS.negotiationBias;
    }
    if (candidate.intentFamily === 'witness' || candidate.sourceKind === 'system') {
      bias += surface.publicWitnessNeed * CHAT_RESPONSE_RANKING_DEFAULTS.publicWitnessBias;
    }
    if (candidate.channelPreference === 'same' && context.activeChannel !== 'GLOBAL') {
      bias += surface.privacyNeed * 0.05;
    }
    if (candidate.channelPreference === 'shadow') {
      bias += surface.privacyNeed * CHAT_RESPONSE_RANKING_DEFAULTS.privateRescueBias;
    }

    return clamp01(bias);
  }

  private computeRepetitionPenalty(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    if (!candidate.repetitionKey) {
      return clamp01(surface.repetitionHeat * 0.18);
    }
    const repeated = context.transcriptWindow.some((turn) => turn.body.includes(candidate.repetitionKey!));
    return repeated
      ? clamp01(CHAT_RESPONSE_RANKING_DEFAULTS.repetitionPenaltyCeiling * 0.72 + surface.repetitionHeat * 0.28)
      : clamp01(surface.repetitionHeat * 0.12);
  }

  private computeModerationPenalty(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const base = candidate.moderationSensitivity ?? 0.25;
    const risk = context.toxicityRisk;
    if (candidate.sourceKind === 'system') {
      return clamp01(base * 0.2);
    }
    if (candidate.intentFamily === 'taunt' || candidate.intentFamily === 'pressure') {
      return clamp01(base * 0.5 + risk * 0.5);
    }
    if (candidate.intentFamily === 'rescue') {
      return clamp01(base * 0.28 + risk * 0.12);
    }
    return clamp01(base * 0.38 + risk * 0.22 + surface.volatility * 0.12);
  }

  private computeSuppressionPenalty(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    if (candidate.sourceKind === 'silence') {
      return clamp01(0);
    }
    const publicMismatch =
      candidate.channelPreference === 'same' &&
      context.activeChannel === 'GLOBAL' &&
      surface.privacyNeed > 0.72
        ? 0.28
        : 0;
    const aggressionSuppression =
      candidate.aggressionValue! * context.helperUrgency * 0.18;
    return clamp01(publicMismatch + aggressionSuppression);
  }

  private computeSilenceBonus(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    if (candidate.sourceKind === 'silence' || candidate.actionKind === 'hold') {
      return clamp01(surface.silenceValue * 0.78 + surface.negotiationNeed * 0.12 + surface.volatility * 0.1);
    }
    return clamp01(candidate.silenceCompatibility! * surface.silenceValue * 0.12);
  }

  private buildExplanation(
    candidate: RankedResponseCandidate,
    dimensions: ResponseRankingDimensionBreakdown,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): ResponseRankingExplanation {
    const strongPairs: Array<[string, number]> = [
      ['intent alignment', dimensions.intentAlignment],
      ['semantic resonance', dimensions.embeddingResonance],
      ['channel fit', dimensions.channelFitness],
      ['pressure fit', dimensions.pressureFitness],
      ['witness value', dimensions.witnessValue],
      ['continuity', dimensions.continuityValue],
      ['novelty', dimensions.noveltyValue],
      ['latency fit', dimensions.latencyFitness],
      ['recovery fit', dimensions.recoveryFitness],
      ['aggression fit', dimensions.aggressionFitness],
      ['teaching fit', dimensions.teachingFitness],
      ['negotiation fit', dimensions.negotiationFitness],
      ['memory fit', dimensions.memoryFitness],
      ['cinematic fit', dimensions.cinematicFitness],
    ];

    const strongestReasons = strongPairs
      .filter(([, score]) => score >= 0.62)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label]) => label);

    const weakestReasons = strongPairs
      .filter(([, score]) => score <= 0.42)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([label]) => label);

    const summary = candidate.sourceKind === 'silence'
      ? `Hold value ranked ${strongestReasons[0] ?? 'competitively'} because the scene benefits from restraint more than immediate speech.`
      : `Candidate leans ${candidate.intentFamily} with ${candidate.sourceKind} posture because ${(strongestReasons[0] ?? 'its scene fit')} and ${(strongestReasons[1] ?? 'its continuity')} currently outrank competing lines.`;

    return {
      summary,
      strongestReasons,
      weakestReasons,
      channelRead: this.describeChannelRead(candidate, context, surface),
      pressureRead: this.describePressureRead(candidate, context, surface),
      memoryRead: this.describeMemoryRead(candidate, dimensions, surface),
      continuityRead: this.describeContinuityRead(candidate, dimensions, surface),
      riskRead: this.describeRiskRead(candidate, dimensions, context, surface),
    };
  }

  private describeChannelRead(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): string {
    if (candidate.channelPreference === 'shadow') {
      return 'Candidate is better kept off visible transcript until privacy / rescue posture resolves.';
    }
    if (candidate.channelPreference === 'same') {
      return `Candidate preserves current ${context.activeChannel} continuity.`;
    }
    return `Candidate prefers ${candidate.channelPreference} because channel-fit and scene semantics outweigh current-lane continuity.`;
  }

  private describePressureRead(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): string {
    if (candidate.intentFamily === 'pressure' || candidate.intentFamily === 'taunt') {
      return 'Aggressive reply aligns with active pressure window and witness appetite.';
    }
    if (candidate.intentFamily === 'rescue') {
      return 'Recovery posture outranks spectacle under current churn / toxicity balance.';
    }
    return 'Pressure does not disqualify the candidate, but it does shape timing and witness value.';
  }

  private describeMemoryRead(
    candidate: RankedResponseCandidate,
    dimensions: ResponseRankingDimensionBreakdown,
    surface: ResponseRankingWorkingSurface,
  ): string {
    if (candidate.callbackAnchorIds.length || candidate.callbackQuoteIds.length) {
      return 'Candidate carries callback potential and benefits from memory-backed continuity.';
    }
    if (dimensions.memoryFitness >= 0.65) {
      return 'Candidate fits remembered scene posture even without explicit callback anchors.';
    }
    return 'Candidate does not rely heavily on memory, which may keep the turn fresher.';
  }

  private describeContinuityRead(
    candidate: RankedResponseCandidate,
    dimensions: ResponseRankingDimensionBreakdown,
    surface: ResponseRankingWorkingSurface,
  ): string {
    if (dimensions.continuityValue >= 0.7) {
      return 'Candidate preserves persona / scene continuity without collapsing into repetition.';
    }
    if (dimensions.noveltyValue >= 0.68) {
      return 'Candidate wins partly because the scene needs a fresh move rather than continuity.';
    }
    return 'Candidate balances continuity and novelty without strongly leaning either direction.';
  }

  private describeRiskRead(
    candidate: RankedResponseCandidate,
    dimensions: ResponseRankingDimensionBreakdown,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): string {
    const penalty = clamp01(
      dimensions.moderationPenalty * 0.5 +
      dimensions.suppressionPenalty * 0.3 +
      dimensions.repetitionPenalty * 0.2
    );
    if (penalty >= 0.55) {
      return 'Candidate remains viable but carries meaningful moderation / suppression / repetition cost.';
    }
    if (candidate.sourceKind === 'silence') {
      return 'Risk is carried by over-speaking, so the model rewards a deliberate hold.';
    }
    return 'Candidate carries manageable risk relative to current scene pressure.';
  }

  private finalizeRankedDecision(
    scratch: RankedCandidateScratch,
    rank: number,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): RankedResponseDecision {
    return {
      candidateId: scratch.candidate.candidateId,
      sourceKind: scratch.candidate.sourceKind,
      actionKind: scratch.candidate.actionKind,
      intentFamily: scratch.candidate.intentFamily,
      recommendedChannel: this.resolveCandidateChannel(scratch.candidate, context),
      score: clamp100(scratch.provisionalScore * 100),
      normalizedScore: scratch.provisionalScore,
      rank,
      dimensions: scratch.dimensions,
      explanation: scratch.explanation,
      callbackAnchorIds: [...scratch.candidate.callbackAnchorIds],
      callbackQuoteIds: [...scratch.candidate.callbackQuoteIds],
      repetitionKey: scratch.candidate.repetitionKey ?? null,
      personaId: scratch.candidate.personaId ?? null,
      sceneId: scratch.candidate.sceneId ?? null,
      body: scratch.candidate.body,
      metadata: {
        semanticSimilarity: scratch.semanticSimilarity,
        modelVersion: CHAT_RESPONSE_RANKING_MODEL_VERSION,
        embeddingVersion: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
        intentEncoderVersion: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
        activeModeId: context.activeModeId ?? null,
        sovereigntyProximity: context.sovereigntyProximity,
        publicWitnessHeat: context.publicWitnessHeat,
        helperUrgency: context.helperUrgency,
        haterPressure: context.haterPressure,
        churnRisk: context.churnRisk,
        toxicityRisk: context.toxicityRisk,
        ...scratch.candidate.metadata,
      },
    };
  }

  private resolveCandidateChannel(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
  ): ChatVisibleChannel | 'shadow' {
    if (candidate.channelPreference === 'shadow') {
      return 'shadow';
    }
    if (candidate.channelPreference === 'same') {
      return context.activeChannel;
    }
    return candidate.channelPreference;
  }

  private computeSceneDisposition(
    context: ResponseRankingContext,
    ranked: readonly RankedResponseDecision[],
    surface: ResponseRankingWorkingSurface,
  ): ResponseRankingResult['sceneDisposition'] {
    const top = ranked[0];
    if (!top) {
      return 'hold';
    }
    if (top.sourceKind === 'silence' && top.normalizedScore >= CHAT_RESPONSE_RANKING_DEFAULTS.silenceCandidateFloor) {
      return 'hold';
    }
    if (context.toxicityRisk >= 0.84 && top.dimensions.moderationPenalty >= 0.52) {
      return 'moderation_gate';
    }
    if (context.churnRisk >= 0.8 && top.intentFamily !== 'rescue' && surface.rescueNeed >= 0.68) {
      return 'recovery_override';
    }
    if (top.recommendedChannel !== context.activeChannel && top.recommendedChannel !== 'shadow') {
      return 'redirect';
    }
    if (top.actionKind === 'hold') {
      return 'delay';
    }
    return 'respond_now';
  }

  private buildRankingSummary(
    context: ResponseRankingContext,
    ranked: readonly RankedResponseDecision[],
    sceneDisposition: ResponseRankingResult['sceneDisposition'],
    surface: ResponseRankingWorkingSurface,
  ): string {
    const top = ranked[0];
    if (!top) {
      return 'No lawful candidates survived ranking; backend should hold scene state.';
    }
    if (sceneDisposition === 'hold') {
      return 'Silence outranked visible speech because hold value, privacy need, and/or negotiation tension currently dominate.';
    }
    return `Top-ranked ${top.sourceKind} / ${top.intentFamily} candidate scored ${top.score.toFixed(1)} and scene disposition resolved to ${sceneDisposition}.`;
  }

  private computeTranscriptNovelty(
    transcriptBodies: readonly string[],
    candidates: readonly RankedResponseCandidate[],
  ): Score01 {
    if (!transcriptBodies.length) {
      return clamp01(0.88);
    }
    const transcriptSet = new Set(transcriptBodies.map((value) => value.toLowerCase().trim()));
    const repeatedCandidates = candidates.filter((candidate) => transcriptSet.has(candidate.body.toLowerCase().trim())).length;
    return clamp01(1 - repeatedCandidates / Math.max(1, candidates.length));
  }

  private computeTranscriptContinuity(
    transcriptWindow: readonly ResponseTranscriptTurn[],
  ): Score01 {
    if (transcriptWindow.length <= 1) {
      return clamp01(0.64);
    }
    let continuityHits = 0;
    for (let windowIndex = 1; windowIndex < transcriptWindow.length; windowIndex += 1) {
      const prior = transcriptWindow[windowIndex - 1];
      const current = transcriptWindow[windowIndex];
      if (prior.channel === current.channel) {
        continuityHits += 0.25;
      }
      if (prior.authoredBy === current.authoredBy) {
        continuityHits += 0.1;
      }
      if (Math.abs(current.createdAt - prior.createdAt) <= 10_000) {
        continuityHits += 0.15;
      }
    }
    return clamp01(continuityHits / Math.max(1, transcriptWindow.length - 1));
  }

  private computeRepetitionHeat(
    candidates: readonly RankedResponseCandidate[],
  ): Score01 {
    const seen = new Set<string>();
    let collisions = 0;
    for (const candidate of candidates) {
      const key = candidate.repetitionKey ?? candidate.body;
      if (seen.has(key)) {
        collisions += 1;
      } else {
        seen.add(key);
      }
    }
    return clamp01(collisions / Math.max(1, candidates.length));
  }

  private computeRelationshipContinuity(
    transcriptWindow: readonly ResponseTranscriptTurn[],
  ): Score01 {
    if (!transcriptWindow.length) {
      return clamp01(0.42);
    }
    const authorCounts = new Map<string, number>();
    for (const turn of transcriptWindow) {
      const key = `${turn.authoredBy}::${turn.userId ?? 'none'}`;
      authorCounts.set(key, (authorCounts.get(key) ?? 0) + 1);
    }
    const max = Math.max(...authorCounts.values());
    return clamp01(max / transcriptWindow.length);
  }

  private lookupModeWeight(
    modeId: Nullable<string>,
    dimensionKey: string,
  ): Score01 {
    if (!modeId) {
      return clamp01(0.5);
    }
    const normalized = modeId.toLowerCase();
    if (normalized.includes('battle')) {
      return dimensionKey.includes('Aggression') || dimensionKey.includes('Pressure')
        ? clamp01(0.86)
        : clamp01(0.58);
    }
    if (normalized.includes('lobby')) {
      return dimensionKey.includes('Witness') || dimensionKey.includes('Continuity')
        ? clamp01(0.78)
        : clamp01(0.56);
    }
    if (normalized.includes('syndicate')) {
      return dimensionKey.includes('Memory') || dimensionKey.includes('Negotiation')
        ? clamp01(0.8)
        : clamp01(0.57);
    }
    if (normalized.includes('deal')) {
      return dimensionKey.includes('Negotiation') || dimensionKey.includes('Silence')
        ? clamp01(0.84)
        : clamp01(0.54);
    }
    return clamp01(0.6);
  }

  private lookupRoomWeight(
    roomKind: ChatRoomKind,
    dimensionKey: string,
  ): Score01 {
    switch (roomKind) {
      case 'GLOBAL':
        return dimensionKey === 'witnessValue' || dimensionKey === 'cinematicFitness'
          ? clamp01(0.85)
          : clamp01(0.58);
      case 'SYNDICATE':
        return dimensionKey === 'memoryFitness' || dimensionKey === 'continuityValue'
          ? clamp01(0.82)
          : clamp01(0.6);
      case 'DEAL_ROOM':
        return dimensionKey === 'negotiationFitness' || dimensionKey === 'latencyFitness'
          ? clamp01(0.88)
          : clamp01(0.55);
      case 'LOBBY':
        return dimensionKey === 'teachingFitness' || dimensionKey === 'witnessValue'
          ? clamp01(0.72)
          : clamp01(0.57);
      default:
        return clamp01(0.58);
    }
  }

  private lookupChannelWeight(
    preference: RankedResponseCandidate['channelPreference'],
    activeChannel: ChatVisibleChannel,
    dimensionKey: string,
  ): Score01 {
    if (preference === 'same') {
      return dimensionKey === 'continuityValue' ? clamp01(0.82) : clamp01(0.72);
    }
    if (preference === 'shadow') {
      return dimensionKey === 'memoryFitness' || dimensionKey === 'recoveryFitness'
        ? clamp01(0.78)
        : clamp01(0.5);
    }
    if (preference === activeChannel) {
      return clamp01(0.78);
    }
    if (preference === 'GLOBAL') {
      return dimensionKey === 'witnessValue' ? clamp01(0.86) : clamp01(0.58);
    }
    if (preference === 'DEAL_ROOM') {
      return dimensionKey === 'negotiationFitness' ? clamp01(0.88) : clamp01(0.54);
    }
    if (preference === 'SYNDICATE') {
      return dimensionKey === 'memoryFitness' ? clamp01(0.8) : clamp01(0.58);
    }
    return clamp01(0.56);
  }

  private lookupIntentWeight(
    intentFamily: ResponseCandidateIntentFamily,
    primaryIntentKind: Nullable<DialogueIntentKind>,
    dimensionKey: string,
  ): Score01 {
    if (!primaryIntentKind) {
      return clamp01(0.55);
    }
    const family = intentFamily.toLowerCase();
    const primary = primaryIntentKind.toLowerCase();
    if (family.includes(primary) || primary.includes(family)) {
      return clamp01(0.9);
    }
    if ((family === 'rescue' || family === 'teaching') && primary.includes('help')) {
      return clamp01(0.84);
    }
    if ((family === 'taunt' || family === 'pressure') && (primary.includes('taunt') || primary.includes('threat'))) {
      return clamp01(0.85);
    }
    if (family === 'negotiation' && (primary.includes('bluff') || primary.includes('offer'))) {
      return clamp01(0.87);
    }
    if (family === 'silence' && primary.includes('hesitation')) {
      return clamp01(0.76);
    }
    return clamp01(0.52);
  }
}

// ============================================================================
// MARK: Factory helpers
// ============================================================================

export function createResponseRankingModel(
  deps: ResponseRankingDependencyBundle = {},
): ResponseRankingModel {
  return new ResponseRankingModel(deps);
}

export function rankBackendChatResponseCandidates(
  context: ResponseRankingContext,
  candidates: readonly ResponseRankingCandidateInput[],
  deps: ResponseRankingDependencyBundle = {},
): ResponseRankingResult {
  return createResponseRankingModel(deps).rankCandidates(context, candidates);
}

export function rankBackendChatHelperCandidates(
  context: ResponseRankingContext,
  candidates: readonly ResponseRankingCandidateInput[],
  deps: ResponseRankingDependencyBundle = {},
): ResponseRankingResult {
  return createResponseRankingModel(deps).rankHelperCandidates(context, candidates);
}

export function rankBackendChatHaterCandidates(
  context: ResponseRankingContext,
  candidates: readonly ResponseRankingCandidateInput[],
  deps: ResponseRankingDependencyBundle = {},
): ResponseRankingResult {
  return createResponseRankingModel(deps).rankHaterCandidates(context, candidates);
}
