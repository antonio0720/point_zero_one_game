
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT MESSAGE FACTORY
 * FILE: backend/src/game/engine/chat/ChatMessageFactory.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend message construction for the authoritative chat lane.
 *
 * This file exists because transcript truth must not be assembled ad hoc inside
 * transport, policy, reducers, or UI mirrors. A message entering backend truth
 * needs a single authored factory that:
 *
 * 1. resolves room / sequence / attribution authority,
 * 2. applies moderated text and command metadata coherently,
 * 3. stamps proof, replay, learning, and causal references consistently,
 * 4. constructs visible and shadow messages without shape drift,
 * 5. gives NPC/helper/hater/liveops/system lines one canonical backend format,
 * 6. can be extracted into its own lane without changing message contracts.
 *
 * Design law
 * ----------
 * - The factory does not decide whether a message is allowed.
 * - Policy decides. The factory stamps the approved outcome.
 * - The factory does not write transcript state.
 * - The ledger writes transcript state.
 * - The factory does not own sockets, React, or client hints as truth.
 * - The factory may accept hints, but only as metadata when policy allows.
 *
 * Architectural fit
 * -----------------
 * This module is intentionally richer than a naive “create message” helper.
 * It is the backend boundary where dramaturgy, proof, replay, learning, shadow
 * lanes, negotiation, callback memory, and authored persona voiceprints become
 * transcript-grade structures instead of loose strings.
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_RUNTIME_DEFAULTS,
  asSequenceNumber,
  asUnixMs,
  clamp01,
  isVisibleChannelId,
  type BotId,
  type ChatAffectSnapshot,
  type ChatChannelId,
  type ChatCommandExecution,
  type ChatEventId,
  type ChatInferenceId,
  type ChatInferenceSource,
  type ChatJoinRequest,
  type ChatLegendId,
  type ChatLearningProfile,
  type ChatMessage,
  type ChatMessageAttribution,
  type ChatMessageBodyPart,
  type ChatMessageId,
  type ChatMessageLearningMetadata,
  type ChatMessagePolicyMetadata,
  type ChatMessageProofMetadata,
  type ChatMessageReplayMetadata,
  type ChatModerationDecision,
  type ChatModerationOutcome,
  type ChatMomentId,
  type ChatNpcRole,
  type ChatPendingRequestState,
  type ChatPendingReveal,
  type ChatPersonaDescriptor,
  type ChatPersonaId,
  type ChatPlayerMessageSubmitRequest,
  type ChatProofHash,
  type ChatRateDecision,
  type ChatRateOutcome,
  type ChatReplayId,
  type ChatRequestId,
  type ChatRoomId,
  type ChatRoomState,
  type ChatRuntimeConfig,
  type ChatSceneId,
  type ChatSessionId,
  type ChatSessionState,
  type ChatSignalEnvelope,
  type ChatSourceType,
  type ChatVisibleChannel,
  type ChatState,
  type JsonValue,
  type Score01,
  type SequenceNumber,
  type UnixMs,
} from './types';
import {
  nextSequenceForRoom,
  selectLatestMessage,
  selectRelationshipForActor,
  selectRoom,
  selectRoomTranscript,
  selectSession,
} from './ChatState';

// ============================================================================
// MARK: Factory ports and context surfaces
// ============================================================================

export interface ChatMessageFactoryClockPort {
  now(): number;
}

export interface ChatMessageFactoryIdPort {
  messageId(prefix?: string): ChatMessageId;
}

export interface ChatMessageFactoryHashPort {
  hash(input: string): ChatProofHash;
}

export interface ChatMessageFactoryPorts {
  readonly clock: ChatMessageFactoryClockPort;
  readonly ids: ChatMessageFactoryIdPort;
  readonly hash: ChatMessageFactoryHashPort;
}

export interface ChatMessageFactoryOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly ports?: Partial<ChatMessageFactoryPorts>;
}

export interface ChatMessageFactoryContext {
  readonly state: ChatState;
  readonly runtime: ChatRuntimeConfig;
  readonly ports: ChatMessageFactoryPorts;
}

const DEFAULT_CLOCK: ChatMessageFactoryClockPort = {
  now: () => Date.now(),
};

const DEFAULT_IDS: ChatMessageFactoryIdPort = {
  messageId: (prefix = 'msg') => `${prefix}_${Date.now()}_${randomBase36(10)}` as ChatMessageId,
};

const DEFAULT_HASH: ChatMessageFactoryHashPort = {
  hash: (input: string) => fnv1a32(input) as ChatProofHash,
};

const DEFAULT_PORTS: ChatMessageFactoryPorts = {
  clock: DEFAULT_CLOCK,
  ids: DEFAULT_IDS,
  hash: DEFAULT_HASH,
};

// ============================================================================
// MARK: Shared internal construction shapes
// ============================================================================

