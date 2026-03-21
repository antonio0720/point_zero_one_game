/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT RESPONSE RANKING MODEL
 * FILE: backend/src/game/engine/chat/dl/ResponseRankingModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
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
  runtimeConfigOverride?: Nullable<Partial<typeof DEFAULT_BACKEND_CHAT_RUNTIME>>;
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
  runtimeChannel: ChatVisibleChannel;
  transcriptTurnCount: number;
  transcriptTimeSpanMs: number;
  replayCompression: Score01;
  moderationStrictness: Score01;
  learningValue: Score01;
  proofValue: Score01;
  shadowSupport: boolean;
  runtimePolicy: ResponseRankingRuntimePolicy;
  semanticQueryVector: Nullable<EmbeddingVector>;
  transcriptEmbeddingVector: Nullable<EmbeddingVector>;
  recentTurnBodies: string[];
}

interface ResponseRankingRuntimePolicy {
  candidateCutoff: number;
  semanticWindowDepth: number;
  maxTranscriptTurns: number;
  replayWindowMs: number;
  maxCharactersPerMessage: number;
  maxLinesPerMessage: number;
  helperMinimumGapMs: number;
  haterMinimumGapMs: number;
  npcMinimumGapMs: number;
  identicalMessageWindowMs: number;
  shadowWritesEnabled: boolean;
  learningSnapshotsEnabled: boolean;
  proofEnabled: boolean;
  replayEnabled: boolean;
  invasionPrimingEnabled: boolean;
  strictModeration: boolean;
  channelFallback: ChatVisibleChannel;
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
  private readonly runtimeDefaults: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
  private readonly runtimeConfig: typeof DEFAULT_BACKEND_CHAT_RUNTIME;
  private readonly runtimePolicy: ResponseRankingRuntimePolicy;
  private readonly now: () => UnixMs;

