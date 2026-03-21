/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CONVERSATION MEMORY MODEL
 * FILE: backend/src/game/engine/chat/dl/ConversationMemoryModel.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable backend memory surface for accepted chat truth.
 *
 * Backend-truth question
 * ----------------------
 *   "What should the chat system remember, how strongly should it remember it,
 *    when should it retrieve it, and how should that memory remain useful for
 *    future helpers, haters, deal-room scenes, proof, replay, callbacks, and
 *    continuity — without letting memory turn noisy or stale?"
 *
 * Doctrine
 * --------
 * - This file does not mutate transcript truth.
 * - This file stores memory derived from accepted truth, not raw client guesses.
 * - This file does not author responses directly.
 * - This file does provide retrieval-ready, replay-safe, explainable memory
 *   anchors for downstream ranking, orchestration, reward, rescue, and proof.
 *
 * Why this file exists
 * --------------------
 * Point Zero One chat should remember more than strings. It should remember:
 * - who humiliated whom,
 * - who saved whom,
 * - which boast aged badly,
 * - which silence mattered,
 * - which comeback became a legend,
 * - which helper advice was ignored,
 * - which deal-room bluff revealed a pattern,
 * - which room witnessed the collapse,
 * - and which emotional posture carried across modes.
 *
 * So memory cannot be a flat transcript cache. It must manage:
 * - anchors,
 * - windows,
 * - callbacks,
 * - relationship heat,
 * - memory compression,
 * - per-room and per-user traces,
 * - scene summaries,
 * - salience decay,
 * - and retrieval policies that stay faithful to the game’s pressure semantics.
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
  type EmbeddingSceneContext,
  type EmbeddingSemanticFamily,
  type EmbeddingVector,
  MessageEmbeddingClient,
  createMessageEmbeddingClient,
} from './MessageEmbeddingClient';
import {
  CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
  type DialogueIntentKind,
  DialogueIntentEncoder,
  createDialogueIntentEncoder,
} from './DialogueIntentEncoder';

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_CONVERSATION_MEMORY_MODEL_MODULE_NAME =
  'PZO_BACKEND_CHAT_CONVERSATION_MEMORY_MODEL' as const;

export const CHAT_CONVERSATION_MEMORY_MODEL_VERSION =
  '2026.03.14-conversation-memory-model.v1' as const;

export const CHAT_CONVERSATION_MEMORY_RUNTIME_LAWS = Object.freeze([
  'Only accepted backend truth becomes durable memory.',
  'Memory stores meaning, not just raw transcript duplication.',
  'Salience decays, but legend and relationship anchors decay slowly.',
  'Retrieval must be explainable enough for proof and replay.',
  'Compression must preserve callback-safe details.',
  'Public witness memory differs from private recovery memory.',
  'Room / mode semantics are part of the memory, not metadata afterthoughts.',
  'Do not let memory re-surface stale humiliation without scene support.',
  'Keep helper and hater continuity available without forcing repetition.',
  'Callbacks should feel earned, not mechanically quoted.',
] as const);

export const CHAT_CONVERSATION_MEMORY_DEFAULTS = Object.freeze({
  maxRecordsPerRoom: 512,
  maxRecordsPerUser: 384,
  maxAnchorCallbacks: 16,
  maxRetrievals: 24,
  compactionWindowSize: 8,
  decayHalfLifeMs: 1000 * 60 * 45,
  legendDecayHalfLifeMs: 1000 * 60 * 60 * 12,
  relationshipDecayHalfLifeMs: 1000 * 60 * 60 * 6,
  minimumRetentionThreshold: 0.16,
  callbackQuoteThreshold: 0.58,
  relationshipPersistenceFloor: 0.24,
  replayPersistenceBias: 0.18,
} as const);

// ============================================================================
// MARK: Public types
// ============================================================================

export type ConversationMemoryKind =
  | 'turn'
  | 'window'
  | 'callback'
  | 'legend'
  | 'relationship'
  | 'rescue'
  | 'threat'
  | 'negotiation'
  | 'proof'
  | 'scene_summary';

export interface ConversationMemoryRecord {
  memoryId: string;
  roomId: ChatRoomId;
  roomKind: ChatRoomKind;
  sessionId: Nullable<ChatSessionId>;
  ownerUserId: Nullable<ChatUserId>;
  counterpartUserId: Nullable<ChatUserId>;
  modeId: Nullable<string>;
  channel: ChatVisibleChannel;
  memoryKind: ConversationMemoryKind;
  intentKind: Nullable<DialogueIntentKind>;
  semanticFamilies: EmbeddingSemanticFamily[];
  sourceMessageIds: ChatMessageId[];
  callbackQuoteIds: string[];
  title: string;
  body: string;
  summary: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  signalStrength: Score01;
  eventDensity: Score01;
  relationshipHeat: Score01;
  callbackPotential: Score01;
  witnessValue: Score01;
  replayValue: Score01;
  rescueValue: Score01;
  threatValue: Score01;
  negotiationValue: Score01;
  legendValue: Score01;
  emotionalCharge: Score01;
  continuityValue: Score01;
  decayMultiplier: Score01;
  embeddingVector: Nullable<EmbeddingVector>;
  metadata: Record<string, JsonValue>;
}

export interface ConversationMemoryTurn {
  messageId: ChatMessageId;
  roomId: ChatRoomId;
  roomKind: ChatRoomKind;
  sessionId: Nullable<ChatSessionId>;
  userId: Nullable<ChatUserId>;
  counterpartUserId: Nullable<ChatUserId>;
  modeId: Nullable<string>;
  channel: ChatVisibleChannel;
  body: string;
  createdAt: UnixMs;
  pressureTier: Nullable<PressureTier>;
  semanticFamilies?: readonly EmbeddingSemanticFamily[];
  signalStrength?: Score01;
  witnessValue?: Score01;
  rescueValue?: Score01;
  threatValue?: Score01;
  negotiationValue?: Score01;
  legendValue?: Score01;
  emotionalCharge?: Score01;
  metadata?: Record<string, JsonValue>;
}