export interface ChatMessageCoreSeed {
  readonly state: ChatState;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly now?: UnixMs;
  readonly sequenceNumber?: SequenceNumber;
  readonly causeEventId?: ChatEventId | null;
  readonly causalParentMessageIds?: readonly ChatMessageId[];
  readonly causalParentEventIds?: readonly ChatEventId[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
  readonly tags?: readonly string[];
}

export interface ChatAttributionSeed {
  readonly sourceType: ChatSourceType;
  readonly authorSessionId: ChatSessionId | null;
  readonly authorUserId: ChatSessionState['identity']['userId'] | null;
  readonly actorId: string;
  readonly displayName: string;
  readonly npcRole: ChatNpcRole | null;
  readonly botId: BotId | null;
}

export interface ChatPolicySeed {
  readonly moderationOutcome: ChatModerationOutcome;
  readonly moderationReasons?: readonly string[];
  readonly rateOutcome: ChatRateOutcome;
  readonly commandName?: string | null;
  readonly shadowOnly?: boolean;
  readonly wasRewritten?: boolean;
  readonly wasMasked?: boolean;
}

export interface ChatReplaySeed {
  readonly replayId?: ChatReplayId | null;
  readonly replayAnchorKey?: string | null;
  readonly sceneId?: ChatSceneId | null;
  readonly momentId?: ChatMomentId | null;
  readonly legendId?: ChatLegendId | null;
}

export interface ChatLearningSeed {
  readonly learningTriggered?: boolean;
  readonly affectAfterMessage?: ChatAffectSnapshot | null;
  readonly inferenceSource?: ChatInferenceSource;
  readonly inferenceId?: ChatInferenceId | null;
}

export interface ChatMessageConstructionSeed extends ChatMessageCoreSeed {
  readonly bodyParts: readonly ChatMessageBodyPart[];
  readonly attribution: ChatAttributionSeed;
  readonly policy: ChatPolicySeed;
  readonly replay?: ChatReplaySeed;
  readonly learning?: ChatLearningSeed;
}

export interface CreatePlayerMessageArgs extends ChatMessageCoreSeed {
  readonly session: ChatSessionState;
  readonly request: ChatPlayerMessageSubmitRequest;
  readonly effectiveText: string;
  readonly moderation: ChatModerationDecision;
  readonly rate: ChatRateDecision;
  readonly command: ChatCommandExecution;
  readonly clientHintsAccepted?: boolean;
  readonly replay?: ChatReplaySeed;
  readonly learning?: ChatLearningSeed;
}

export interface CreateSystemMessageArgs extends ChatMessageCoreSeed {
  readonly text: string;
  readonly sourceType?: Extract<ChatSourceType, 'SYSTEM' | 'SERVER' | 'MODERATION' | 'LIVEOPS'>;
  readonly actorId?: string;
  readonly displayName?: string;
  readonly bodyParts?: readonly ChatMessageBodyPart[];
  readonly replay?: ChatReplaySeed;
  readonly learning?: ChatLearningSeed;
}

export interface CreateNpcMessageArgs extends ChatMessageCoreSeed {
  readonly persona: ChatPersonaDescriptor;
  readonly text: string;
  readonly role: ChatNpcRole;
  readonly replay?: ChatReplaySeed;
  readonly learning?: ChatLearningSeed;
  readonly addSignature?: boolean;
  readonly quotingMessageId?: ChatMessageId | null;
  readonly quotingText?: string | null;
}

export interface CreateHelperInterventionMessageArgs extends CreateNpcMessageArgs {
  readonly rescueReason?: string;
  readonly recoveryWindowSuggested?: boolean;
}

export interface CreateHaterEscalationMessageArgs extends CreateNpcMessageArgs {
  readonly escalationTier?: 'SOFT' | 'MEDIUM' | 'HARD' | 'BOSS';
  readonly attackWindowOpen?: boolean;
}

export interface CreateDealRoomOfferMessageArgs extends ChatMessageCoreSeed {
  readonly session: ChatSessionState;
  readonly offerId: string;
  readonly summary: string;
  readonly negotiationText: string;
  readonly moderation?: ChatModerationDecision;
  readonly rate?: ChatRateDecision;
  readonly replay?: ChatReplaySeed;
  readonly learning?: ChatLearningSeed;
}

export interface CreateQuoteCallbackMessageArgs extends CreateNpcMessageArgs {
  readonly quotedMessageId: ChatMessageId;
  readonly quotedText: string;
}

export interface CreateLegendMomentMessageArgs extends ChatMessageCoreSeed {
  readonly text: string;
  readonly legendId: ChatLegendId;
  readonly sceneId?: ChatSceneId | null;
  readonly momentId?: ChatMomentId | null;
}

export interface CreateShadowAnnotationArgs extends ChatMessageCoreSeed {
  readonly text: string;
  readonly actorId?: string;
  readonly displayName?: string;
  readonly shadowTag: 'SYSTEM' | 'NPC' | 'RIVALRY' | 'RESCUE' | 'LIVEOPS';
}

export interface CreateCommandSystemMessagesArgs extends ChatMessageCoreSeed {
  readonly command: ChatCommandExecution;
}

export interface ReviseMessageTextArgs {
  readonly message: ChatMessage;
  readonly newText: string;
  readonly now?: UnixMs;
  readonly moderationOutcome?: ChatModerationOutcome;
  readonly moderationReasons?: readonly string[];
}

export interface RedactMessageArgs {
  readonly message: ChatMessage;
  readonly replacementText?: string;
  readonly now?: UnixMs;
  readonly reasons?: readonly string[];
}

export interface SoftDeleteMessageArgs {
  readonly message: ChatMessage;
  readonly now?: UnixMs;
}

export interface SceneMessagePlan {
  readonly text: string;
  readonly delayMs?: number;
  readonly tags?: readonly string[];
  readonly channelId?: ChatChannelId;
  readonly quotingMessageId?: ChatMessageId | null;
  readonly quotingText?: string | null;
  readonly replay?: ChatReplaySeed;
  readonly learning?: ChatLearningSeed;
}

export interface CreateSceneMessagesArgs extends ChatMessageCoreSeed {
  readonly persona: ChatPersonaDescriptor;
  readonly role: ChatNpcRole;
  readonly messages: readonly SceneMessagePlan[];
  readonly addSignature?: boolean;
  readonly replay?: ChatReplaySeed;
  readonly learning?: ChatLearningSeed;
}

export interface ChatBuiltSceneMessage {
  readonly delayMs: number;
  readonly message: ChatMessage;
}

export interface ChatMessageValidationIssue {
  readonly code:
    | 'EMPTY_BODY'
    | 'PLAIN_TEXT_MISMATCH'
    | 'INVALID_VISIBLE_CHANNEL'
    | 'REPLAY_CHANNEL_MISMATCH'
    | 'NEGATIVE_SEQUENCE'
    | 'INVALID_PROOF'
    | 'DELETED_WITHOUT_TIMESTAMP'
    | 'REDACTED_WITHOUT_TIMESTAMP';
  readonly severity: 'ERROR' | 'WARN';
  readonly detail: string;
}

// ============================================================================
// MARK: Factory bootstrap
// ============================================================================

export function createChatMessageFactory(options: ChatMessageFactoryOptions = {}) {
  const runtime: ChatRuntimeConfig = mergeRuntime(options.runtime);
  const ports: ChatMessageFactoryPorts = mergePorts(options.ports);

  const api = {
    runtime,
    ports,
    createContext(state: ChatState): ChatMessageFactoryContext {
      return { state, runtime, ports };
    },
    createCanonicalMessage(seed: ChatMessageConstructionSeed): ChatMessage {
      return createCanonicalMessage({ state: seed.state, runtime, ports }, seed);
    },
    createPlayerMessage(args: CreatePlayerMessageArgs): ChatMessage {
      return createPlayerMessage({ state: args.state, runtime, ports }, args);
    },
    createSystemMessage(args: CreateSystemMessageArgs): ChatMessage {
      return createSystemMessage({ state: args.state, runtime, ports }, args);
    },
    createNpcMessage(args: CreateNpcMessageArgs): ChatMessage {
      return createNpcMessage({ state: args.state, runtime, ports }, args);
    },
    createHelperInterventionMessage(args: CreateHelperInterventionMessageArgs): ChatMessage {
      return createHelperInterventionMessage({ state: args.state, runtime, ports }, args);
    },
    createHaterEscalationMessage(args: CreateHaterEscalationMessageArgs): ChatMessage {
      return createHaterEscalationMessage({ state: args.state, runtime, ports }, args);
    },
    createDealRoomOfferMessage(args: CreateDealRoomOfferMessageArgs): ChatMessage {
      return createDealRoomOfferMessage({ state: args.state, runtime, ports }, args);
    },
    createQuoteCallbackMessage(args: CreateQuoteCallbackMessageArgs): ChatMessage {
      return createQuoteCallbackMessage({ state: args.state, runtime, ports }, args);
    },
    createLegendMomentMessage(args: CreateLegendMomentMessageArgs): ChatMessage {
      return createLegendMomentMessage({ state: args.state, runtime, ports }, args);
    },
    createShadowAnnotation(args: CreateShadowAnnotationArgs): ChatMessage {
      return createShadowAnnotation({ state: args.state, runtime, ports }, args);
    },
    createCommandSystemMessages(args: CreateCommandSystemMessagesArgs): readonly ChatMessage[] {
      return createCommandSystemMessages({ state: args.state, runtime, ports }, args);
    },
    createSceneMessages(args: CreateSceneMessagesArgs): readonly ChatBuiltSceneMessage[] {
      return createSceneMessages({ state: args.state, runtime, ports }, args);
    },
    reviseMessageText(args: ReviseMessageTextArgs): ChatMessage {
      return reviseMessageText(ports, args);
    },
    redactMessage(args: RedactMessageArgs): ChatMessage {
      return redactMessage(ports, args);
    },
    softDeleteMessage(args: SoftDeleteMessageArgs): ChatMessage {
      return softDeleteMessage(args);
    },
    derivePendingReveal(revealAt: UnixMs, roomId: ChatRoomId, message: ChatMessage): ChatPendingReveal {
      return {
        revealAt,
        roomId,
        message,
      };
    },
    derivePendingRequest(
      requestId: ChatRequestId,
      roomId: ChatRoomId,
      sessionId: ChatSessionId,
      messageId: ChatMessageId,
      createdAt: UnixMs,
    ): ChatPendingRequestState {
      return {
        requestId,
        roomId,
        sessionId,
        messageId,
        createdAt,
      };
    },
    validateMessage(message: ChatMessage): readonly ChatMessageValidationIssue[] {
      return validateMessage(message);
    },
  };

  return api;
}

export type ChatMessageFactory = ReturnType<typeof createChatMessageFactory>;

// ============================================================================
// MARK: Canonical builders
// ============================================================================

export function createCanonicalMessage(
  context: ChatMessageFactoryContext,
  seed: ChatMessageConstructionSeed,
): ChatMessage {
  const room = requireRoom(context.state, seed.roomId);
  const sequenceNumber = seed.sequenceNumber ?? nextSequenceForRoom(context.state, seed.roomId);
  const now = seed.now ?? asUnixMs(context.ports.clock.now());
  const bodyParts = normalizeBodyParts(seed.bodyParts);
  const plainText = compilePlainText(bodyParts);
  const channelId = coerceMessageChannel(seed.channelId, seed.policy.shadowOnly === true);
  const proof = buildProofMetadata(context, {
    roomId: seed.roomId,
    sequenceNumber,
    plainText,
    channelId,
    attribution: seed.attribution,
    causeEventId: seed.causeEventId ?? null,
    causalParentMessageIds: seed.causalParentMessageIds ?? [],
    causalParentEventIds: seed.causalParentEventIds ?? [],
    bodyParts,
  });

  const policy: ChatMessagePolicyMetadata = {
    moderationOutcome: seed.policy.moderationOutcome,
    moderationReasons: seed.policy.moderationReasons ?? [],
    rateOutcome: seed.policy.rateOutcome,
    commandName: seed.policy.commandName ?? null,
    shadowOnly: seed.policy.shadowOnly ?? !CHAT_CHANNEL_DESCRIPTORS[channelId].visibleToPlayer,
    wasRewritten: seed.policy.wasRewritten ?? false,
    wasMasked: seed.policy.wasMasked ?? false,
  };

  const replay: ChatMessageReplayMetadata = {
    replayId: seed.replay?.replayId ?? null,
    replayAnchorKey: seed.replay?.replayAnchorKey ?? null,
    sceneId: seed.replay?.sceneId ?? null,
    momentId: seed.replay?.momentId ?? null,
    legendId: seed.replay?.legendId ?? null,
  };

  const learning: ChatMessageLearningMetadata = {
    learningTriggered: seed.learning?.learningTriggered ?? false,
    affectAfterMessage: seed.learning?.affectAfterMessage ?? null,
    inferenceSource: seed.learning?.inferenceSource ?? 'NONE',
    inferenceId: seed.learning?.inferenceId ?? null,
  };

  const message: ChatMessage = {
    id: context.ports.ids.messageId(selectPrefixForSource(seed.attribution.sourceType)),
    roomId: room.roomId,
    channelId,
    sequenceNumber,
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    redactedAt: null,
    bodyParts,
    plainText,
    attribution: freezeAttribution(seed.attribution),
    policy,
    replay,
    learning,
    proof,
    tags: uniqueStrings([...(seed.tags ?? []), ...deriveTagsFromMessage(room, channelId, plainText, bodyParts)]),
    metadata: freezeJsonObject(seed.metadata ?? {}),
  };

  return message;
}

export function createPlayerMessage(
  context: ChatMessageFactoryContext,
  args: CreatePlayerMessageArgs,
): ChatMessage {
  const acceptedHints = args.clientHintsAccepted ? filterJsonRecord(args.request.clientHints ?? {}) : undefined;
  const channelId = args.moderation.shadowOnly
    ? selectShadowMirrorForVisibleChannel(args.request.channelId)
    : args.request.channelId;

  const bodyParts = buildBodyPartsFromPlayerText(args.effectiveText);
  return createCanonicalMessage(context, {
    state: args.state,
    roomId: args.roomId,
    channelId,
    now: args.now,
    causeEventId: args.causeEventId ?? null,
    causalParentMessageIds: args.causalParentMessageIds,
    causalParentEventIds: args.causalParentEventIds,
    bodyParts,
    attribution: {
      sourceType: 'PLAYER',
      authorSessionId: args.session.identity.sessionId,
      authorUserId: args.session.identity.userId,
      actorId: `user:${args.session.identity.userId}`,
      displayName: args.session.identity.displayName,
      npcRole: null,
      botId: null,
    },
    policy: {
      moderationOutcome: args.moderation.outcome,
      moderationReasons: args.moderation.reasons,
      rateOutcome: args.rate.outcome,
      commandName: args.command.commandName,
      shadowOnly: args.moderation.shadowOnly,
      wasRewritten: args.moderation.outcome === 'REWRITE',
      wasMasked: args.moderation.outcome === 'MASK',
    },
    replay: args.replay,
    learning: args.learning ?? {
      learningTriggered: context.runtime.learningPolicy.enabled,
      affectAfterMessage: null,
      inferenceSource: 'HEURISTIC',
      inferenceId: null,
    },
    tags: uniqueStrings([
      'player',
      args.request.channelId.toLowerCase(),
      ...(args.command.commandName ? [`cmd:${args.command.commandName}`] : []),
      ...(args.moderation.shadowOnly ? ['shadowed'] : []),
      ...(args.moderation.outcome === 'MASK' ? ['masked'] : []),
      ...(args.moderation.outcome === 'REWRITE' ? ['rewritten'] : []),
    ]),
    metadata: compactRecord({
      requestId: args.request.requestId,
      originalChannelId: args.request.channelId,
      rawTextLength: args.request.text.length,
      effectiveTextLength: args.effectiveText.length,
      clientHints: acceptedHints,
      commandGeneratedSystemMessages: args.command.generatedSystemMessages,
      commandShadowWrites: args.command.shadowWrites,
    }),
  });
}

export function createSystemMessage(
  context: ChatMessageFactoryContext,
  args: CreateSystemMessageArgs,
): ChatMessage {
  const sourceType = args.sourceType ?? 'SYSTEM';
  const displayName = args.displayName ?? displayNameForSourceType(sourceType);
  const actorId = args.actorId ?? actorIdForSourceType(sourceType);

  return createCanonicalMessage(context, {
    state: args.state,
    roomId: args.roomId,
    channelId: args.channelId,
    now: args.now,
    causeEventId: args.causeEventId ?? null,
    causalParentMessageIds: args.causalParentMessageIds,
    causalParentEventIds: args.causalParentEventIds,
    bodyParts: args.bodyParts ?? buildBodyPartsFromSystemText(args.text),
    attribution: {
      sourceType,
      authorSessionId: null,
      authorUserId: null,
      actorId,
      displayName,
      npcRole: null,
      botId: null,
    },
    policy: {
      moderationOutcome: 'ALLOW',
      rateOutcome: 'ALLOW',
      shadowOnly: !CHAT_CHANNEL_DESCRIPTORS[args.channelId].visibleToPlayer,
    },
    replay: args.replay,
    learning: args.learning ?? {
      learningTriggered: false,
      affectAfterMessage: null,
      inferenceSource: 'NONE',
      inferenceId: null,
    },
    tags: uniqueStrings([
      sourceType.toLowerCase(),
      'system-authored',
      ...(args.tags ?? []),
      args.channelId.toLowerCase(),
    ]),
    metadata: args.metadata,
  });
}

export function createNpcMessage(
  context: ChatMessageFactoryContext,
  args: CreateNpcMessageArgs,
): ChatMessage {
  const bodyParts = buildNpcBodyParts(args.text, {
    addSignature: args.addSignature ?? false,
    signature: args.persona.voiceprint.closer ?? '',
    quotingMessageId: args.quotingMessageId ?? null,
    quotingText: args.quotingText ?? null,
  });

  return createCanonicalMessage(context, {
    state: args.state,
    roomId: args.roomId,
    channelId: args.channelId,
    now: args.now,
    causeEventId: args.causeEventId ?? null,
    causalParentMessageIds: uniqueMessageIds([
      ...(args.causalParentMessageIds ?? []),
      ...(args.quotingMessageId ? [args.quotingMessageId] : []),
    ]),
    causalParentEventIds: args.causalParentEventIds,
    bodyParts,
    attribution: attributionForNpc(args.persona, args.role),
    policy: {
      moderationOutcome: 'ALLOW',
      rateOutcome: 'ALLOW',
      shadowOnly: !CHAT_CHANNEL_DESCRIPTORS[args.channelId].visibleToPlayer,
    },
    replay: args.replay,
    learning: args.learning ?? {
      learningTriggered: context.runtime.learningPolicy.enabled,
      affectAfterMessage: null,
      inferenceSource: 'HEURISTIC',
      inferenceId: null,
    },
    tags: uniqueStrings([
      args.role.toLowerCase(),
      'npc',
      `persona:${args.persona.personaId}`,
      ...(args.tags ?? []),
    ]),
    metadata: compactRecord({
      personaId: args.persona.personaId,
      voiceprintOpener: args.persona.voiceprint.opener,
      voiceprintCloser: args.persona.voiceprint.closer,
      quotingMessageId: args.quotingMessageId ?? undefined,
    }),
  });
}

export function createHelperInterventionMessage(
  context: ChatMessageFactoryContext,
  args: CreateHelperInterventionMessageArgs,
): ChatMessage {
  return createNpcMessage(context, {
    ...args,
    role: 'HELPER',
    tags: uniqueStrings([
      'helper',
      'intervention',
      ...(args.recoveryWindowSuggested ? ['recovery-window'] : []),
      ...(args.rescueReason ? [`rescue:${slug(args.rescueReason)}`] : []),
      ...(args.tags ?? []),
    ]),
    metadata: compactRecord({
      ...(args.metadata ?? {}),
      rescueReason: args.rescueReason,
      recoveryWindowSuggested: args.recoveryWindowSuggested ?? false,
    }),
  });
}

export function createHaterEscalationMessage(
  context: ChatMessageFactoryContext,
  args: CreateHaterEscalationMessageArgs,
): ChatMessage {
  return createNpcMessage(context, {
    ...args,
    role: 'HATER',
    tags: uniqueStrings([
      'hater',
      'escalation',
      ...(args.escalationTier ? [`tier:${args.escalationTier.toLowerCase()}`] : []),
      ...(args.attackWindowOpen ? ['attack-window-open'] : []),
      ...(args.tags ?? []),
    ]),
    metadata: compactRecord({
      ...(args.metadata ?? {}),
      escalationTier: args.escalationTier,
      attackWindowOpen: args.attackWindowOpen ?? false,
    }),
  });
}

export function createDealRoomOfferMessage(
  context: ChatMessageFactoryContext,
  args: CreateDealRoomOfferMessageArgs,
): ChatMessage {
  const moderation = args.moderation ?? {
    outcome: 'ALLOW',
    reasons: [],
    rewrittenText: null,
    maskedLexemes: [],
    shadowOnly: false,
  } satisfies ChatModerationDecision;

  const rate = args.rate ?? {
    outcome: 'ALLOW',
    retryAfterMs: 0,
    reasons: [],
  } satisfies ChatRateDecision;

  const effectiveText = moderation.rewrittenText ?? args.negotiationText;

  return createCanonicalMessage(context, {
    state: args.state,
    roomId: args.roomId,
    channelId: 'DEAL_ROOM',
    now: args.now,
    causeEventId: args.causeEventId ?? null,
    causalParentMessageIds: args.causalParentMessageIds,
    causalParentEventIds: args.causalParentEventIds,
    bodyParts: [
      { type: 'OFFER', offerId: args.offerId as any, summary: collapseWhitespace(args.summary) },
      { type: 'TEXT', text: effectiveText },
    ],
    attribution: {
      sourceType: 'PLAYER',
      authorSessionId: args.session.identity.sessionId,
      authorUserId: args.session.identity.userId,
      actorId: `user:${args.session.identity.userId}`,
      displayName: args.session.identity.displayName,
      npcRole: null,
      botId: null,
    },
    policy: {
      moderationOutcome: moderation.outcome,
      moderationReasons: moderation.reasons,
      rateOutcome: rate.outcome,
      shadowOnly: moderation.shadowOnly,
      wasRewritten: moderation.outcome === 'REWRITE',
      wasMasked: moderation.outcome === 'MASK',
    },
    replay: args.replay,
    learning: args.learning ?? {
      learningTriggered: context.runtime.learningPolicy.enabled,
      affectAfterMessage: null,
      inferenceSource: 'HEURISTIC',
      inferenceId: null,
    },
    tags: uniqueStrings(['player', 'deal-room', 'offer', ...(args.tags ?? [])]),
    metadata: compactRecord({
      offerId: args.offerId,
      summary: args.summary,
    }),
  });
}

export function createQuoteCallbackMessage(
  context: ChatMessageFactoryContext,
  args: CreateQuoteCallbackMessageArgs,
): ChatMessage {
  return createNpcMessage(context, {
    ...args,
    quotingMessageId: args.quotedMessageId,
    quotingText: args.quotedText,
    tags: uniqueStrings(['callback', 'quote', ...(args.tags ?? [])]),
    metadata: compactRecord({
      ...(args.metadata ?? {}),
      quotedMessageId: args.quotedMessageId,
    }),
  });
}

export function createLegendMomentMessage(
  context: ChatMessageFactoryContext,
  args: CreateLegendMomentMessageArgs,
): ChatMessage {
  return createSystemMessage(context, {
    ...args,
    sourceType: 'SYSTEM',
    bodyParts: [
      { type: 'SYSTEM_TAG', tag: 'LEGEND', value: String(args.legendId) },
      { type: 'TEXT', text: args.text },
    ],
    replay: {
      legendId: args.legendId,
      sceneId: args.sceneId ?? null,
      momentId: args.momentId ?? null,
      replayId: null,
      replayAnchorKey: null,
    },
    tags: uniqueStrings(['legend', 'prestige', ...(args.tags ?? [])]),
  });
}

export function createShadowAnnotation(
  context: ChatMessageFactoryContext,
  args: CreateShadowAnnotationArgs,
): ChatMessage {
  const channelId = selectShadowChannelFromTag(args.shadowTag);
  return createSystemMessage(context, {
    ...args,
    channelId,
    sourceType: args.shadowTag === 'LIVEOPS' ? 'LIVEOPS' : args.shadowTag === 'SYSTEM' ? 'SYSTEM' : 'SERVER',
    actorId: args.actorId ?? `shadow:${args.shadowTag.toLowerCase()}`,
    displayName: args.displayName ?? `${args.shadowTag}_SHADOW`,
    tags: uniqueStrings(['shadow', args.shadowTag.toLowerCase(), ...(args.tags ?? [])]),
  });
}

export function createCommandSystemMessages(
  context: ChatMessageFactoryContext,
  args: CreateCommandSystemMessagesArgs,
): readonly ChatMessage[] {
  if (!args.command.accepted || args.command.generatedSystemMessages.length === 0) {
    return [];
  }

  const baseNow = Number(args.now ?? asUnixMs(context.ports.clock.now()));
  const result: ChatMessage[] = [];

  for (let index = 0; index < args.command.generatedSystemMessages.length; index += 1) {
    const text = args.command.generatedSystemMessages[index] ?? '';
    result.push(
      createSystemMessage(context, {
        ...args,
        now: asUnixMs(baseNow + index),
        text,
        channelId: args.channelId,
        sourceType: 'SYSTEM',
        tags: uniqueStrings(['command-generated', ...(args.tags ?? [])]),
        metadata: compactRecord({
          ...(args.metadata ?? {}),
          commandName: args.command.commandName,
          commandIndex: index,
        }),
      }),
    );
  }

  return result;
}

export function createSceneMessages(
  context: ChatMessageFactoryContext,
  args: CreateSceneMessagesArgs,
): readonly ChatBuiltSceneMessage[] {
  const start = Number(args.now ?? asUnixMs(context.ports.clock.now()));
  const result: ChatBuiltSceneMessage[] = [];
  let cursor = start;

  for (let index = 0; index < args.messages.length; index += 1) {
    const plan = args.messages[index]!;
    const delayMs = Math.max(0, Math.floor(plan.delayMs ?? 0));
    cursor += delayMs;

    const message = createNpcMessage(context, {
      ...args,
      now: asUnixMs(cursor),
      channelId: plan.channelId ?? args.channelId,
      text: plan.text,
      quotingMessageId: plan.quotingMessageId ?? null,
      quotingText: plan.quotingText ?? null,
      replay: plan.replay ?? args.replay,
      learning: plan.learning ?? args.learning,
      tags: uniqueStrings([...(args.tags ?? []), ...(plan.tags ?? []), `scene-step:${index}`]),
      metadata: compactRecord({
        ...(args.metadata ?? {}),
        sceneStep: index,
      }),
    });

    result.push({ delayMs, message });
  }

  return result;
}

// ============================================================================
// MARK: Mutation-safe message revisions
// ============================================================================

export function reviseMessageText(ports: ChatMessageFactoryPorts, args: ReviseMessageTextArgs): ChatMessage {
  const nextBodyParts = replaceTextBodyParts(args.message.bodyParts, args.newText);
  const nextPlainText = compilePlainText(nextBodyParts);
  const editedAt = args.now ?? asUnixMs(ports.clock.now());

  return {
    ...args.message,
    bodyParts: nextBodyParts,
    plainText: nextPlainText,
    editedAt,
    proof: {
      ...args.message.proof,
      proofHash: ports.hash.hash(
        `${args.message.roomId}|${String(args.message.sequenceNumber)}|edit|${nextPlainText}|${String(editedAt)}`,
      ),
    },
    policy: {
      ...args.message.policy,
      moderationOutcome: args.moderationOutcome ?? args.message.policy.moderationOutcome,
      moderationReasons: args.moderationReasons ?? args.message.policy.moderationReasons,
      wasRewritten: true,
    },
    tags: uniqueStrings([...args.message.tags, 'edited']),
  };
}

export function redactMessage(ports: ChatMessageFactoryPorts, args: RedactMessageArgs): ChatMessage {
  const replacementText = collapseWhitespace(args.replacementText ?? '[REDACTED]');
  const now = args.now ?? asUnixMs(ports.clock.now());
  return {
    ...args.message,
    bodyParts: [{ type: 'TEXT', text: replacementText }],
    plainText: replacementText,
    redactedAt: now,
    proof: {
      ...args.message.proof,
      proofHash: ports.hash.hash(
        `${args.message.roomId}|${String(args.message.sequenceNumber)}|redact|${replacementText}|${String(now)}`,
      ),
    },
    policy: {
      ...args.message.policy,
      moderationOutcome: 'MASK',
      moderationReasons: uniqueStrings([...(args.message.policy.moderationReasons ?? []), ...(args.reasons ?? [])]),
      wasMasked: true,
    },
    tags: uniqueStrings([...args.message.tags, 'redacted']),
  };
}

export function softDeleteMessage(args: SoftDeleteMessageArgs): ChatMessage {
  const now = args.now ?? args.message.createdAt;
  return {
    ...args.message,
    deletedAt: now,
    tags: uniqueStrings([...args.message.tags, 'soft-deleted']),
  };
}

// ============================================================================
// MARK: Derivation helpers
// ============================================================================

export function derivePlayerCallbackQuote(
  state: ChatState,
  roomId: ChatRoomId,
  preferredActorId?: string | null,
): { readonly messageId: ChatMessageId; readonly text: string } | null {
  const transcript = selectRoomTranscript(state, roomId);
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const entry = transcript[index]!;
    const message = entry.message;
    if (message.attribution.sourceType !== 'PLAYER') {
      continue;
    }

    if (preferredActorId && message.attribution.actorId !== preferredActorId) {
      continue;
    }

    if (message.plainText.trim().length < 6) {
      continue;
    }

    return {
      messageId: message.id,
      text: truncateForQuote(message.plainText),
    };
  }