  constructor(deps: ResponseRankingDependencyBundle = {}) {
    this.runtimeDefaults = DEFAULT_BACKEND_CHAT_RUNTIME;
    this.runtimeConfig = mergeRuntimeConfig(deps.runtimeConfigOverride ?? this.runtimeDefaults);
    this.runtimePolicy = this.deriveRuntimePolicy(this.runtimeConfig, this.runtimeDefaults);
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
    const normalizedContext = this.normalizeContextForRuntime(context);
    const nowMs = normalizedContext.nowMs ?? this.now();
    const candidates = this.normalizeCandidates(rawCandidates, normalizedContext);
    const workingSurface = this.buildWorkingSurface(normalizedContext, candidates, nowMs);

    const scratches = candidates
      .map((candidate) => this.rankOneCandidate(candidate, normalizedContext, workingSurface))
      .sort((a, b) => b.provisionalScore - a.provisionalScore)
      .slice(0, this.runtimePolicy.candidateCutoff)
      .map((scratch, index) => this.finalizeRankedDecision(scratch, index + 1, normalizedContext, workingSurface));

    const top = scratches[0] ?? null;
    const sceneDisposition = this.computeSceneDisposition(normalizedContext, scratches, workingSurface);
    const rankingSummary = this.buildRankingSummary(normalizedContext, scratches, sceneDisposition, workingSurface);

    return {
      modelVersion: CHAT_RESPONSE_RANKING_MODEL_VERSION,
      roomId: normalizedContext.roomId,
      activeChannel: normalizedContext.activeChannel,
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
    context: ResponseRankingContext,
  ): RankedResponseCandidate[] {
    const normalized: RankedResponseCandidate[] = rawCandidates.map((candidate) => {
      const normalizedBody = this.normalizeCandidateBody(candidate.body);
      const bodyRisk = this.computeCandidateBodyRisk(normalizedBody);
      const normalizedChannelPreference = this.normalizeCandidateChannelPreference(
        candidate.channelPreference ?? 'same',
        context.activeChannel,
      );

      return {
        ...candidate,
        body: normalizedBody,
        channelPreference: normalizedChannelPreference,
        latencyClass: candidate.latencyClass ?? 'instant',
        moderationSensitivity: clamp01((candidate.moderationSensitivity ?? 0.25) + bodyRisk * 0.22 + (this.runtimePolicy.strictModeration ? 0.05 : 0)),
        recoveryValue: clamp01(candidate.recoveryValue ?? (candidate.intentFamily === 'rescue' ? 0.72 : 0.22)),
        aggressionValue: clamp01(candidate.aggressionValue ?? (candidate.intentFamily === 'taunt' || candidate.intentFamily === 'pressure' ? 0.72 : 0.16)),
        teachingValue: clamp01(candidate.teachingValue ?? (candidate.intentFamily === 'teaching' ? 0.74 : 0.18)),
        witnessValue: clamp01(candidate.witnessValue ?? (candidate.intentFamily === 'witness' ? 0.78 : 0.28)),
        negotiationValue: clamp01(candidate.negotiationValue ?? (candidate.intentFamily === 'negotiation' ? 0.82 : 0.2)),
        silenceCompatibility: clamp01(candidate.silenceCompatibility ?? (candidate.sourceKind === 'silence' ? 0.9 : 0.22)),
        repetitionKey: candidate.repetitionKey ?? null,
        callbackAnchorIds: [...(candidate.callbackAnchorIds ?? [])].slice(0, CHAT_RESPONSE_RANKING_DEFAULTS.maxSceneCallbacks),
        callbackQuoteIds: [...(candidate.callbackQuoteIds ?? [])].slice(0, CHAT_RESPONSE_RANKING_DEFAULTS.maxSceneCallbacks),
        semanticFamilies: [...(candidate.semanticFamilies ?? [])],
        dimensionBias: { ...(candidate.dimensionBias ?? {}) },
        metadata: {
          ...(candidate.metadata ?? {}),
          runtimeChannelPreference: normalizedChannelPreference,
          runtimeNormalizedBodyLength: normalizedBody.length,
          runtimeBodyRisk: bodyRisk,
        },
      };
    });

    const hasSilence = normalized.some((candidate) => candidate.sourceKind === 'silence');
    if (!hasSilence && this.shouldInjectSilenceCandidate(context)) {
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
      moderationSensitivity: clamp01(this.runtimePolicy.strictModeration ? 0.03 : 0.02),
      recoveryValue: clamp01(this.runtimePolicy.learningSnapshotsEnabled ? 0.34 : 0.3),
      aggressionValue: clamp01(0.02),
      teachingValue: clamp01(this.runtimePolicy.learningSnapshotsEnabled ? 0.12 : 0.08),
      witnessValue: clamp01(this.runtimePolicy.proofEnabled ? 0.22 : 0.18),
      negotiationValue: clamp01(this.runtimePolicy.shadowWritesEnabled ? 0.28 : 0.22),
      silenceCompatibility: clamp01(0.94),
      callbackAnchorIds: [],
      callbackQuoteIds: [],
      semanticFamilies: [],
      repetitionKey: 'system::silence::default-hold',
      dimensionBias: {} as never,
      metadata: {
        generated: true,
        runtimeProofEnabled: this.runtimePolicy.proofEnabled,
        runtimeShadowEnabled: this.runtimePolicy.shadowWritesEnabled,
      },
    };
  }

  private buildWorkingSurface(
    context: ResponseRankingContext,
    candidates: readonly RankedResponseCandidate[],
    nowMs: UnixMs,
  ): ResponseRankingWorkingSurface {
    const runtimeTranscriptWindow = this.sliceTranscriptWindowForRuntime(context.transcriptWindow, nowMs);
    const transcriptBodies = runtimeTranscriptWindow.map((turn) => turn.body).filter(Boolean);
    const recentTurnBodies = transcriptBodies.slice(-this.runtimePolicy.semanticWindowDepth);
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
      turns: runtimeTranscriptWindow.map((turn) => ({
        messageId: turn.messageId ?? (`turn::${turn.sequenceIndex}` as ChatMessageId),
        text: turn.body,
        channel: turn.channel,
        createdAtMs: turn.createdAt,
      })),
      sceneContext: context.sceneContext ?? this.buildSceneContext(context),
    });