export interface ConversationMemoryContext {
  roomId: ChatRoomId;
  roomKind: ChatRoomKind;
  sessionId: Nullable<ChatSessionId>;
  ownerUserId: Nullable<ChatUserId>;
  counterpartUserId: Nullable<ChatUserId>;
  activeChannel: ChatVisibleChannel;
  modeId: Nullable<string>;
  nowMs: UnixMs;
  pressureTier: Nullable<PressureTier>;
  publicWitnessHeat: Score01;
  helperUrgency: Score01;
  haterPressure: Score01;
  toxicityRisk: Score01;
  churnRisk: Score01;
  sceneNotes?: Nullable<string[]>;
}

export interface ConversationMemoryRetrievalRequest {
  roomId: ChatRoomId;
  ownerUserId: Nullable<ChatUserId>;
  counterpartUserId?: Nullable<ChatUserId>;
  activeChannel: ChatVisibleChannel;
  roomKind: ChatRoomKind;
  modeId: Nullable<string>;
  queryText: string;
  desiredKinds?: readonly ConversationMemoryKind[];
  maxResults?: number;
  nowMs?: Nullable<UnixMs>;
  sceneContext?: Nullable<EmbeddingSceneContext>;
}

export interface ConversationMemoryRetrievalResult {
  modelVersion: string;
  queryText: string;
  results: RetrievedConversationMemory[];
  summary: string;
  computedAt: UnixMs;
}

export interface RetrievedConversationMemory {
  memoryId: string;
  roomId: ChatRoomId;
  ownerUserId: Nullable<ChatUserId>;
  counterpartUserId: Nullable<ChatUserId>;
  kind: ConversationMemoryKind;
  score: Score100;
  normalizedScore: Score01;
  salience: Score01;
  recency: Score01;
  relationshipWeight: Score01;
  replayWeight: Score01;
  callbackWeight: Score01;
  title: string;
  summary: string;
  sourceMessageIds: ChatMessageId[];
  callbackQuoteIds: string[];
  metadata: Record<string, JsonValue>;
}

export interface ConversationMemoryModelDependencies {
  embeddingClient?: Nullable<MessageEmbeddingClient>;
  intentEncoder?: Nullable<DialogueIntentEncoder>;
  now?: Nullable<() => UnixMs>;
}

// ============================================================================
// MARK: Internal state
// ============================================================================

interface ConversationMemoryIndex {
  byRoom: Map<ChatRoomId, ConversationMemoryRecord[]>;
  byUser: Map<string, ConversationMemoryRecord[]>;
  byMessageId: Map<ChatMessageId, ConversationMemoryRecord[]>;
}

interface SceneCompressionWindow {
  roomId: ChatRoomId;
  roomKind: ChatRoomKind;
  ownerUserId: Nullable<ChatUserId>;
  counterpartUserId: Nullable<ChatUserId>;
  modeId: Nullable<string>;
  channel: ChatVisibleChannel;
  openedAt: UnixMs;
  closedAt: UnixMs;
  turns: ConversationMemoryTurn[];
}

// ============================================================================
// MARK: Model class
// ============================================================================

export class ConversationMemoryModel {
  private readonly embeddingClient: MessageEmbeddingClient;
  private readonly intentEncoder: DialogueIntentEncoder;
  private readonly now: () => UnixMs;
  private readonly index: ConversationMemoryIndex;
  private readonly activeWindows: Map<string, SceneCompressionWindow>;

  constructor(deps: ConversationMemoryModelDependencies = {}) {
    this.embeddingClient =
      deps.embeddingClient ?? createMessageEmbeddingClient();
    this.intentEncoder =
      deps.intentEncoder ?? createDialogueIntentEncoder({
        embeddingClient: this.embeddingClient,
      });
    this.now = deps.now ?? (() => asUnixMs(Date.now()));
    this.index = {
      byRoom: new Map(),
      byUser: new Map(),
      byMessageId: new Map(),
    };
    this.activeWindows = new Map();
  }