  return null;
}

export function derivePersonaPreferredChannel(
  room: ChatRoomState,
  persona: ChatPersonaDescriptor,
): ChatChannelId {
  for (const preferred of persona.preferredChannels) {
    if (preferred === room.activeVisibleChannel) {
      return preferred;
    }

    if (isVisibleChannelId(preferred) && room.allowedVisibleChannels.includes(preferred)) {
      return preferred;
    }
  }

  return room.activeVisibleChannel;
}

export function deriveRelationshipTag(
  state: ChatState,
  roomId: ChatRoomId,
  userId: ChatLearningProfile['userId'],
  actorId: string,
): string | null {
  const relationship = selectRelationshipForActor(state, roomId, actorId, userId);
  if (!relationship) {
    return null;
  }

  if (Number(relationship.rivalry01) >= 0.75) {
    return 'relationship:rivalry-high';
  }
  if (Number(relationship.trust01) >= 0.75) {
    return 'relationship:trust-high';
  }
  if (Number(relationship.fear01) >= 0.60) {
    return 'relationship:fear-elevated';
  }
  if (Number(relationship.rescueDebt01) >= 0.50) {
    return 'relationship:rescue-debt';
  }

  return 'relationship:tracked';
}

export function deriveLearningSeedFromProfile(
  profile: ChatLearningProfile | null | undefined,
  inferenceId: ChatInferenceId | null,
): ChatLearningSeed {
  return {
    learningTriggered: Boolean(profile),
    affectAfterMessage: profile?.affect ?? null,
    inferenceSource: profile ? 'ML' : 'NONE',
    inferenceId,
  };
}