    const semanticQueryVector = transcriptEmbedding ?? null;
    const transcriptTimeSpanMs = runtimeTranscriptWindow.length > 1
      ? Math.max(0, Number(runtimeTranscriptWindow[runtimeTranscriptWindow.length - 1]!.createdAt) - Number(runtimeTranscriptWindow[0]!.createdAt))
      : 0;
    const signalPressure = this.computeSignalPressure(context.currentSignals);
    const volatility = clamp01(context.toxicityRisk * 0.4 + context.haterPressure * 0.2 + context.churnRisk * 0.16 + (1 - context.shieldIntegrity) * 0.12 + signalPressure * 0.12);
    const stability = clamp01(1 - volatility * 0.62 + context.recoveryPotential * 0.22 + (1 - context.toxicityRisk) * 0.08 + (this.runtimePolicy.learningSnapshotsEnabled ? 0.08 : 0.02));
    const novelty = clamp01(
      0.2 +
      this.computeTranscriptNovelty(recentTurnBodies, candidates) * 0.7 +
      (this.runtimePolicy.replayEnabled ? 0.06 : 0.02)
    );
    const continuity = clamp01(
      0.24 +
      this.computeTranscriptContinuity(runtimeTranscriptWindow) * 0.66 +
      (this.runtimePolicy.proofEnabled ? 0.1 : 0.04)
    );
    const repetitionHeat = clamp01(
      1 - novelty * 0.58 + this.computeRepetitionHeat(candidates) * 0.32 + this.computeTranscriptEcho(runtimeTranscriptWindow) * 0.1
    );
    const relationshipContinuity = clamp01(
      this.computeRelationshipContinuity(runtimeTranscriptWindow) * 0.68 +
      continuity * 0.22 +
      (this.runtimePolicy.replayEnabled ? 0.1 : 0.04)
    );
    const publicWitnessNeed = clamp01(context.publicWitnessHeat * 0.52 + context.haterPressure * 0.12 + context.sovereigntyProximity * 0.1 + (1 - context.shieldIntegrity) * 0.12 + signalPressure * 0.06 + (this.runtimePolicy.proofEnabled ? 0.08 : 0.02));
    const privacyNeed = clamp01(context.churnRisk * 0.26 + context.toxicityRisk * 0.28 + context.helperUrgency * 0.14 + (1 - context.shieldIntegrity) * 0.06 + (1 - context.publicWitnessHeat) * 0.12 + (this.runtimePolicy.strictModeration ? 0.14 : 0.04));
    const negotiationNeed = clamp01((context.activeChannel === 'DEAL_ROOM' ? 0.74 : 0.16) + context.recoveryPotential * 0.05 + (this.runtimePolicy.shadowWritesEnabled ? 0.05 : 0));
    const rescueNeed = clamp01(context.helperUrgency * 0.4 + context.churnRisk * 0.26 + context.toxicityRisk * 0.1 + (1 - context.shieldIntegrity) * 0.12 + signalPressure * 0.06 + (this.runtimePolicy.learningSnapshotsEnabled ? 0.06 : 0.02));
    const aggressionWindow = clamp01(context.haterPressure * 0.42 + context.publicWitnessHeat * 0.16 + (1 - context.shieldIntegrity) * 0.12 + context.sovereigntyProximity * 0.08 + (1 - context.helperUrgency) * 0.1 + signalPressure * 0.12);
    const replayCompression = clamp01(runtimeTranscriptWindow.length / Math.max(1, this.runtimePolicy.maxTranscriptTurns));
    const moderationStrictness = clamp01(
      (this.runtimePolicy.strictModeration ? 0.58 : 0.24) +
      (this.runtimeConfig.moderationPolicy.shadowModeOnHighRisk ? 0.12 : 0) +
      (this.runtimeDefaults.moderationPolicy.shadowModeOnHighRisk ? 0.04 : 0)
    );
    const learningValue = clamp01((this.runtimeConfig.learningPolicy.enabled ? 0.4 : 0.08) + (this.runtimeConfig.learningPolicy.emitInferenceSnapshots ? 0.34 : 0.06) + (this.runtimeDefaults.learningPolicy.coldStartEnabled ? 0.12 : 0));
    const proofValue = clamp01((this.runtimeConfig.proofPolicy.enabled ? 0.42 : 0.08) + (this.runtimeConfig.proofPolicy.linkReplayEdges ? 0.18 : 0.04) + (this.runtimeConfig.proofPolicy.linkLearningEdges ? 0.14 : 0.04));
    const silenceValue = clamp01(
      0.18 +
      (context.toxicityRisk * 0.14) +
      (context.churnRisk * 0.1) +
      (negotiationNeed * 0.14) +
      ((1 - context.publicWitnessHeat) * 0.06) +
      (stability * 0.08) +
      (moderationStrictness * 0.1) +
      (replayCompression * 0.08)
    );
    const sequenceConfidence = encodedIntent.turnResults.length
      ? encodedIntent.turnResults.reduce((sum, turn) => sum + Number(turn.confidence01), 0) / encodedIntent.turnResults.length
      : 0.5;