  public ingestAcceptedTurn(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): ConversationMemoryRecord {
    const nowMs = context.nowMs ?? this.now();
    const sceneContext = this.buildSceneContext(context);
    const encodedIntent = this.intentEncoder.encodeTurn({
      message: {
        messageId: turn.messageId,
        text: turn.body,
        createdAtMs: turn.createdAt,
        channel: turn.channel,
        roomKind: turn.roomKind,
        modeId: turn.modeId ?? null,
        pressureTier: turn.pressureTier ?? null,
        sceneContext,
      },
      sceneContext,
    });

    const record: ConversationMemoryRecord = {
      memoryId: `memory::turn::${turn.messageId}`,
      roomId: turn.roomId,
      roomKind: turn.roomKind,
      sessionId: turn.sessionId ?? context.sessionId ?? null,
      ownerUserId: turn.userId ?? context.ownerUserId ?? null,
      counterpartUserId: turn.counterpartUserId ?? context.counterpartUserId ?? null,
      modeId: turn.modeId ?? context.modeId ?? null,
      channel: turn.channel,
      memoryKind: this.resolveTurnMemoryKind(turn, context),
      intentKind: encodedIntent.primaryIntent ?? null,
      semanticFamilies: [...(turn.semanticFamilies ?? [])],
      sourceMessageIds: [turn.messageId],
      callbackQuoteIds: [],
      title: this.buildTurnTitle(turn, encodedIntent.primaryIntent ?? null),
      body: turn.body,
      summary: this.buildTurnSummary(turn, encodedIntent.primaryIntent ?? null, context),
      createdAt: turn.createdAt,
      updatedAt: nowMs,
      signalStrength: clamp01(turn.signalStrength ?? this.estimateSignalStrength(turn, context)),
      eventDensity: clamp01(this.estimateEventDensity(turn, context)),
      relationshipHeat: clamp01(this.estimateRelationshipHeat(turn, context)),
      callbackPotential: clamp01(this.estimateCallbackPotential(turn, context)),
      witnessValue: clamp01(turn.witnessValue ?? this.estimateWitnessValue(turn, context)),
      replayValue: clamp01(this.estimateReplayValue(turn, context)),
      rescueValue: clamp01(turn.rescueValue ?? this.estimateRescueValue(turn, context)),
      threatValue: clamp01(turn.threatValue ?? this.estimateThreatValue(turn, context)),
      negotiationValue: clamp01(turn.negotiationValue ?? this.estimateNegotiationValue(turn, context)),
      legendValue: clamp01(turn.legendValue ?? this.estimateLegendValue(turn, context)),
      emotionalCharge: clamp01(turn.emotionalCharge ?? this.estimateEmotionalCharge(turn, context)),
      continuityValue: clamp01(this.estimateContinuityValue(turn, context)),
      decayMultiplier: clamp01(this.resolveDecayMultiplier(turn, context)),
      embeddingVector: this.embedTurn(turn, sceneContext),
      metadata: {
        source: 'ingestAcceptedTurn',
        modelVersion: CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
        embeddingVersion: CHAT_MESSAGE_EMBEDDING_CLIENT_VERSION,
        intentEncoderVersion: CHAT_DIALOGUE_INTENT_ENCODER_VERSION,
        pressureTier: turn.pressureTier ?? null,
        ...(turn.metadata ?? {}),
      },
    };

    this.storeRecord(record);
    this.appendToCompressionWindow(turn, context);
    this.compactIfNeeded(turn.roomId, context.ownerUserId ?? null);
    return record;
  }

  public ingestAcceptedTurns(
    turns: readonly ConversationMemoryTurn[],
    context: ConversationMemoryContext,
  ): ConversationMemoryRecord[] {
    return turns.map((turn) => this.ingestAcceptedTurn(turn, context));
  }

  public recordCallbackMemory(
    sourceRecord: ConversationMemoryRecord,
    quotedText: string,
    context: ConversationMemoryContext,
  ): ConversationMemoryRecord {
    const nowMs = context.nowMs ?? this.now();
    const callbackRecord: ConversationMemoryRecord = {
      ...sourceRecord,
      memoryId: `${sourceRecord.memoryId}::callback::${nowMs}`,
      memoryKind: 'callback',
      title: `Callback — ${sourceRecord.title}`,
      body: quotedText,
      summary: `Callback-ready receipt referencing: ${sourceRecord.summary}`,
      createdAt: sourceRecord.createdAt,
      updatedAt: nowMs,
      callbackPotential: clamp01(sourceRecord.callbackPotential * 0.68 + 0.32),
      emotionalCharge: clamp01(sourceRecord.emotionalCharge * 0.72 + 0.18),
      legendValue: clamp01(sourceRecord.legendValue * 0.64 + 0.16),
      metadata: {
        ...sourceRecord.metadata,
        source: 'recordCallbackMemory',
        callbackFrom: sourceRecord.memoryId,
      },
    };
    this.storeRecord(callbackRecord);
    return callbackRecord;
  }

  public retrieveRelevantMemories(
    request: ConversationMemoryRetrievalRequest,
  ): ConversationMemoryRetrievalResult {
    const nowMs = request.nowMs ?? this.now();
    const roomRecords = this.index.byRoom.get(request.roomId) ?? [];
    const filtered = roomRecords.filter((record) => {
      if (request.ownerUserId && record.ownerUserId && request.ownerUserId !== record.ownerUserId) {
        return false;
      }
      if (request.counterpartUserId && record.counterpartUserId && request.counterpartUserId !== record.counterpartUserId) {
        return false;
      }
      if (request.desiredKinds?.length && !request.desiredKinds.includes(record.memoryKind)) {
        return false;
      }
      return true;
    });

    const sceneContext = request.sceneContext ?? {
      roomId: request.roomId,
      roomKind: request.roomKind,
      channel: request.activeChannel,
      pressureTier: null,
      activeModeId: request.modeId ?? null,
      sovereigntyProximity: 0.5,
      publicWitnessHeat: 0.5,
      helperUrgency: 0.5,
      haterPressure: 0.5,
      toxicityRisk: 0.5,
      churnRisk: 0.5,
      notes: [],
    } as EmbeddingSceneContext;

    const queryEmbedding = this.embeddingClient.embedMessage({
      text: request.queryText,
      sceneContext,
    });

    const scored = filtered
      .map((record) => this.scoreRetrievedRecord(record, queryEmbedding, request, nowMs))
      .sort((a, b) => b.normalizedScore - a.normalizedScore)
      .slice(0, request.maxResults ?? CHAT_CONVERSATION_MEMORY_DEFAULTS.maxRetrievals);

    return {
      modelVersion: CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
      queryText: request.queryText,
      results: scored,
      summary: this.buildRetrievalSummary(request, scored),
      computedAt: nowMs,
    };
  }

  public closeSceneWindow(
    roomId: ChatRoomId,
    ownerUserId: Nullable<ChatUserId>,
    nowMs: UnixMs = this.now(),
  ): Nullable<ConversationMemoryRecord> {
    const key = this.buildWindowKey(roomId, ownerUserId);
    const window = this.activeWindows.get(key);
    if (!window || !window.turns.length) {
      return null;
    }

    window.closedAt = nowMs;

    const summaryRecord = this.compressWindowToSceneSummary(window, nowMs);
    this.activeWindows.delete(key);
    this.storeRecord(summaryRecord);
    return summaryRecord;
  }