export function derivePlayerEchoShadowMessage(
  context: ChatMessageFactoryContext,
  args: CreatePlayerMessageArgs,
): ChatMessage | null {
  if (!args.moderation.shadowOnly) {
    return null;
  }

  return createShadowAnnotation(context, {
    state: args.state,
    roomId: args.roomId,
    channelId: 'SYSTEM_SHADOW',
    now: args.now,
    causeEventId: args.causeEventId,
    causalParentMessageIds: args.causalParentMessageIds,
    causalParentEventIds: args.causalParentEventIds,
    text: `Shadow-mirrored player message for request ${String(args.request.requestId)}.`,
    shadowTag: 'SYSTEM',
    tags: ['player-shadow-echo'],
    metadata: compactRecord({
      requestId: args.request.requestId,
      originalChannelId: args.request.channelId,
    }),
  });
}

// ============================================================================
// MARK: Validation
// ============================================================================

export function validateMessage(message: ChatMessage): readonly ChatMessageValidationIssue[] {
  const issues: ChatMessageValidationIssue[] = [];
  const compiled = compilePlainText(message.bodyParts);

  if (message.bodyParts.length === 0) {
    issues.push({
      code: 'EMPTY_BODY',
      severity: 'ERROR',
      detail: 'Message contains zero body parts.',
    });
  }

  if (compiled !== message.plainText) {
    issues.push({
      code: 'PLAIN_TEXT_MISMATCH',
      severity: 'ERROR',
      detail: 'plainText does not match compiled body part text.',
    });
  }

  if (message.sequenceNumber !== asSequenceNumber(Number(message.sequenceNumber))) {
    issues.push({
      code: 'NEGATIVE_SEQUENCE',
      severity: 'ERROR',
      detail: 'Sequence number is not canonical integer form.',
    });
  }

  if (CHAT_CHANNEL_DESCRIPTORS[message.channelId].visibleToPlayer && !isChannelComposerCompatible(message.channelId)) {
    issues.push({
      code: 'INVALID_VISIBLE_CHANNEL',
      severity: 'WARN',
      detail: 'Visible message uses a channel that does not usually accept composer-authored lines.',
    });
  }

  if (!message.proof.proofHash) {
    issues.push({
      code: 'INVALID_PROOF',
      severity: 'WARN',
      detail: 'Message proof hash is null or absent.',
    });
  }

  if (message.deletedAt === null && message.tags.includes('soft-deleted')) {
    issues.push({
      code: 'DELETED_WITHOUT_TIMESTAMP',
      severity: 'ERROR',
      detail: 'soft-deleted tag exists but deletedAt is null.',
    });
  }

  if (message.redactedAt === null && message.tags.includes('redacted')) {
    issues.push({
      code: 'REDACTED_WITHOUT_TIMESTAMP',
      severity: 'ERROR',
      detail: 'redacted tag exists but redactedAt is null.',
    });
  }

  if (message.replay.replayId !== null && !CHAT_CHANNEL_DESCRIPTORS[message.channelId].supportsReplay) {
    issues.push({
      code: 'REPLAY_CHANNEL_MISMATCH',
      severity: 'WARN',
      detail: 'Replay metadata exists on a channel that does not usually participate in replay.',
    });
  }

  return issues;
}