    return {
      nowMs,
      volatility,
      stability,
      novelty,
      continuity,
      repetitionHeat,
      relationshipContinuity,
      primaryIntentKind: encodedIntent.dominantSequenceIntent ?? null,
      intentEntropy: clamp01(1 - sequenceConfidence),
      publicWitnessNeed,
      privacyNeed,
      negotiationNeed,
      rescueNeed,
      aggressionWindow,
      silenceValue,
      runtimeChannel: context.activeChannel,
      transcriptTurnCount: runtimeTranscriptWindow.length,
      transcriptTimeSpanMs,
      replayCompression,
      moderationStrictness,
      learningValue,
      proofValue,
      shadowSupport: this.runtimePolicy.shadowWritesEnabled,
      runtimePolicy: this.runtimePolicy,
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
    const runtimeLegality = this.scoreRuntimeChannelLegality(candidate, context);
    const result = clamp01(
      modeWeight * 0.14 +
      roomWeight * 0.1 +
      channelWeight * 0.11 +
      intentWeight * 0.16 +
      runtimeLegality * 0.14 +
      volatilityPenalty * 0.07 +
      stabilityBoost * 0.07 +
      continuityBoost * 0.08 +
      noveltyBoost * 0.06 +
      relationBoost * 0.07
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
    const expectedGap = this.resolveExpectedGapForCandidate(candidate);
    const recentGap = surface.transcriptTurnCount > 1
      ? clamp01(surface.transcriptTimeSpanMs / Math.max(expectedGap, 1))
      : clamp01(0.72);
    const latencyClassFitness = this.scoreLatencyClassAgainstRuntime(candidate.latencyClass ?? 'instant', expectedGap, surface);
    const result = clamp01(
      modeWeight * 0.12 +
      roomWeight * 0.09 +
      channelWeight * 0.1 +
      intentWeight * 0.14 +
      latencyClassFitness * 0.18 +
      recentGap * 0.12 +
      volatilityPenalty * 0.06 +
      stabilityBoost * 0.06 +
      continuityBoost * 0.07 +
      noveltyBoost * 0.05 +
      relationBoost * 0.07
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
    const bodyRisk = this.computeCandidateBodyRisk(candidate.body);
    const strictness = surface.moderationStrictness;
    if (candidate.sourceKind === 'system') {
      return clamp01(base * 0.16 + strictness * 0.06);
    }
    if (candidate.intentFamily === 'taunt' || candidate.intentFamily === 'pressure') {
      return clamp01(base * 0.36 + risk * 0.28 + bodyRisk * 0.2 + strictness * 0.16);
    }
    if (candidate.intentFamily === 'rescue') {
      return clamp01(base * 0.22 + risk * 0.08 + bodyRisk * 0.08 + strictness * 0.1);
    }
    return clamp01(base * 0.24 + risk * 0.18 + surface.volatility * 0.1 + bodyRisk * 0.16 + strictness * 0.12);
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
    const illegalChannelPenalty = this.scoreRuntimeChannelLegality(candidate, context) < 0.5 ? 0.3 : 0;
    const shadowPenalty = candidate.channelPreference === 'shadow' && !surface.shadowSupport ? 0.32 : 0;
    return clamp01(publicMismatch + aggressionSuppression + illegalChannelPenalty + shadowPenalty);
  }

  private computeSilenceBonus(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    const channelPrivacyBoost = context.activeChannel === 'DEAL_ROOM' ? 0.04 : 0;
    if (candidate.sourceKind === 'silence' || candidate.actionKind === 'hold') {
      return clamp01(surface.silenceValue * 0.74 + surface.negotiationNeed * 0.12 + surface.volatility * 0.08 + channelPrivacyBoost);
    }
    return clamp01(candidate.silenceCompatibility! * surface.silenceValue * 0.12 + channelPrivacyBoost * 0.4);
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
      return `Candidate is better kept off visible transcript until privacy / rescue posture resolves; runtime shadow support is ${surface.shadowSupport ? 'enabled' : 'disabled'}.`;
    }
    if (candidate.channelPreference === 'same') {
      return `Candidate preserves current ${context.activeChannel} continuity under runtime channel law.`;
    }
    return `Candidate prefers ${candidate.channelPreference} because channel-fit and scene semantics outweigh current-lane continuity in ${context.activeChannel}.`;
  }

  private describePressureRead(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
    surface: ResponseRankingWorkingSurface,
  ): string {
    if (candidate.intentFamily === 'pressure' || candidate.intentFamily === 'taunt') {
      return `Aggressive reply aligns with active pressure window and witness appetite on ${context.activeChannel}, with volatility at ${surface.volatility.toFixed(2)}.`;
    }
    if (candidate.intentFamily === 'rescue') {
      return `Recovery posture outranks spectacle under current churn / toxicity balance and rescue need ${surface.rescueNeed.toFixed(2)}.`;
    }
    return `Pressure does not disqualify the candidate, but it does shape timing and witness value under volatility ${surface.volatility.toFixed(2)}.`;
  }

  private describeMemoryRead(
    candidate: RankedResponseCandidate,
    dimensions: ResponseRankingDimensionBreakdown,
    surface: ResponseRankingWorkingSurface,
  ): string {
    if ((candidate.callbackAnchorIds ?? []).length || (candidate.callbackQuoteIds ?? []).length) {
      return `Candidate carries callback potential and benefits from memory-backed continuity; learning value is ${surface.learningValue.toFixed(2)}.`;
    }
    if (dimensions.memoryFitness >= 0.65) {
      return `Candidate fits remembered scene posture even without explicit callback anchors, supported by replay depth ${surface.transcriptTurnCount}.`;
    }
    return 'Candidate does not rely heavily on memory, which may keep the turn fresher.';
  }

  private describeContinuityRead(
    candidate: RankedResponseCandidate,
    dimensions: ResponseRankingDimensionBreakdown,
    surface: ResponseRankingWorkingSurface,
  ): string {
    if (dimensions.continuityValue >= 0.7) {
      return `Candidate preserves persona / scene continuity for ${candidate.personaId ?? 'unbound persona'} without collapsing into repetition.`;
    }
    if (dimensions.noveltyValue >= 0.68) {
      return `Candidate wins partly because the scene needs a fresh move rather than continuity, despite replay compression ${surface.replayCompression.toFixed(2)}.`;
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
      return `Candidate remains viable but carries meaningful moderation / suppression / repetition cost in ${context.activeChannel}, with strictness ${surface.moderationStrictness.toFixed(2)}.`;
    }
    if (candidate.sourceKind === 'silence') {
      return 'Risk is carried by over-speaking, so the model rewards a deliberate hold.';
    }
    return `Candidate carries manageable risk relative to current scene pressure and proof value ${surface.proofValue.toFixed(2)}.`;
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
      callbackAnchorIds: [...(scratch.candidate.callbackAnchorIds ?? [])],
      callbackQuoteIds: [...(scratch.candidate.callbackQuoteIds ?? [])],
      repetitionKey: scratch.candidate.repetitionKey ?? null,
      personaId: scratch.candidate.personaId ?? null,
      sceneId: scratch.candidate.sceneId ?? null,
      body: scratch.candidate.body,
      metadata: {
        semanticSimilarity: scratch.semanticSimilarity,
        modelVersion: CHAT_RESPONSE_RANKING_MODEL_VERSION,
        embeddingVersion: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
        intentEncoderVersion: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
        runtimeVisibleChannels: [...this.runtimeConfig.allowVisibleChannels],
        runtimeReplayEnabled: this.runtimeConfig.replayPolicy.enabled,
        runtimeLearningEnabled: this.runtimeConfig.learningPolicy.enabled,
        runtimeProofEnabled: this.runtimeConfig.proofPolicy.enabled,
        runtimeStrictModeration: this.runtimePolicy.strictModeration,
        runtimeCandidateCutoff: this.runtimePolicy.candidateCutoff,
        runtimeSemanticWindowDepth: this.runtimePolicy.semanticWindowDepth,
        runtimeTranscriptTurns: surface.transcriptTurnCount,
        runtimeReplayCompression: surface.replayCompression,
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
      return this.runtimePolicy.shadowWritesEnabled ? 'shadow' : context.activeChannel;
    }
    if (candidate.channelPreference === 'same') {
      return context.activeChannel;
    }
    if (this.runtimeConfig.allowVisibleChannels.includes(candidate.channelPreference)) {
      return candidate.channelPreference;
    }
    return this.runtimePolicy.channelFallback;
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
    if (top.recommendedChannel === 'shadow' && !surface.shadowSupport) {
      return 'redirect';
    }
    if (top.recommendedChannel !== context.activeChannel && top.recommendedChannel !== 'shadow') {
      return 'redirect';
    }
    if (top.actionKind === 'hold' || (surface.replayCompression >= 0.92 && top.normalizedScore < 0.7)) {
      return 'delay';
    }
    if (surface.runtimePolicy.invasionPrimingEnabled && context.activeModeId?.toLowerCase().includes('raid') && top.intentFamily === 'silence') {
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
      return 'Silence outranked visible speech because hold value, privacy need, negotiation tension, and runtime moderation pressure currently dominate.';
    }
    return `Top-ranked ${top.sourceKind} / ${top.intentFamily} candidate scored ${top.score.toFixed(1)} on ${context.activeChannel}, scene disposition resolved to ${sceneDisposition}, and runtime used ${surface.transcriptTurnCount} replay turns across ${surface.runtimePolicy.semanticWindowDepth} semantic slots.`;
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
    const dimension = dimensionKey.toLowerCase();
    if (family.includes(primary) || primary.includes(family)) {
      return clamp01(dimension.includes('continuity') || dimension.includes('memory') ? 0.92 : 0.9);
    }
    if ((family === 'rescue' || family === 'teaching') && primary.includes('help')) {
      return clamp01(0.84);
    }
    if ((family === 'taunt' || family === 'pressure') && (primary.includes('taunt') || primary.includes('threat'))) {
      return clamp01(0.85);
    }
    if (family === 'negotiation' && (primary.includes('bluff') || primary.includes('offer'))) {
      return clamp01(dimension.includes('negotiation') ? 0.9 : 0.87);
    }
    if (family === 'silence' && primary.includes('hesitation')) {
      return clamp01(dimension.includes('latency') || dimension.includes('memory') ? 0.8 : 0.76);
    }
    return clamp01(0.52);
  }

  private normalizeContextForRuntime(
    context: ResponseRankingContext,
  ): ResponseRankingContext {
    const activeChannel = this.runtimeConfig.allowVisibleChannels.includes(context.activeChannel)
      ? context.activeChannel
      : this.runtimePolicy.channelFallback;

    return {
      ...context,
      activeChannel,
      transcriptWindow: this.sliceTranscriptWindowForRuntime(
        context.transcriptWindow,
        context.nowMs ?? this.now(),
      ),
      optionalSceneNotes: [
        ...(context.optionalSceneNotes ?? []),
        `runtime.channels=${this.runtimeConfig.allowVisibleChannels.join(',')}`,
        `runtime.strictModeration=${String(this.runtimePolicy.strictModeration)}`,
      ],
    };
  }

  private deriveRuntimePolicy(
    runtimeConfig: typeof DEFAULT_BACKEND_CHAT_RUNTIME,
    runtimeDefaults: typeof DEFAULT_BACKEND_CHAT_RUNTIME,
  ): ResponseRankingRuntimePolicy {
    const candidateCutoff = Math.max(
      12,
      Math.min(
        48,
        Math.round(
          CHAT_RESPONSE_RANKING_DEFAULTS.candidateCutoff +
          runtimeConfig.ratePolicy.perSecondBurstLimit +
          (runtimeConfig.learningPolicy.emitInferenceSnapshots ? 4 : 0) +
          (runtimeConfig.proofPolicy.enabled ? 2 : 0),
        ),
      ),
    );

    const semanticWindowDepth = Math.max(
      8,
      Math.min(
        24,
        Math.round(
          CHAT_RESPONSE_RANKING_DEFAULTS.semanticWindowDepth +
          (runtimeConfig.replayPolicy.enabled ? 4 : 0) +
          (runtimeConfig.learningPolicy.coldStartEnabled ? 1 : 0),
        ),
      ),
    );

    const channelFallback = runtimeConfig.allowVisibleChannels[0]
      ?? runtimeDefaults.allowVisibleChannels[0]
      ?? 'GLOBAL';

    return {
      candidateCutoff,
      semanticWindowDepth,
      maxTranscriptTurns: Math.max(24, Math.min(256, Math.round(runtimeConfig.replayPolicy.maxMessagesPerRoom / 24))),
      replayWindowMs: runtimeConfig.replayPolicy.replayTimeWindowMs,
      maxCharactersPerMessage: runtimeConfig.moderationPolicy.maxCharactersPerMessage,
      maxLinesPerMessage: runtimeConfig.moderationPolicy.maxLinesPerMessage,
      helperMinimumGapMs: runtimeConfig.ratePolicy.helperMinimumGapMs,
      haterMinimumGapMs: runtimeConfig.ratePolicy.haterMinimumGapMs,
      npcMinimumGapMs: runtimeConfig.ratePolicy.npcMinimumGapMs,
      identicalMessageWindowMs: runtimeConfig.ratePolicy.identicalMessageWindowMs,
      shadowWritesEnabled: runtimeConfig.allowShadowChannels.length > 0,
      learningSnapshotsEnabled: runtimeConfig.learningPolicy.emitInferenceSnapshots,
      proofEnabled: runtimeConfig.proofPolicy.enabled,
      replayEnabled: runtimeConfig.replayPolicy.enabled,
      invasionPrimingEnabled: runtimeConfig.invasionPolicy.allowShadowPriming,
      strictModeration: runtimeConfig.moderationPolicy.shadowModeOnHighRisk,
      channelFallback,
    };
  }

  private normalizeCandidateChannelPreference(
    preference: RankedResponseCandidate['channelPreference'],
    activeChannel: ChatVisibleChannel,
  ): RankedResponseCandidate['channelPreference'] {
    if (preference === 'same') {
      return this.runtimeConfig.allowVisibleChannels.includes(activeChannel)
        ? 'same'
        : this.runtimePolicy.channelFallback;
    }
    if (preference === 'shadow') {
      return this.runtimePolicy.shadowWritesEnabled ? 'shadow' : 'same';
    }
    if (this.runtimeConfig.allowVisibleChannels.includes(preference)) {
      return preference;
    }
    return 'same';
  }

  private normalizeCandidateBody(body: string): string {
    const normalized = (body ?? '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .slice(0, this.runtimePolicy.maxLinesPerMessage)
      .join('\n')
      .slice(0, this.runtimePolicy.maxCharactersPerMessage);

    return normalized;
  }

  private computeCandidateBodyRisk(body: string): Score01 {
    if (!body) {
      return clamp01(0);
    }

    const normalized = body.toLowerCase();
    const lineCount = body.split('\n').length;
    const charPressure = clamp01(body.length / Math.max(1, this.runtimePolicy.maxCharactersPerMessage));
    const linePressure = clamp01(lineCount / Math.max(1, this.runtimePolicy.maxLinesPerMessage));
    const maskedHits = this.runtimeConfig.moderationPolicy.maskBannedLexemes.filter((lexeme) => normalized.includes(lexeme.toLowerCase())).length;
    const rejectHits = this.runtimeConfig.moderationPolicy.rejectBannedLexemes.filter((lexeme) => normalized.includes(lexeme.toLowerCase())).length;
    const urlHits = (normalized.match(/https?:\/\//g) ?? []).length;
    const capsRatio = this.computeAllCapsRatio(body);

    return clamp01(
      charPressure * 0.18 +
      linePressure * 0.14 +
      clamp01(maskedHits / Math.max(1, this.runtimeConfig.moderationPolicy.maskBannedLexemes.length)) * 0.16 +
      clamp01(rejectHits) * 0.28 +
      clamp01(urlHits / Math.max(1, this.runtimeConfig.moderationPolicy.maxSuspiciousUrlCount)) * 0.08 +
      clamp01(capsRatio / Math.max(0.01, this.runtimeConfig.moderationPolicy.rewriteAllCapsThreshold)) * 0.16
    );
  }

  private computeAllCapsRatio(body: string): number {
    const letters = [...body].filter((char) => /[A-Za-z]/.test(char));
    if (!letters.length) {
      return 0;
    }
    const upper = letters.filter((char) => char === char.toUpperCase()).length;
    return upper / letters.length;
  }

  private shouldInjectSilenceCandidate(
    context: ResponseRankingContext,
  ): boolean {
    if (!this.runtimePolicy.replayEnabled) {
      return true;
    }
    return context.transcriptWindow.length <= this.runtimePolicy.maxTranscriptTurns;
  }

  private sliceTranscriptWindowForRuntime(
    transcriptWindow: readonly ResponseTranscriptTurn[],
    nowMs: UnixMs,
  ): readonly ResponseTranscriptTurn[] {
    if (!transcriptWindow.length) {
      return transcriptWindow;
    }

    const earliestAllowed = Number(nowMs) - this.runtimePolicy.replayWindowMs;
    const sliced = transcriptWindow
      .filter((turn) => Number(turn.createdAt) >= earliestAllowed)
      .slice(-this.runtimePolicy.maxTranscriptTurns);

    return sliced.length ? sliced : transcriptWindow.slice(-this.runtimePolicy.maxTranscriptTurns);
  }

  private computeSignalPressure(
    signals: readonly ChatSignalEnvelope[],
  ): Score01 {
    if (!signals.length) {
      return clamp01(0);
    }

    let total = 0;
    for (const signal of signals) {
      if (signal.battle) {
        total += Number(signal.battle.hostileMomentum) / 100 * 0.28;
        total += signal.battle.rescueWindowOpen ? 0.04 : 0;
      }
      if (signal.run) {
        total += signal.run.bankruptcyWarning ? 0.1 : 0;
        total += signal.run.nearSovereignty ? 0.06 : 0;
      }
      if (signal.multiplayer) {
        total += Math.min(0.12, Number(signal.multiplayer.rankingPressure) / 100 * 0.12);
      }
      if (signal.economy) {
        total += signal.economy.bluffRisk01 * 0.12;
        total += signal.economy.liquidityStress01 * 0.1;
      }
      if (signal.liveops) {
        total += signal.liveops.heatMultiplier01 * 0.1;
        total += signal.liveops.helperBlackout ? 0.06 : 0;
      }
    }

    return clamp01(total / Math.max(1, signals.length) * 1.8);
  }

  private computeTranscriptEcho(
    transcriptWindow: readonly ResponseTranscriptTurn[],
  ): Score01 {
    if (transcriptWindow.length < 2) {
      return clamp01(0);
    }

    const seen = new Set<string>();
    let repeats = 0;
    for (const turn of transcriptWindow) {
      const normalized = turn.body.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      if (seen.has(normalized)) {
        repeats += 1;
      } else {
        seen.add(normalized);
      }
    }
    return clamp01(repeats / transcriptWindow.length);
  }

  private resolveExpectedGapForCandidate(
    candidate: RankedResponseCandidate,
  ): number {
    if (candidate.sourceKind === 'helper') {
      return this.runtimePolicy.helperMinimumGapMs;
    }
    if (candidate.sourceKind === 'hater') {
      return this.runtimePolicy.haterMinimumGapMs;
    }
    return this.runtimePolicy.npcMinimumGapMs;
  }

  private scoreLatencyClassAgainstRuntime(
    latencyClass: NonNullable<RankedResponseCandidate['latencyClass']>,
    expectedGap: number,
    surface: ResponseRankingWorkingSurface,
  ): Score01 {
    switch (latencyClass) {
      case 'instant':
        return clamp01(1 - clamp01(expectedGap / Math.max(1, surface.runtimePolicy.haterMinimumGapMs * 1.5)) * 0.35);
      case 'short_delay':
        return clamp01(0.72 + surface.volatility * 0.08 + surface.continuity * 0.06);
      case 'dramatic_delay':
        return clamp01(0.58 + surface.proofValue * 0.08 + surface.replayCompression * 0.1);
      case 'hold':
        return clamp01(0.52 + surface.silenceValue * 0.24 + surface.moderationStrictness * 0.08);
      default:
        return clamp01(0.6);
    }
  }

  private scoreRuntimeChannelLegality(
    candidate: RankedResponseCandidate,
    context: ResponseRankingContext,
  ): Score01 {
    if (candidate.channelPreference === 'same') {
      return this.runtimeConfig.allowVisibleChannels.includes(context.activeChannel) ? clamp01(0.9) : clamp01(0.42);
    }
    if (candidate.channelPreference === 'shadow') {
      return this.runtimePolicy.shadowWritesEnabled ? clamp01(0.88) : clamp01(0.2);
    }
    return this.runtimeConfig.allowVisibleChannels.includes(candidate.channelPreference)
      ? clamp01(0.94)
      : clamp01(0.24);
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