  public compactRoom(
    roomId: ChatRoomId,
    ownerUserId: Nullable<ChatUserId> = null,
    nowMs: UnixMs = this.now(),
  ): ConversationMemoryRecord[] {
    const records = this.index.byRoom.get(roomId) ?? [];
    const eligible = records
      .filter((record) =>
        ownerUserId == null || record.ownerUserId == null || record.ownerUserId === ownerUserId,
      )
      .sort((a, b) => a.createdAt - b.createdAt);

    if (eligible.length < CHAT_CONVERSATION_MEMORY_DEFAULTS.compactionWindowSize) {
      return [];
    }

    const compacted: ConversationMemoryRecord[] = [];
    for (let offset = 0; offset < eligible.length; offset += CHAT_CONVERSATION_MEMORY_DEFAULTS.compactionWindowSize) {
      const slice = eligible.slice(offset, offset + CHAT_CONVERSATION_MEMORY_DEFAULTS.compactionWindowSize);
      if (slice.length < 2) {
        continue;
      }
      compacted.push(this.compressRecords(roomId, slice, nowMs));
    }
    for (const record of compacted) {
      this.storeRecord(record);
    }
    return compacted;
  }

  public decayAll(nowMs: UnixMs = this.now()): void {
    for (const [roomId, records] of this.index.byRoom.entries()) {
      const kept = records.filter((record) => this.computeRetention(record, nowMs) >= CHAT_CONVERSATION_MEMORY_DEFAULTS.minimumRetentionThreshold);
      this.index.byRoom.set(roomId, kept);
    }

    for (const [userKey, records] of this.index.byUser.entries()) {
      const kept = records.filter((record) => this.computeRetention(record, nowMs) >= CHAT_CONVERSATION_MEMORY_DEFAULTS.minimumRetentionThreshold);
      this.index.byUser.set(userKey, kept);
    }

    for (const [messageId, records] of this.index.byMessageId.entries()) {
      const kept = records.filter((record) => this.computeRetention(record, nowMs) >= CHAT_CONVERSATION_MEMORY_DEFAULTS.minimumRetentionThreshold);
      if (kept.length) {
        this.index.byMessageId.set(messageId, kept);
      } else {
        this.index.byMessageId.delete(messageId);
      }
    }
  }