// ============================================================================
// MARK: Core internal helpers
// ============================================================================

function buildProofMetadata(
  context: ChatMessageFactoryContext,
  args: {
    readonly roomId: ChatRoomId;
    readonly sequenceNumber: SequenceNumber;
    readonly plainText: string;
    readonly channelId: ChatChannelId;
    readonly attribution: ChatAttributionSeed;
    readonly causeEventId: ChatEventId | null;
    readonly causalParentMessageIds: readonly ChatMessageId[];
    readonly causalParentEventIds: readonly ChatEventId[];
    readonly bodyParts: readonly ChatMessageBodyPart[];
  },
): ChatMessageProofMetadata {
  const eventIds = uniqueEventIds([
    ...args.causalParentEventIds,
    ...(args.causeEventId ? [args.causeEventId] : []),
  ]);

  const serializedBody = args.bodyParts.map(serializeBodyPart).join('|');
  const seed = [
    String(args.roomId),
    String(args.sequenceNumber),
    args.channelId,
    args.attribution.actorId,
    args.plainText,
    serializedBody,
    args.causalParentMessageIds.join(','),
    eventIds.join(','),
  ].join('::');

  return {
    proofHash: context.runtime.proofPolicy.enabled ? context.ports.hash.hash(seed) : null,
    causalParentMessageIds: uniqueMessageIds(args.causalParentMessageIds),
    causalParentEventIds: eventIds,
  };
}

function normalizeBodyParts(parts: readonly ChatMessageBodyPart[]): readonly ChatMessageBodyPart[] {
  const compacted: ChatMessageBodyPart[] = [];

  for (const part of parts) {
    if (part.type === 'TEXT') {
      const text = collapseWhitespace(part.text);
      if (text.length === 0) {
        continue;
      }

      const last = compacted.at(-1);
      if (last?.type === 'TEXT') {
        compacted[compacted.length - 1] = {
          type: 'TEXT',
          text: `${last.text} ${text}`,
        };
      } else {
        compacted.push({ type: 'TEXT', text });
      }
      continue;
    }

    if (part.type === 'SYSTEM_TAG') {
      compacted.push({
        type: 'SYSTEM_TAG',
        tag: collapseWhitespace(part.tag),
        value: part.value ? collapseWhitespace(part.value) : undefined,
      });
      continue;
    }

    if (part.type === 'QUOTE') {
      compacted.push({
        type: 'QUOTE',
        messageId: part.messageId,
        text: truncateForQuote(part.text),
      });
      continue;
    }

    if (part.type === 'OFFER') {
      compacted.push({
        type: 'OFFER',
        offerId: part.offerId,
        summary: collapseWhitespace(part.summary),
      });
      continue;
    }

    compacted.push({
      type: 'EMOTE',
      name: collapseWhitespace(part.name),
    });
  }

  if (compacted.length === 0) {
    compacted.push({ type: 'TEXT', text: '…' });
  }

  return compacted;
}

export function compilePlainText(parts: readonly ChatMessageBodyPart[]): string {
  const buffer: string[] = [];

  for (const part of parts) {
    switch (part.type) {
      case 'TEXT':
        buffer.push(collapseWhitespace(part.text));
        break;
      case 'SYSTEM_TAG':
        buffer.push(part.value ? `[${part.tag}:${part.value}]` : `[${part.tag}]`);
        break;
      case 'QUOTE':
        buffer.push(`“${collapseWhitespace(part.text)}”`);
        break;
      case 'OFFER':
        buffer.push(`[Offer] ${collapseWhitespace(part.summary)}`);
        break;
      case 'EMOTE':
        buffer.push(`:${collapseWhitespace(part.name)}:`);
        break;
      default:
        exhaustiveBodyPart(part);
    }
  }

  return collapseWhitespace(buffer.join(' '));
}

function buildBodyPartsFromPlayerText(text: string): readonly ChatMessageBodyPart[] {
  const normalized = normalizePlayerAuthoredText(text);
  return [{ type: 'TEXT', text: normalized }];
}