  /**
   * scoreShockMemory
   * --------------------------------------------------------------------------
   * Captures sudden, scene-defining impact that should remain retrievable.
   */
  private scoreShockMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'shock');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'shock');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'shock');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreRelationalMemory
   * --------------------------------------------------------------------------
   * Captures relationship-bearing memory between player, helper, hater, and room.
   */
  private scoreRelationalMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'relational');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'relational');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'relational');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreStrategicMemory
   * --------------------------------------------------------------------------
   * Captures bluff, negotiation, counterplay, and tactical state-bearing memory.
   */
  private scoreStrategicMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'strategic');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'strategic');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'strategic');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreEmotionalMemory
   * --------------------------------------------------------------------------
   * Captures embarrassment, confidence, relief, fear, contempt, and trust.
   */
  private scoreEmotionalMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'emotional');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'emotional');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'emotional');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreWitnessMemory
   * --------------------------------------------------------------------------
   * Captures public witness value for callbacks and legend-worthy receipts.
   */
  private scoreWitnessMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'witness');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'witness');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'witness');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreContinuityMemory
   * --------------------------------------------------------------------------
   * Captures how much this moment should persist across future scenes.
   */
  private scoreContinuityMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'continuity');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'continuity');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'continuity');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreRecoveryMemory
   * --------------------------------------------------------------------------
   * Captures whether this moment matters for helper rescue and recovery state.
   */
  private scoreRecoveryMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'recovery');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'recovery');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'recovery');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreLegendMemory
   * --------------------------------------------------------------------------
   * Captures comeback / collapse / sovereignty / humiliation importance.
   */
  private scoreLegendMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'legend');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'legend');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'legend');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scorePersonaMemory
   * --------------------------------------------------------------------------
   * Captures whether a specific persona’s voiceprint should remember this moment.
   */
  private scorePersonaMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'persona');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'persona');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'persona');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }

  /**
   * scoreReplayMemory
   * --------------------------------------------------------------------------
   * Captures replay and proof-chain usefulness.
   */
  private scoreReplayMemory(
    record: ConversationMemoryRecord,
    context: ConversationMemoryContext,
  ): Score01 {
    const recency = this.computeRecencyWeight(record.updatedAt, context.nowMs);
    const roomWeight = this.lookupRoomMemoryWeight(record.roomKind, 'replay');
    const channelWeight = this.lookupChannelMemoryWeight(record.channel, 'replay');
    const modeWeight = this.lookupModeMemoryWeight(record.modeId, 'replay');
    const signalWeight = clamp01(record.signalStrength * 0.65 + record.eventDensity * 0.35);
    const relationWeight = clamp01(record.relationshipHeat * 0.55 + record.callbackPotential * 0.45);
    return clamp01(
      recency * 0.16 +
      roomWeight * 0.12 +
      channelWeight * 0.08 +
      modeWeight * 0.08 +
      signalWeight * 0.28 +
      relationWeight * 0.28
    );
  }


  private scoreRetrievedRecord(
    record: ConversationMemoryRecord,
    queryVector: EmbeddingVector,
    request: ConversationMemoryRetrievalRequest,
    nowMs: UnixMs,
  ): RetrievedConversationMemory {
    const similarityScore: Score01 = record.embeddingVector
      ? this.embeddingClient.cosineSimilarity(queryVector, record.embeddingVector).clipped01
      : clamp01(0.24);

    const context: ConversationMemoryContext = {
      roomId: request.roomId,
      roomKind: request.roomKind,
      sessionId: null,
      ownerUserId: request.ownerUserId ?? null,
      counterpartUserId: request.counterpartUserId ?? null,
      activeChannel: request.activeChannel,
      modeId: request.modeId ?? null,
      nowMs,
      pressureTier: null,
      publicWitnessHeat: clamp01(0.5),
      helperUrgency: clamp01(0.5),
      haterPressure: clamp01(0.5),
      toxicityRisk: clamp01(0.5),
      churnRisk: clamp01(0.5),
    };

    const salience = clamp01(
      this.scoreShockMemory(record, context) * 0.12 +
      this.scoreRelationalMemory(record, context) * 0.12 +
      this.scoreStrategicMemory(record, context) * 0.11 +
      this.scoreEmotionalMemory(record, context) * 0.11 +
      this.scoreWitnessMemory(record, context) * 0.08 +
      this.scoreContinuityMemory(record, context) * 0.1 +
      this.scoreRecoveryMemory(record, context) * 0.08 +
      this.scoreLegendMemory(record, context) * 0.1 +
      this.scorePersonaMemory(record, context) * 0.08 +
      this.scoreReplayMemory(record, context) * 0.1
    );

    const recency = this.computeRecencyWeight(record.updatedAt, nowMs);
    const relationshipWeight = clamp01(record.relationshipHeat * 0.62 + record.continuityValue * 0.38);
    const replayWeight = clamp01(record.replayValue * 0.72 + record.witnessValue * 0.28);
    const callbackWeight = clamp01(record.callbackPotential * 0.72 + record.legendValue * 0.28);

    const normalizedScore = clamp01(
      similarityScore * 0.28 +
      salience * 0.22 +
      recency * 0.12 +
      relationshipWeight * 0.14 +
      replayWeight * 0.12 +
      callbackWeight * 0.12
    );

    return {
      memoryId: record.memoryId,
      roomId: record.roomId,
      ownerUserId: record.ownerUserId,
      counterpartUserId: record.counterpartUserId,
      kind: record.memoryKind,
      score: clamp100(normalizedScore * 100),
      normalizedScore,
      salience,
      recency,
      relationshipWeight,
      replayWeight,
      callbackWeight,
      title: record.title,
      summary: record.summary,
      sourceMessageIds: [...record.sourceMessageIds],
      callbackQuoteIds: [...record.callbackQuoteIds],
      metadata: {
        ...record.metadata,
        similarity: similarityScore,
        retention: this.computeRetention(record, nowMs),
      },
    };
  }

  private appendToCompressionWindow(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): void {
    const key = this.buildWindowKey(turn.roomId, context.ownerUserId);
    const window =
      this.activeWindows.get(key) ??
      {
        roomId: turn.roomId,
        roomKind: turn.roomKind,
        ownerUserId: context.ownerUserId,
        counterpartUserId: context.counterpartUserId,
        modeId: context.modeId,
        channel: turn.channel,
        openedAt: turn.createdAt,
        closedAt: turn.createdAt,
        turns: [],
      };
    window.turns.push(turn);
    window.closedAt = turn.createdAt;
    this.activeWindows.set(key, window);
  }

  private compactIfNeeded(
    roomId: ChatRoomId,
    ownerUserId: Nullable<ChatUserId>,
  ): void {
    const key = this.buildWindowKey(roomId, ownerUserId);
    const window = this.activeWindows.get(key);
    if (!window) {
      return;
    }
    if (window.turns.length >= CHAT_CONVERSATION_MEMORY_DEFAULTS.compactionWindowSize) {
      this.closeSceneWindow(roomId, ownerUserId);
    }
  }

  private compressWindowToSceneSummary(
    window: SceneCompressionWindow,
    nowMs: UnixMs,
  ): ConversationMemoryRecord {
    const body = window.turns.map((turn) => turn.body).join('\n');
    const summary = this.buildSceneSummary(window.turns);
    const semanticFamilies = Array.from(new Set(window.turns.flatMap((turn) => turn.semanticFamilies ?? [])));
    const sourceMessageIds = window.turns.map((turn) => turn.messageId);

    const embeddingVector = this.embeddingClient.embedTranscriptWindow({
      messages: window.turns.map((turn) => ({
        messageId: turn.messageId,
        text: turn.body,
        channel: turn.channel,
      })),
      sceneContext: {
        roomId: window.roomId,
        roomKind: window.roomKind,
        channel: window.channel,
        pressureTier: null,
        activeModeId: window.modeId ?? null,
        sovereigntyProximity: 0.5,
        publicWitnessHeat: 0.5,
        helperUrgency: 0.5,
        haterPressure: 0.5,
        toxicityRisk: 0.5,
        churnRisk: 0.5,
        notes: [],
      } as EmbeddingSceneContext,
    });

    return {
      memoryId: `memory::scene::${window.roomId}::${window.openedAt}::${window.closedAt}`,
      roomId: window.roomId,
      roomKind: window.roomKind,
      sessionId: null,
      ownerUserId: window.ownerUserId,
      counterpartUserId: window.counterpartUserId,
      modeId: window.modeId,
      channel: window.channel,
      memoryKind: 'scene_summary',
      intentKind: null,
      semanticFamilies,
      sourceMessageIds,
      callbackQuoteIds: [],
      title: `Scene summary — ${window.channel}`,
      body,
      summary,
      createdAt: window.openedAt,
      updatedAt: nowMs,
      signalStrength: clamp01(this.aggregate(window.turns.map((turn) => turn.signalStrength ?? 0.5))),
      eventDensity: clamp01(window.turns.length / CHAT_CONVERSATION_MEMORY_DEFAULTS.compactionWindowSize),
      relationshipHeat: clamp01(this.aggregate(window.turns.map((turn) => turn.threatValue ?? 0.2)) * 0.4 + this.aggregate(window.turns.map((turn) => turn.rescueValue ?? 0.2)) * 0.6),
      callbackPotential: clamp01(0.2 + this.aggregate(window.turns.map((turn) => turn.legendValue ?? 0.2)) * 0.5),
      witnessValue: clamp01(this.aggregate(window.turns.map((turn) => turn.witnessValue ?? 0.3))),
      replayValue: clamp01(0.3 + this.aggregate(window.turns.map((turn) => turn.signalStrength ?? 0.5)) * 0.4),
      rescueValue: clamp01(this.aggregate(window.turns.map((turn) => turn.rescueValue ?? 0.2))),
      threatValue: clamp01(this.aggregate(window.turns.map((turn) => turn.threatValue ?? 0.2))),
      negotiationValue: clamp01(this.aggregate(window.turns.map((turn) => turn.negotiationValue ?? 0.2))),
      legendValue: clamp01(this.aggregate(window.turns.map((turn) => turn.legendValue ?? 0.2))),
      emotionalCharge: clamp01(this.aggregate(window.turns.map((turn) => turn.emotionalCharge ?? 0.2))),
      continuityValue: clamp01(0.4 + Math.min(window.turns.length, 8) / 12),
      decayMultiplier: clamp01(0.82),
      embeddingVector,
      metadata: {
        source: 'compressWindowToSceneSummary',
        modelVersion: CHAT_CONVERSATION_MEMORY_MODEL_VERSION,
      },
    };
  }

  private compressRecords(
    roomId: ChatRoomId,
    records: readonly ConversationMemoryRecord[],
    nowMs: UnixMs,
  ): ConversationMemoryRecord {
    const first = records[0];
    const last = records[records.length - 1];
    const sourceMessageIds = Array.from(new Set(records.flatMap((record) => record.sourceMessageIds)));
    const semanticFamilies = Array.from(new Set(records.flatMap((record) => record.semanticFamilies)));
    const title = `Compressed memory cluster — ${first.channel}`;
    const summary = records.map((record) => record.summary).join(' | ');
    const body = records.map((record) => record.body).join('\n');

    return {
      memoryId: `memory::cluster::${roomId}::${first.createdAt}::${last.updatedAt}`,
      roomId,
      roomKind: first.roomKind,
      sessionId: first.sessionId,
      ownerUserId: first.ownerUserId,
      counterpartUserId: first.counterpartUserId,
      modeId: first.modeId,
      channel: first.channel,
      memoryKind: 'window',
      intentKind: first.intentKind,
      semanticFamilies,
      sourceMessageIds,
      callbackQuoteIds: Array.from(new Set(records.flatMap((record) => record.callbackQuoteIds))),
      title,
      body,
      summary,
      createdAt: first.createdAt,
      updatedAt: nowMs,
      signalStrength: clamp01(this.aggregate(records.map((record) => record.signalStrength))),
      eventDensity: clamp01(this.aggregate(records.map((record) => record.eventDensity))),
      relationshipHeat: clamp01(this.aggregate(records.map((record) => record.relationshipHeat))),
      callbackPotential: clamp01(this.aggregate(records.map((record) => record.callbackPotential))),
      witnessValue: clamp01(this.aggregate(records.map((record) => record.witnessValue))),
      replayValue: clamp01(this.aggregate(records.map((record) => record.replayValue))),
      rescueValue: clamp01(this.aggregate(records.map((record) => record.rescueValue))),
      threatValue: clamp01(this.aggregate(records.map((record) => record.threatValue))),
      negotiationValue: clamp01(this.aggregate(records.map((record) => record.negotiationValue))),
      legendValue: clamp01(this.aggregate(records.map((record) => record.legendValue))),
      emotionalCharge: clamp01(this.aggregate(records.map((record) => record.emotionalCharge))),
      continuityValue: clamp01(this.aggregate(records.map((record) => record.continuityValue))),
      decayMultiplier: clamp01(this.aggregate(records.map((record) => record.decayMultiplier))),
      embeddingVector: records[0].embeddingVector,
      metadata: {
        source: 'compressRecords',
        compressedCount: records.length,
      },
    };
  }

  private storeRecord(record: ConversationMemoryRecord): void {
    const roomRecords = this.index.byRoom.get(record.roomId) ?? [];
    roomRecords.push(record);
    this.index.byRoom.set(record.roomId, this.trimNewest(roomRecords, CHAT_CONVERSATION_MEMORY_DEFAULTS.maxRecordsPerRoom));

    const userKey = this.buildUserKey(record.ownerUserId, record.roomId);
    const userRecords = this.index.byUser.get(userKey) ?? [];
    userRecords.push(record);
    this.index.byUser.set(userKey, this.trimNewest(userRecords, CHAT_CONVERSATION_MEMORY_DEFAULTS.maxRecordsPerUser));

    for (const messageId of record.sourceMessageIds) {
      const existing = this.index.byMessageId.get(messageId) ?? [];
      existing.push(record);
      this.index.byMessageId.set(messageId, existing);
    }
  }

  private resolveTurnMemoryKind(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): ConversationMemoryKind {
    if ((turn.legendValue ?? 0) >= 0.72) {
      return 'legend';
    }
    if ((turn.rescueValue ?? 0) >= 0.72) {
      return 'rescue';
    }
    if ((turn.threatValue ?? 0) >= 0.72) {
      return 'threat';
    }
    if ((turn.negotiationValue ?? 0) >= 0.72) {
      return 'negotiation';
    }
    if ((turn.witnessValue ?? 0) >= 0.74) {
      return 'proof';
    }
    return 'turn';
  }

  private buildTurnTitle(
    turn: ConversationMemoryTurn,
    intentKind: Nullable<DialogueIntentKind>,
  ): string {
    if (intentKind) {
      return `Memory — ${intentKind}`;
    }
    return `Memory — ${turn.channel} turn`;
  }

  private buildTurnSummary(
    turn: ConversationMemoryTurn,
    intentKind: Nullable<DialogueIntentKind>,
    context: ConversationMemoryContext,
  ): string {
    const prefix = intentKind ? `${intentKind}:` : 'Turn:';
    return `${prefix} ${turn.body.slice(0, 160)}`;
  }

  private buildSceneSummary(
    turns: readonly ConversationMemoryTurn[],
  ): string {
    const joined = turns.map((turn) => turn.body.trim()).filter(Boolean);
    if (!joined.length) {
      return 'Scene carried no textual content.';
    }
    if (joined.length === 1) {
      return joined[0].slice(0, 240);
    }
    const first = joined[0].slice(0, 90);
    const last = joined[joined.length - 1].slice(0, 90);
    return `Scene opened with "${first}" and resolved toward "${last}".`;
  }

  private buildRetrievalSummary(
    request: ConversationMemoryRetrievalRequest,
    results: readonly RetrievedConversationMemory[],
  ): string {
    if (!results.length) {
      return 'No memory anchors cleared retrieval threshold for the query.';
    }
    const top = results[0];
    return `Top memory kind ${top.kind} scored ${top.score.toFixed(1)} for query "${request.queryText.slice(0, 80)}".`;
  }

  private embedTurn(
    turn: ConversationMemoryTurn,
    sceneContext: EmbeddingSceneContext,
  ): Nullable<EmbeddingVector> {
    const embedded = this.embeddingClient.embedMessage({
      messageId: turn.messageId,
      text: turn.body,
      createdAtMs: turn.createdAt,
      channel: turn.channel,
      roomKind: turn.roomKind,
      modeId: turn.modeId ?? null,
      pressureTier: turn.pressureTier ?? null,
      sceneContext,
    });
    return embedded;
  }

  private buildSceneContext(
    context: ConversationMemoryContext,
  ): EmbeddingSceneContext {
    return {
      roomId: context.roomId,
      roomKind: context.roomKind,
      channel: context.activeChannel,
      pressureTier: context.pressureTier ?? null,
      activeModeId: context.modeId ?? null,
      sovereigntyProximity: 0.5,
      publicWitnessHeat: context.publicWitnessHeat,
      helperUrgency: context.helperUrgency,
      haterPressure: context.haterPressure,
      toxicityRisk: context.toxicityRisk,
      churnRisk: context.churnRisk,
      notes: [...(context.sceneNotes ?? [])],
    } as EmbeddingSceneContext;
  }

  private estimateSignalStrength(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      0.2 +
      (turn.body.length > 120 ? 0.1 : 0.04) +
      context.publicWitnessHeat * 0.14 +
      context.haterPressure * 0.1 +
      context.helperUrgency * 0.08 +
      context.toxicityRisk * 0.06
    );
  }

  private estimateEventDensity(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      0.24 +
      context.publicWitnessHeat * 0.1 +
      context.haterPressure * 0.1 +
      context.helperUrgency * 0.1 +
      context.churnRisk * 0.08
    );
  }

  private estimateRelationshipHeat(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      (turn.threatValue ?? 0.2) * 0.42 +
      (turn.rescueValue ?? 0.2) * 0.34 +
      (turn.negotiationValue ?? 0.2) * 0.12 +
      context.publicWitnessHeat * 0.12
    );
  }

  private estimateCallbackPotential(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    const quotesLike = /\b(always|never|easy|watch me|remember this|i told you)\b/i.test(turn.body);
    return clamp01(
      (quotesLike ? 0.32 : 0.12) +
      (turn.legendValue ?? 0.2) * 0.22 +
      (turn.threatValue ?? 0.2) * 0.18 +
      context.publicWitnessHeat * 0.12
    );
  }

  private estimateWitnessValue(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      0.16 +
      context.publicWitnessHeat * 0.42 +
      (turn.legendValue ?? 0.2) * 0.18 +
      (turn.threatValue ?? 0.2) * 0.14
    );
  }

  private estimateReplayValue(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      0.18 +
      (turn.signalStrength ?? 0.5) * 0.22 +
      (turn.legendValue ?? 0.2) * 0.16 +
      context.publicWitnessHeat * 0.14 +
      context.haterPressure * 0.1
    );
  }

  private estimateRescueValue(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      context.helperUrgency * 0.36 +
      context.churnRisk * 0.26 +
      (/\b(help|wait|hold on|breathe|reset|recover|steady)\b/i.test(turn.body) ? 0.18 : 0.04)
    );
  }

  private estimateThreatValue(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      context.haterPressure * 0.34 +
      context.publicWitnessHeat * 0.12 +
      (/\b(lose|broke|weak|fold|liar|fraud|finished|collapse)\b/i.test(turn.body) ? 0.2 : 0.05)
    );
  }

  private estimateNegotiationValue(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      (context.activeChannel === 'DEAL_ROOM' ? 0.28 : 0.06) +
      (/\b(offer|price|deal|counter|terms|bluff|pay|sell|buy)\b/i.test(turn.body) ? 0.26 : 0.04)
    );
  }

  private estimateLegendValue(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      context.publicWitnessHeat * 0.18 +
      context.haterPressure * 0.1 +
      (/\b(sovereignty|comeback|perfect|clutch|miracle|all in|last turn)\b/i.test(turn.body) ? 0.34 : 0.08)
    );
  }

  private estimateEmotionalCharge(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      context.toxicityRisk * 0.18 +
      context.churnRisk * 0.18 +
      context.haterPressure * 0.12 +
      (/!{2,}|\?{2,}|\b(please|stop|fine|whatever|watch|breathe|coward|sorry)\b/i.test(turn.body) ? 0.22 : 0.06)
    );
  }

  private estimateContinuityValue(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    return clamp01(
      0.22 +
      (turn.semanticFamilies?.length ? Math.min(turn.semanticFamilies.length, 4) / 10 : 0.04) +
      (turn.modeId === context.modeId ? 0.14 : 0.04)
    );
  }

  private resolveDecayMultiplier(
    turn: ConversationMemoryTurn,
    context: ConversationMemoryContext,
  ): Score01 {
    if ((turn.legendValue ?? 0) >= 0.72) {
      return clamp01(0.96);
    }
    if ((turn.rescueValue ?? 0) >= 0.72 || (turn.threatValue ?? 0) >= 0.72) {
      return clamp01(0.9);
    }
    return clamp01(0.78);
  }

  private computeRecencyWeight(
    updatedAt: UnixMs,
    nowMs: UnixMs,
  ): Score01 {
    const elapsed = Math.max(0, nowMs - updatedAt);
    return clamp01(Math.exp(-elapsed / CHAT_CONVERSATION_MEMORY_DEFAULTS.decayHalfLifeMs));
  }

  private computeRetention(
    record: ConversationMemoryRecord,
    nowMs: UnixMs,
  ): Score01 {
    const elapsed = Math.max(0, nowMs - record.updatedAt);
    const halfLife =
      record.memoryKind === 'legend'
        ? CHAT_CONVERSATION_MEMORY_DEFAULTS.legendDecayHalfLifeMs
        : record.memoryKind === 'relationship'
          ? CHAT_CONVERSATION_MEMORY_DEFAULTS.relationshipDecayHalfLifeMs
          : CHAT_CONVERSATION_MEMORY_DEFAULTS.decayHalfLifeMs;
    const ageWeight = clamp01(Math.exp(-elapsed / halfLife));
    const salience =
      record.signalStrength * 0.12 +
      record.relationshipHeat * 0.12 +
      record.callbackPotential * 0.12 +
      record.witnessValue * 0.08 +
      record.replayValue * 0.1 +
      record.rescueValue * 0.1 +
      record.threatValue * 0.1 +
      record.negotiationValue * 0.08 +
      record.legendValue * 0.1 +
      record.emotionalCharge * 0.08;
    return clamp01(clamp01(ageWeight * 0.62 + salience * 0.38) * record.decayMultiplier);
  }

  private aggregate(values: readonly number[]): number {
    if (!values.length) {
      return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private trimNewest<T extends { updatedAt: UnixMs }>(
    values: readonly T[],
    max: number,
  ): T[] {
    return [...values]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, max);
  }

  private buildWindowKey(
    roomId: ChatRoomId,
    ownerUserId: Nullable<ChatUserId>,
  ): string {
    return `${roomId}::${ownerUserId ?? 'anonymous'}`;
  }

  private buildUserKey(
    ownerUserId: Nullable<ChatUserId>,
    roomId: ChatRoomId,
  ): string {
    return `${ownerUserId ?? 'anonymous'}::${roomId}`;
  }

  private lookupRoomMemoryWeight(
    roomKind: ChatRoomKind,
    dimension: string,
  ): Score01 {
    switch (roomKind) {
      case 'GLOBAL':
        return clamp01(dimension === 'witness' || dimension === 'legend' ? 0.84 : 0.58);
      case 'DEAL_ROOM':
        return clamp01(dimension === 'strategic' || dimension === 'continuity' ? 0.84 : 0.56);
      case 'SYNDICATE':
        return clamp01(dimension === 'relational' || dimension === 'persona' ? 0.82 : 0.58);
      case 'LOBBY':
        return clamp01(dimension === 'recovery' || dimension === 'witness' ? 0.74 : 0.56);
      default:
        return clamp01(0.58);
    }
  }

  private lookupChannelMemoryWeight(
    channel: ChatVisibleChannel,
    dimension: string,
  ): Score01 {
    switch (channel) {
      case 'GLOBAL':
        return clamp01(dimension === 'witness' || dimension === 'legend' ? 0.86 : 0.56);
      case 'DEAL_ROOM':
        return clamp01(dimension === 'strategic' ? 0.88 : 0.54);
      case 'SYNDICATE':
        return clamp01(dimension === 'relational' || dimension === 'persona' ? 0.82 : 0.56);
      case 'LOBBY':
        return clamp01(dimension === 'recovery' ? 0.76 : 0.56);
      default:
        return clamp01(0.56);
    }
  }

  private lookupModeMemoryWeight(
    modeId: Nullable<string>,
    dimension: string,
  ): Score01 {
    if (!modeId) {
      return clamp01(0.58);
    }
    const normalized = modeId.toLowerCase();
    if (normalized.includes('battle')) {
      return clamp01(dimension === 'shock' || dimension === 'legend' ? 0.86 : 0.58);
    }
    if (normalized.includes('deal')) {
      return clamp01(dimension === 'strategic' ? 0.88 : 0.56);
    }
    if (normalized.includes('lobby')) {
      return clamp01(dimension === 'recovery' || dimension === 'continuity' ? 0.74 : 0.56);
    }
    if (normalized.includes('syndicate')) {
      return clamp01(dimension === 'relational' || dimension === 'persona' ? 0.82 : 0.58);
    }
    return clamp01(0.58);
  }
}

// ============================================================================
// MARK: Factory helpers
// ============================================================================

export function createConversationMemoryModel(
  deps: ConversationMemoryModelDependencies = {},
): ConversationMemoryModel {
  return new ConversationMemoryModel(deps);
}

export function ingestBackendChatMemoryTurn(
  turn: ConversationMemoryTurn,
  context: ConversationMemoryContext,
  deps: ConversationMemoryModelDependencies = {},
): ConversationMemoryRecord {
  return createConversationMemoryModel(deps).ingestAcceptedTurn(turn, context);
}

export function retrieveBackendConversationMemories(
  request: ConversationMemoryRetrievalRequest,
  deps: ConversationMemoryModelDependencies = {},
): ConversationMemoryRetrievalResult {
  return createConversationMemoryModel(deps).retrieveRelevantMemories(request);
}