function buildBodyPartsFromSystemText(text: string): readonly ChatMessageBodyPart[] {
  const normalized = normalizeSystemAuthoredText(text);
  return [{ type: 'TEXT', text: normalized }];
}

function buildNpcBodyParts(
  text: string,
  options: {
    readonly addSignature: boolean;
    readonly signature: string;
    readonly quotingMessageId: ChatMessageId | null;
    readonly quotingText: string | null;
  },
): readonly ChatMessageBodyPart[] {
  const parts: ChatMessageBodyPart[] = [];
  if (options.quotingMessageId && options.quotingText) {
    parts.push({
      type: 'QUOTE',
      messageId: options.quotingMessageId,
      text: truncateForQuote(options.quotingText),
    });
  }

  parts.push({ type: 'TEXT', text: normalizeNpcAuthoredText(text) });

  if (options.addSignature && options.signature.trim().length > 0) {
    parts.push({ type: 'EMOTE', name: normalizeEmoteName(options.signature) });
  }

  return parts;
}

function replaceTextBodyParts(parts: readonly ChatMessageBodyPart[], newText: string): readonly ChatMessageBodyPart[] {
  const result = [...parts];
  const normalized = collapseWhitespace(newText);
  let replaced = false;

  for (let index = 0; index < result.length; index += 1) {
    if (result[index]?.type === 'TEXT') {
      result[index] = { type: 'TEXT', text: normalized };
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    result.unshift({ type: 'TEXT', text: normalized });
  }

  return normalizeBodyParts(result);
}

function deriveTagsFromMessage(
  room: ChatRoomState,
  channelId: ChatChannelId,
  plainText: string,
  bodyParts: readonly ChatMessageBodyPart[],
): readonly string[] {
  const tags = new Set<string>();

  tags.add(`room-kind:${room.roomKind.toLowerCase()}`);
  tags.add(`channel:${channelId.toLowerCase()}`);
  tags.add(`mood:${room.stageMood.toLowerCase()}`);

  if (bodyParts.some((part) => part.type === 'QUOTE')) {
    tags.add('has-quote');
  }
  if (bodyParts.some((part) => part.type === 'OFFER')) {
    tags.add('has-offer');
  }
  if (bodyParts.some((part) => part.type === 'SYSTEM_TAG')) {
    tags.add('has-system-tag');
  }

  const lower = plainText.toLowerCase();
  if (containsAny(lower, ['bankrupt', 'bankruptcy', 'liquidation'])) {
    tags.add('theme:bankruptcy');
  }
  if (containsAny(lower, ['shield', 'breach', 'collapse'])) {
    tags.add('theme:defense');
  }
  if (containsAny(lower, ['sovereignty', 'crown', 'ascend'])) {
    tags.add('theme:sovereignty');
  }
  if (containsAny(lower, ['deal', 'offer', 'counter'])) {
    tags.add('theme:negotiation');
  }
  if (containsAny(lower, ['help', 'recover', 'steady'])) {
    tags.add('theme:rescue');
  }
  if (containsAny(lower, ['watching', 'remember', 'again'])) {
    tags.add('theme:memory');
  }

  return [...tags];
}

function coerceMessageChannel(channelId: ChatChannelId, shadowOnly: boolean): ChatChannelId {
  if (!shadowOnly) {
    return channelId;
  }

  if (!CHAT_CHANNEL_DESCRIPTORS[channelId].visibleToPlayer) {
    return channelId;
  }

  return selectShadowMirrorForVisibleChannel(channelId as ChatVisibleChannel);
}

function selectShadowMirrorForVisibleChannel(channelId: ChatVisibleChannel): ChatChannelId {
  switch (channelId) {
    case 'GLOBAL':
      return 'NPC_SHADOW';
    case 'SYNDICATE':
      return 'RIVALRY_SHADOW';
    case 'DEAL_ROOM':
      return 'RESCUE_SHADOW';
    case 'LOBBY':
      return 'SYSTEM_SHADOW';
    default:
      return exhaustiveVisibleChannel(channelId);
  }
}

function selectShadowChannelFromTag(tag: CreateShadowAnnotationArgs['shadowTag']): ChatChannelId {
  switch (tag) {
    case 'SYSTEM':
      return 'SYSTEM_SHADOW';
    case 'NPC':
      return 'NPC_SHADOW';
    case 'RIVALRY':
      return 'RIVALRY_SHADOW';
    case 'RESCUE':
      return 'RESCUE_SHADOW';
    case 'LIVEOPS':
      return 'LIVEOPS_SHADOW';
    default:
      return exhaustiveShadowTag(tag);
  }
}

function attributionForNpc(persona: ChatPersonaDescriptor, role: ChatNpcRole): ChatAttributionSeed {
  const sourceType: ChatSourceType =
    role === 'HATER' ? 'NPC_HATER' : role === 'HELPER' ? 'NPC_HELPER' : 'NPC_AMBIENT';

  return {
    sourceType,
    authorSessionId: null,
    authorUserId: null,
    actorId: persona.actorId,
    displayName: persona.displayName,
    npcRole: role,
    botId: persona.botId,
  };
}

function freezeAttribution(seed: ChatAttributionSeed): ChatMessageAttribution {
  return {
    sourceType: seed.sourceType,
    authorSessionId: seed.authorSessionId,
    authorUserId: seed.authorUserId,
    actorId: seed.actorId,
    displayName: seed.displayName,
    npcRole: seed.npcRole,
    botId: seed.botId,
  };
}

function selectPrefixForSource(sourceType: ChatSourceType): string {
  switch (sourceType) {
    case 'PLAYER':
      return 'msg';
    case 'NPC_HATER':
      return 'hat';
    case 'NPC_HELPER':
      return 'hlp';
    case 'NPC_AMBIENT':
      return 'amb';
    case 'SYSTEM':
      return 'sys';
    case 'SERVER':
      return 'srv';
    case 'MODERATION':
      return 'mod';
    case 'LIVEOPS':
      return 'ops';
    default:
      return exhaustiveSourceType(sourceType);
  }
}

function actorIdForSourceType(sourceType: Extract<ChatSourceType, 'SYSTEM' | 'SERVER' | 'MODERATION' | 'LIVEOPS'>): string {
  switch (sourceType) {
    case 'SYSTEM':
      return 'system:chat';
    case 'SERVER':
      return 'server:chat';
    case 'MODERATION':
      return 'moderation:chat';
    case 'LIVEOPS':
      return 'liveops:chat';
    default:
      return exhaustiveSystemSourceType(sourceType);
  }
}

function displayNameForSourceType(sourceType: Extract<ChatSourceType, 'SYSTEM' | 'SERVER' | 'MODERATION' | 'LIVEOPS'>): string {
  switch (sourceType) {
    case 'SYSTEM':
      return 'SYSTEM';
    case 'SERVER':
      return 'SERVER';
    case 'MODERATION':
      return 'MODERATION';
    case 'LIVEOPS':
      return 'LIVEOPS';
    default:
      return exhaustiveSystemSourceType(sourceType);
  }
}

function requireRoom(state: ChatState, roomId: ChatRoomId): ChatRoomState {
  const room = selectRoom(state, roomId);
  if (!room) {
    throw new Error(`ChatMessageFactory: room ${String(roomId)} does not exist in state.`);
  }
  return room;
}

export function resolveRoomAndSessionOrThrow(
  state: ChatState,
  roomId: ChatRoomId,
  sessionId: ChatSessionId,
): { readonly room: ChatRoomState; readonly session: ChatSessionState } {
  const room = selectRoom(state, roomId);
  if (!room) {
    throw new Error(`ChatMessageFactory: room ${String(roomId)} does not exist.`);
  }

  const session = selectSession(state, sessionId);
  if (!session) {
    throw new Error(`ChatMessageFactory: session ${String(sessionId)} does not exist.`);
  }

  return { room, session };
}

export function deriveMessageSeedFromSignal(
  state: ChatState,
  signal: ChatSignalEnvelope,
): Pick<ChatMessageCoreSeed, 'roomId' | 'causeEventId' | 'metadata'> | null {
  if (!signal.roomId) {
    return null;
  }

  const latest = selectLatestMessage(state, signal.roomId);
  return {
    roomId: signal.roomId,
    causeEventId: null,
    metadata: compactRecord({
      signalType: signal.type,
      lastMessageId: latest?.id,
      battle: signal.battle as unknown as JsonValue | undefined,
      run: signal.run as unknown as JsonValue | undefined,
      multiplayer: signal.multiplayer as unknown as JsonValue | undefined,
      economy: signal.economy as unknown as JsonValue | undefined,
      liveops: signal.liveops as unknown as JsonValue | undefined,
    }),
  };
}

export function deriveJoinAnnouncementText(request: ChatJoinRequest): string {
  return `${request.session.displayName} entered ${request.title}.`;
}

export function deriveMessageWindowSummary(state: ChatState, roomId: ChatRoomId, count: number): string {
  const transcript = selectRoomTranscript(state, roomId);
  const lines = transcript.slice(-Math.max(1, count)).map((entry) => {
    const source = entry.message.attribution.displayName;
    return `${source}: ${entry.message.plainText}`;
  });

  return lines.join('\n');
}

// ============================================================================
// MARK: Runtime / ports / coercion
// ============================================================================

function mergeRuntime(runtime: Partial<ChatRuntimeConfig> | undefined): ChatRuntimeConfig {
  return {
    ...CHAT_RUNTIME_DEFAULTS,
    ...(runtime ?? {}),
    ratePolicy: {
      ...CHAT_RUNTIME_DEFAULTS.ratePolicy,
      ...(runtime?.ratePolicy ?? {}),
    },
    moderationPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.moderationPolicy,
      ...(runtime?.moderationPolicy ?? {}),
    },
    replayPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.replayPolicy,
      ...(runtime?.replayPolicy ?? {}),
    },
    learningPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.learningPolicy,
      ...(runtime?.learningPolicy ?? {}),
    },
    proofPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.proofPolicy,
      ...(runtime?.proofPolicy ?? {}),
    },
    invasionPolicy: {
      ...CHAT_RUNTIME_DEFAULTS.invasionPolicy,
      ...(runtime?.invasionPolicy ?? {}),
    },
  };
}

function mergePorts(ports: Partial<ChatMessageFactoryPorts> | undefined): ChatMessageFactoryPorts {
  return {
    clock: ports?.clock ?? DEFAULT_PORTS.clock,
    ids: ports?.ids ?? DEFAULT_PORTS.ids,
    hash: ports?.hash ?? DEFAULT_PORTS.hash,
  };
}

// ============================================================================
// MARK: Text and metadata normalization helpers
// ============================================================================

function normalizePlayerAuthoredText(text: string): string {
  return clampText(collapseWhitespace(text), 480);
}

function normalizeSystemAuthoredText(text: string): string {
  return clampText(collapseWhitespace(text), 480);
}

function normalizeNpcAuthoredText(text: string): string {
  return clampText(normalizeNpcWhitespace(text), 480);
}

function normalizeNpcWhitespace(text: string): string {
  return collapseWhitespace(text.replace(/\s*([!?.,;:])\s*/g, '$1 ')).trim();
}

function normalizeEmoteName(name: string): string {
  return slug(name).replace(/-/g, '_');
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function clampText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

function truncateForQuote(text: string): string {
  return clampText(collapseWhitespace(text), 160);
}

function buildTags(text: string): readonly string[] {
  const tokens = tokenize(text)
    .filter((token) => token.length >= 4)
    .slice(0, 12)
    .map((token) => `kw:${token}`);
  return uniqueStrings(tokens);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function compactRecord<T extends Record<string, unknown>>(input: T): Readonly<Record<string, JsonValue>> {
  const result: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }
    const converted = coerceJsonValue(value);
    if (converted !== undefined) {
      result[key] = converted;
    }
  }
  return result;
}

function filterJsonRecord(input: Readonly<Record<string, JsonValue>>): Readonly<Record<string, JsonValue>> {
  const result: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(input)) {
    const converted = coerceJsonValue(value);
    if (converted !== undefined) {
      result[key] = converted;
    }
  }
  return result;
}

function freezeJsonObject(input: Readonly<Record<string, JsonValue>>): Readonly<Record<string, JsonValue>> {
  return { ...input };
}

function coerceJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value as JsonValue;
  }
  if (Array.isArray(value)) {
    return value.map((item) => coerceJsonValue(item) ?? null);
  }
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const converted = coerceJsonValue(item);
      if (converted !== undefined) {
        result[key] = converted;
      }
    }
    return result;
  }
  return String(value);
}

function serializeBodyPart(part: ChatMessageBodyPart): string {
  switch (part.type) {
    case 'TEXT':
      return `TEXT:${part.text}`;
    case 'SYSTEM_TAG':
      return `SYSTEM_TAG:${part.tag}:${part.value ?? ''}`;
    case 'QUOTE':
      return `QUOTE:${String(part.messageId)}:${part.text}`;
    case 'OFFER':
      return `OFFER:${String(part.offerId)}:${part.summary}`;
    case 'EMOTE':
      return `EMOTE:${part.name}`;
    default:
      return exhaustiveBodyPart(part);
  }
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = collapseWhitespace(String(value));
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function uniqueMessageIds(values: readonly ChatMessageId[]): readonly ChatMessageId[] {
  const out: ChatMessageId[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = String(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

function uniqueEventIds(values: readonly ChatEventId[]): readonly ChatEventId[] {
  const out: ChatEventId[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = String(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

function containsAny(text: string, lexemes: readonly string[]): boolean {
  return lexemes.some((lexeme) => text.includes(lexeme));
}

function slug(value: string): string {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomBase36(length: number): string {
  let out = '';
  while (out.length < length) {
    out += Math.random().toString(36).slice(2);
  }
  return out.slice(0, length);
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function isChannelComposerCompatible(channelId: ChatChannelId): boolean {
  return CHAT_CHANNEL_DESCRIPTORS[channelId].supportsComposer;
}

function exhaustiveBodyPart(value: never): never {
  throw new Error(`Unhandled ChatMessageBodyPart variant: ${JSON.stringify(value)}`);
}

function exhaustiveVisibleChannel(value: never): never {
  throw new Error(`Unhandled ChatVisibleChannel: ${String(value)}`);
}

function exhaustiveShadowTag(value: never): never {
  throw new Error(`Unhandled shadow tag: ${String(value)}`);
}

function exhaustiveSourceType(value: never): never {
  throw new Error(`Unhandled ChatSourceType: ${String(value)}`);
}

function exhaustiveSystemSourceType(value: never): never {
  throw new Error(`Unhandled system ChatSourceType: ${String(value)}`);
}
