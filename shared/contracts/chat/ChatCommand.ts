
/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT COMMAND CONTRACTS
 * FILE: shared/contracts/chat/ChatCommand.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared contract surface for chat command parsing, routing,
 * validation, authorization, execution planning, transport envelopes, replay
 * implications, and telemetry. This file is the long-term command authority
 * for the unified chat stack:
 *
 *   - /shared/contracts/chat
 *   - /pzo-web/src/engines/chat
 *   - /pzo-web/src/components/chat
 *   - /backend/src/game/engine/chat
 *   - /pzo-server/src/chat
 *
 * Design laws
 * -----------
 * 1. Commands are part of chat law, not ad hoc string helpers.
 * 2. Frontend may parse optimistically, but backend remains the authority for
 *    execution, permissions, rate limits, and transcript mutation.
 * 3. Server transport is a servant and may carry command envelopes, but it must
 *    not become the semantic owner of command routing.
 * 4. Commands must preserve the repo's multi-channel chat doctrine: GLOBAL,
 *    SYNDICATE, DEAL_ROOM, LOBBY, plus the shadow channel family.
 * 5. Command contracts must stay engine-safe and import-safe for frontend,
 *    backend, and transport without pulling runtime reducers or socket code.
 * 6. Negotiation, rescue, moderator, and dramaturgy flows all require explicit
 *    command semantics so the eventual ChatCommandParser.ts does not invent a
 *    second vocabulary at runtime.
 * ============================================================================
 */

import {
  type Brand,
  type ChatChannelFamily,
  type ChatChannelId,
  type ChatModeScope,
  type ChatMountTarget,
  type ChatRoomId,
  type JsonObject,
  type JsonValue,
  type Nullable,
  type Optional,
  type Score01,
  type Score100,
  type UnixMs,
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_VERSION,
  CHAT_VISIBLE_CHANNELS,
  CHAT_SHADOW_CHANNELS,
  CHAT_MODE_SCOPES,
  isChatChannelId,
  isChatModeScope,
} from './ChatChannels';

import {
  type ChatActorKind,
  type ChatAuthority,
  type ChatMessageId,
  type ChatNpcId,
  type ChatRequestId,
  type ChatSessionId,
  type ChatTelemetryEventName,
  type ChatUserId,
  CHAT_ACTOR_KINDS,
  CHAT_AUTHORITIES,
} from './ChatEvents';

import {
  type ChatCanonicalMessage,
  type ChatThreadId,
  type ChatThreadReference,
} from './ChatMessage';

import {
  type ChatPresenceEntry,
  type ChatPresenceStyleProfile,
} from './ChatPresence';

import {
  type ChatTypingCadenceProfile,
  type ChatTypingStyleProfile,
} from './ChatTyping';

import {
  type ChatCursorAnchor,
  type ChatTranscriptWindow,
} from './ChatCursor';

import {
  type ChatTranscriptExcerpt,
  type ChatTranscriptLedgerState,
  type ChatTranscriptQuery,
} from './ChatTranscript';

import {
  type ChatNpcDescriptor,
  type ChatNpcLineCandidate,
  type ChatNpcReactionIntent,
} from './ChatNpc';

// ============================================================================
// MARK: Branded identifiers
// ============================================================================

export type ChatCommandId = Brand<string, 'ChatCommandId'>;
export type ChatCommandRouteId = Brand<string, 'ChatCommandRouteId'>;
export type ChatCommandAliasId = Brand<string, 'ChatCommandAliasId'>;
export type ChatCommandPolicyId = Brand<string, 'ChatCommandPolicyId'>;
export type ChatCommandParserId = Brand<string, 'ChatCommandParserId'>;
export type ChatCommandExecutionId = Brand<string, 'ChatCommandExecutionId'>;
export type ChatCommandPlanId = Brand<string, 'ChatCommandPlanId'>;
export type ChatCommandEnvelopeId = Brand<string, 'ChatCommandEnvelopeId'>;
export type ChatCommandArgumentKey = Brand<string, 'ChatCommandArgumentKey'>;
export type ChatCommandArgumentId = Brand<string, 'ChatCommandArgumentId'>;
export type ChatCommandTargetId = Brand<string, 'ChatCommandTargetId'>;
export type ChatCommandTelemetryId = Brand<string, 'ChatCommandTelemetryId'>;
export type ChatCommandCooldownId = Brand<string, 'ChatCommandCooldownId'>;
export type ChatCommandPermissionId = Brand<string, 'ChatCommandPermissionId'>;
export type ChatCommandPresetId = Brand<string, 'ChatCommandPresetId'>;
export type ChatCommandSuggestionId = Brand<string, 'ChatCommandSuggestionId'>;
export type ChatSlashTokenId = Brand<string, 'ChatSlashTokenId'>;
export type ChatCommandNamespaceId = Brand<string, 'ChatCommandNamespaceId'>;
export type ChatCommandHelpSectionId = Brand<string, 'ChatCommandHelpSectionId'>;
export type ChatCommandEffectId = Brand<string, 'ChatCommandEffectId'>;
export type ChatCommandAuditId = Brand<string, 'ChatCommandAuditId'>;

// ============================================================================
// MARK: Core vocabularies
// ============================================================================

export const CHAT_COMMAND_SURFACES = [
  'COMPOSER',
  'MESSAGE_MENU',
  'KEYBOARD_SHORTCUT',
  'SYSTEM_ROUTER',
  'NPC_SCRIPT',
  'LIVEOPS',
  'MODERATOR_CONSOLE',
] as const;

export type ChatCommandSurface = (typeof CHAT_COMMAND_SURFACES)[number];

export const CHAT_COMMAND_NAMESPACES = [
  'SYSTEM',
  'CHANNEL',
  'NEGOTIATION',
  'SOCIAL',
  'RESCUE',
  'REPLAY',
  'MODERATION',
  'DEBUG',
  'LIVEOPS',
] as const;

export type ChatCommandNamespace = (typeof CHAT_COMMAND_NAMESPACES)[number];

export const CHAT_COMMAND_TARGET_KINDS = [
  'NONE',
  'SELF',
  'USER',
  'NPC',
  'MESSAGE',
  'THREAD',
  'ROOM',
  'CHANNEL',
  'TRANSCRIPT',
  'REPLAY',
  'OFFER',
  'WORLD_EVENT',
] as const;

export type ChatCommandTargetKind = (typeof CHAT_COMMAND_TARGET_KINDS)[number];

export const CHAT_COMMAND_EXECUTION_STATES = [
  'PARSED',
  'VALIDATED',
  'AUTHORIZED',
  'QUEUED',
  'EXECUTED',
  'REJECTED',
  'FAILED',
  'NOOP',
] as const;

export type ChatCommandExecutionState =
  (typeof CHAT_COMMAND_EXECUTION_STATES)[number];

export const CHAT_COMMAND_ACK_POLICIES = [
  'IMMEDIATE',
  'SERVER_ACK',
  'BACKEND_AUTHORITY',
  'DEFERRED',
] as const;

export type ChatCommandAckPolicy = (typeof CHAT_COMMAND_ACK_POLICIES)[number];

export const CHAT_COMMAND_VISIBILITY_CLASSES = [
  'VISIBLE_TO_AUTHOR',
  'VISIBLE_TO_ROOM',
  'VISIBLE_TO_SYSTEM',
  'SHADOW_ONLY',
] as const;

export type ChatCommandVisibilityClass =
  (typeof CHAT_COMMAND_VISIBILITY_CLASSES)[number];

export const CHAT_COMMAND_IMPACT_CLASSES = [
  'LOCAL_UI',
  'CHANNEL_STATE',
  'TRANSCRIPT_MUTATION',
  'NEGOTIATION_STATE',
  'PRESENCE_STATE',
  'REPLAY_STATE',
  'MODERATION_STATE',
  'LIVEOPS_STATE',
] as const;

export type ChatCommandImpactClass =
  (typeof CHAT_COMMAND_IMPACT_CLASSES)[number];

export const CHAT_COMMAND_COOLDOWN_SCOPES = [
  'NONE',
  'SESSION',
  'ROOM',
  'CHANNEL',
  'ACCOUNT',
  'GLOBAL',
] as const;

export type ChatCommandCooldownScope =
  (typeof CHAT_COMMAND_COOLDOWN_SCOPES)[number];

export const CHAT_COMMAND_AUTH_REQUIREMENTS = [
  'ANY_AUTHED_PLAYER',
  'TRUSTED_MEMBER',
  'NEGOTIATION_PARTICIPANT',
  'HELPER_ELIGIBLE',
  'MODERATOR_ONLY',
  'SYSTEM_ONLY',
  'LIVEOPS_ONLY',
] as const;

export type ChatCommandAuthRequirement =
  (typeof CHAT_COMMAND_AUTH_REQUIREMENTS)[number];

export const CHAT_COMMAND_VALIDATION_CODES = [
  'OK',
  'EMPTY',
  'UNKNOWN_COMMAND',
  'BAD_NAMESPACE',
  'BAD_ARGUMENT',
  'BAD_TARGET',
  'BAD_CHANNEL',
  'BAD_MODE_SCOPE',
  'COOLDOWN',
  'NOT_AUTHORIZED',
  'NOT_ALLOWED_IN_ROOM',
  'NOT_ALLOWED_IN_CHANNEL',
  'NOT_ALLOWED_IN_STATE',
  'NOT_ALLOWED_FOR_TARGET',
  'PARSER_REJECT',
] as const;

export type ChatCommandValidationCode =
  (typeof CHAT_COMMAND_VALIDATION_CODES)[number];

export const CHAT_COMMAND_TELEMETRY_EVENT_NAMES = [
  'chat_command_parsed',
  'chat_command_suggested',
  'chat_command_rejected',
  'chat_command_executed',
  'chat_command_failed',
  'chat_command_cooldown_hit',
  'chat_command_permission_denied',
] as const;

export type ChatCommandTelemetryEventName =
  (typeof CHAT_COMMAND_TELEMETRY_EVENT_NAMES)[number];

export const CHAT_COMMAND_ARGUMENT_KINDS = [
  'STRING',
  'BOOLEAN',
  'INTEGER',
  'DECIMAL',
  'USER_REF',
  'NPC_REF',
  'MESSAGE_REF',
  'THREAD_REF',
  'CHANNEL_REF',
  'ROOM_REF',
  'ENUM',
  'JSON',
] as const;

export type ChatCommandArgumentKind =
  (typeof CHAT_COMMAND_ARGUMENT_KINDS)[number];

export const CHAT_COMMAND_EFFECT_KINDS = [
  'SEND_SYSTEM_MESSAGE',
  'SWITCH_CHANNEL',
  'FOCUS_THREAD',
  'MUTE_TARGET',
  'UNMUTE_TARGET',
  'BLOCK_TARGET',
  'UNBLOCK_TARGET',
  'START_NEGOTIATION',
  'SUBMIT_OFFER',
  'SUBMIT_COUNTER',
  'ACCEPT_OFFER',
  'DECLINE_OFFER',
  'REQUEST_RESCUE',
  'MARK_MESSAGE',
  'SEEK_REPLAY',
  'EXPORT_TRANSCRIPT',
  'TOGGLE_SILENCE_MODE',
  'INVOKE_HELP',
  'ROUTE_TO_MODERATION',
  'SHADOW_WRITE',
] as const;

export type ChatCommandEffectKind =
  (typeof CHAT_COMMAND_EFFECT_KINDS)[number];

// ============================================================================
// MARK: Command aliases and parsed token state
// ============================================================================

export interface ChatCommandAlias {
  readonly aliasId: ChatCommandAliasId;
  readonly value: string;
  readonly isPrimary: boolean;
  readonly namespace: ChatCommandNamespace;
}

export interface ChatSlashToken {
  readonly tokenId: ChatSlashTokenId;
  readonly raw: string;
  readonly normalized: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly namespace?: ChatCommandNamespace;
  readonly guessedCommandKey?: string;
}

export interface ChatCommandArgumentSchema {
  readonly argumentId: ChatCommandArgumentId;
  readonly key: ChatCommandArgumentKey;
  readonly kind: ChatCommandArgumentKind;
  readonly required: boolean;
  readonly repeatable: boolean;
  readonly description: string;
  readonly enumValues?: readonly string[];
  readonly integerRange?: { readonly min: number; readonly max: number };
  readonly decimalRange?: { readonly min: number; readonly max: number };
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly defaultValue?: JsonValue;
}

export interface ChatCommandPermissionRequirement {
  readonly permissionId: ChatCommandPermissionId;
  readonly requirement: ChatCommandAuthRequirement;
  readonly description: string;
  readonly channelFamilies?: readonly ChatChannelFamily[];
  readonly allowedActorKinds?: readonly ChatActorKind[];
  readonly allowedModeScopes?: readonly ChatModeScope[];
}

export interface ChatCommandCooldownPolicy {
  readonly cooldownId: ChatCommandCooldownId;
  readonly scope: ChatCommandCooldownScope;
  readonly durationMs: number;
  readonly burstLimit?: number;
  readonly burstWindowMs?: number;
}

export interface ChatCommandTargetRef {
  readonly targetId: ChatCommandTargetId;
  readonly kind: ChatCommandTargetKind;
  readonly userId?: ChatUserId;
  readonly npcId?: ChatNpcId;
  readonly messageId?: ChatMessageId;
  readonly threadId?: ChatThreadId;
  readonly roomId?: ChatRoomId;
  readonly channelId?: ChatChannelId;
  readonly transcriptId?: string;
  readonly replayId?: string;
  readonly offerId?: string;
  readonly worldEventId?: string;
}

export interface ChatCommandInvocationContext {
  readonly sessionId: ChatSessionId;
  readonly actorId: ChatUserId | ChatNpcId;
  readonly actorKind: ChatActorKind;
  readonly authorityHint: ChatAuthority;
  readonly roomId: ChatRoomId;
  readonly channelId: ChatChannelId;
  readonly modeScope: ChatModeScope;
  readonly mountTarget?: ChatMountTarget;
  readonly threadId?: ChatThreadId;
  readonly replyToMessageId?: ChatMessageId;
  readonly currentTranscriptWindow?: ChatTranscriptWindow;
  readonly currentCursorAnchor?: ChatCursorAnchor;
  readonly currentPresence?: ChatPresenceEntry;
  readonly currentTypingProfile?: ChatTypingStyleProfile;
  readonly currentCadenceProfile?: ChatTypingCadenceProfile;
  readonly currentTranscriptDescriptor?: ChatTranscriptLedgerState;
  readonly selectedNpc?: ChatNpcDescriptor;
  readonly selectedNpcHint?: ChatNpcLineCandidate;
  readonly selectedNpcIntent?: ChatNpcReactionIntent;
  readonly transcriptSearchQuery?: ChatTranscriptQuery;
  readonly relatedExcerpt?: ChatTranscriptExcerpt;
  readonly relatedMessage?: ChatCanonicalMessage;
  readonly relatedThread?: ChatThreadReference;
  readonly rawInput: string;
  readonly requestedAt: UnixMs;
}

export interface ChatParsedCommandArgument {
  readonly key: ChatCommandArgumentKey;
  readonly value: JsonValue;
  readonly raw: string;
  readonly kind: ChatCommandArgumentKind;
}

export interface ChatCommandParseResult {
  readonly commandText: string;
  readonly namespace: ChatCommandNamespace;
  readonly commandKey: string;
  readonly aliasesMatched: readonly string[];
  readonly slashToken: ChatSlashToken;
  readonly target?: ChatCommandTargetRef;
  readonly arguments: readonly ChatParsedCommandArgument[];
  readonly freeText?: string;
  readonly parserWarnings: readonly string[];
}

export interface ChatCommandValidationResult {
  readonly accepted: boolean;
  readonly code: ChatCommandValidationCode;
  readonly reasons: readonly string[];
  readonly permissionFailures: readonly ChatCommandPermissionRequirement[];
  readonly cooldownRemainingMs?: number;
  readonly targetResolved?: ChatCommandTargetRef;
  readonly sanitizedArguments?: readonly ChatParsedCommandArgument[];
}

// ============================================================================
// MARK: Effects, routing, and execution planning
// ============================================================================

export interface ChatCommandEffect {
  readonly effectId: ChatCommandEffectId;
  readonly kind: ChatCommandEffectKind;
  readonly impactClass: ChatCommandImpactClass;
  readonly visibility: ChatCommandVisibilityClass;
  readonly payload: JsonObject;
}

export interface ChatCommandRouteDescriptor {
  readonly routeId: ChatCommandRouteId;
  readonly namespace: ChatCommandNamespace;
  readonly commandKey: string;
  readonly parserId: ChatCommandParserId;
  readonly ackPolicy: ChatCommandAckPolicy;
  readonly primaryAuthority: ChatAuthority;
  readonly fallbackAuthorities?: readonly ChatAuthority[];
  readonly writesTranscript: boolean;
  readonly emitsSystemMessage: boolean;
  readonly requiresReplayMarker: boolean;
  readonly allowsShadowCompanionWrite: boolean;
}

export interface ChatCommandExecutionPlan {
  readonly planId: ChatCommandPlanId;
  readonly commandId: ChatCommandId;
  readonly parse: ChatCommandParseResult;
  readonly validation: ChatCommandValidationResult;
  readonly route: ChatCommandRouteDescriptor;
  readonly effects: readonly ChatCommandEffect[];
  readonly authorityChain: readonly ChatAuthority[];
  readonly executionState: ChatCommandExecutionState;
  readonly replayTag?: 'NONE' | 'MARKER_ONLY' | 'EXPORTABLE_ACTION';
  readonly auditSummary: string;
}

export interface ChatCommandExecutionReceipt {
  readonly executionId: ChatCommandExecutionId;
  readonly commandId: ChatCommandId;
  readonly requestId?: ChatRequestId;
  readonly state: ChatCommandExecutionState;
  readonly executedAt: UnixMs;
  readonly authority: ChatAuthority;
  readonly emittedMessageIds?: readonly ChatMessageId[];
  readonly effectKindsApplied: readonly ChatCommandEffectKind[];
  readonly replayAnchorMessageId?: ChatMessageId;
  readonly auditId: ChatCommandAuditId;
}

export interface ChatCommandEnvelope {
  readonly envelopeId: ChatCommandEnvelopeId;
  readonly commandId: ChatCommandId;
  readonly requestId?: ChatRequestId;
  readonly context: ChatCommandInvocationContext;
  readonly parse: ChatCommandParseResult;
  readonly validation: ChatCommandValidationResult;
  readonly requestedAuthority: ChatAuthority;
  readonly routedAuthority: ChatAuthority;
  readonly visibility: ChatCommandVisibilityClass;
  readonly ackPolicy: ChatCommandAckPolicy;
}

export interface ChatCommandSuggestion {
  readonly suggestionId: ChatCommandSuggestionId;
  readonly commandKey: string;
  readonly namespace: ChatCommandNamespace;
  readonly title: string;
  readonly description: string;
  readonly example: string;
  readonly score: Score01;
  readonly allowedInChannelFamilies: readonly ChatChannelFamily[];
  readonly allowedInModeScopes: readonly ChatModeScope[];
}

export interface ChatCommandHelpSection {
  readonly sectionId: ChatCommandHelpSectionId;
  readonly title: string;
  readonly description: string;
  readonly commandKeys: readonly string[];
}

// ============================================================================
// MARK: Canonical command descriptor
// ============================================================================

export interface ChatCommandDescriptor {
  readonly commandId: ChatCommandId;
  readonly namespaceId: ChatCommandNamespaceId;
  readonly namespace: ChatCommandNamespace;
  readonly commandKey: string;
  readonly displayName: string;
  readonly description: string;
  readonly aliases: readonly ChatCommandAlias[];
  readonly helpSection: ChatCommandHelpSectionId;
  readonly channelFamilies: readonly ChatChannelFamily[];
  readonly visibleChannels: readonly ChatChannelId[];
  readonly shadowChannelsAllowed: readonly ChatChannelId[];
  readonly modeScopes: readonly ChatModeScope[];
  readonly targetKinds: readonly ChatCommandTargetKind[];
  readonly arguments: readonly ChatCommandArgumentSchema[];
  readonly permissions: readonly ChatCommandPermissionRequirement[];
  readonly cooldown: ChatCommandCooldownPolicy;
  readonly route: ChatCommandRouteDescriptor;
  readonly effectKinds: readonly ChatCommandEffectKind[];
  readonly autocompleteTokens: readonly string[];
  readonly exampleUsages: readonly string[];
  readonly transcriptVisible: boolean;
  readonly parserNotes: readonly string[];
}

// ============================================================================
// MARK: Shared helpers
// ============================================================================

function makeAlias(
  namespace: ChatCommandNamespace,
  value: string,
  isPrimary = false,
): ChatCommandAlias {
  return Object.freeze({
    aliasId: `${namespace}:${value}` as ChatCommandAliasId,
    value,
    isPrimary,
    namespace,
  });
}

function permission(
  id: string,
  requirement: ChatCommandAuthRequirement,
  description: string,
  channelFamilies?: readonly ChatChannelFamily[],
  allowedActorKinds?: readonly ChatActorKind[],
  allowedModeScopes?: readonly ChatModeScope[],
): ChatCommandPermissionRequirement {
  return Object.freeze({
    permissionId: id as ChatCommandPermissionId,
    requirement,
    description,
    channelFamilies,
    allowedActorKinds,
    allowedModeScopes,
  });
}

function cooldown(
  id: string,
  scope: ChatCommandCooldownScope,
  durationMs: number,
  burstLimit?: number,
  burstWindowMs?: number,
): ChatCommandCooldownPolicy {
  return Object.freeze({
    cooldownId: id as ChatCommandCooldownId,
    scope,
    durationMs,
    burstLimit,
    burstWindowMs,
  });
}

function arg(
  key: string,
  kind: ChatCommandArgumentKind,
  description: string,
  options?: Partial<ChatCommandArgumentSchema>,
): ChatCommandArgumentSchema {
  return Object.freeze({
    argumentId: key as ChatCommandArgumentId,
    key: key as ChatCommandArgumentKey,
    kind,
    required: options?.required ?? false,
    repeatable: options?.repeatable ?? false,
    description,
    enumValues: options?.enumValues,
    integerRange: options?.integerRange,
    decimalRange: options?.decimalRange,
    maxLength: options?.maxLength,
    minLength: options?.minLength,
    defaultValue: options?.defaultValue,
  });
}

function route(
  routeId: string,
  namespace: ChatCommandNamespace,
  commandKey: string,
  parserId: string,
  ackPolicy: ChatCommandAckPolicy,
  primaryAuthority: ChatAuthority,
  options?: Partial<ChatCommandRouteDescriptor>,
): ChatCommandRouteDescriptor {
  return Object.freeze({
    routeId: routeId as ChatCommandRouteId,
    namespace,
    commandKey,
    parserId: parserId as ChatCommandParserId,
    ackPolicy,
    primaryAuthority,
    fallbackAuthorities: options?.fallbackAuthorities,
    writesTranscript: options?.writesTranscript ?? false,
    emitsSystemMessage: options?.emitsSystemMessage ?? false,
    requiresReplayMarker: options?.requiresReplayMarker ?? false,
    allowsShadowCompanionWrite: options?.allowsShadowCompanionWrite ?? false,
  });
}

function descriptor(
  commandKey: string,
  namespace: ChatCommandNamespace,
  displayName: string,
  description: string,
  config: Omit<ChatCommandDescriptor, 'commandId' | 'namespaceId' | 'namespace' | 'commandKey' | 'displayName' | 'description'>,
): ChatCommandDescriptor {
  return Object.freeze({
    commandId: `${namespace}:${commandKey}` as ChatCommandId,
    namespaceId: namespace as ChatCommandNamespaceId,
    namespace,
    commandKey,
    displayName,
    description,
    ...config,
  });
}

// ============================================================================
// MARK: Help sections
// ============================================================================

export const CHAT_COMMAND_HELP_SECTIONS: readonly ChatCommandHelpSection[] = [
  Object.freeze({
    sectionId: 'system' as ChatCommandHelpSectionId,
    title: 'System & Channel',
    description: 'Commands that control routing, channel focus, and help.',
    commandKeys: ['help', 'channel', 'thread', 'quote', 'mark'],
  }),
  Object.freeze({
    sectionId: 'social' as ChatCommandHelpSectionId,
    title: 'Social & Presence',
    description: 'Commands that shape how the room sees you or other actors.',
    commandKeys: ['mute', 'unmute', 'block', 'unblock', 'silence'],
  }),
  Object.freeze({
    sectionId: 'negotiation' as ChatCommandHelpSectionId,
    title: 'Deal Room',
    description: 'Commands that create, counter, accept, and decline offers.',
    commandKeys: ['offer', 'counter', 'accept', 'decline'],
  }),
  Object.freeze({
    sectionId: 'rescue' as ChatCommandHelpSectionId,
    title: 'Rescue & Recovery',
    description: 'Commands that escalate help or request tactical recovery.',
    commandKeys: ['rescue', 'helper', 'reset-pressure'],
  }),
  Object.freeze({
    sectionId: 'replay' as ChatCommandHelpSectionId,
    title: 'Replay & Transcript',
    description: 'Commands that seek, export, or inspect transcript truth.',
    commandKeys: ['replay', 'seek', 'export', 'excerpt'],
  }),
  Object.freeze({
    sectionId: 'moderation' as ChatCommandHelpSectionId,
    title: 'Moderation',
    description: 'Commands reserved for moderators, system services, and liveops.',
    commandKeys: ['shadow-note', 'redact', 'quarantine', 'world-event'],
  }),
] as const;

// ============================================================================
// MARK: Canonical command descriptors
// ============================================================================

export const CHAT_COMMAND_DESCRIPTORS: readonly ChatCommandDescriptor[] = [
  descriptor('help', 'SYSTEM', 'Help', 'Return command help or contextual suggestions.', {
    aliases: [makeAlias('SYSTEM', 'help', true), makeAlias('SYSTEM', 'h')],
    helpSection: 'system' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: [],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['NONE'],
    arguments: [arg('topic', 'STRING', 'Optional topic or command key.', { maxLength: 64 })],
    permissions: [permission('help:any', 'ANY_AUTHED_PLAYER', 'Any authenticated player may ask for command help.')],
    cooldown: cooldown('help:none', 'NONE', 0),
    route: route('system.help', 'SYSTEM', 'help', 'shared-help-parser', 'IMMEDIATE', 'CLIENT_STAGED', {
      emitsSystemMessage: true,
    }),
    effectKinds: ['INVOKE_HELP'],
    autocompleteTokens: ['/help', '/h'],
    exampleUsages: ['/help', '/help offer', '/help moderation'],
    transcriptVisible: false,
    parserNotes: ['Never mutates transcript truth directly.'],
  }),
  descriptor('channel', 'CHANNEL', 'Channel', 'Switch the active visible chat channel.', {
    aliases: [makeAlias('CHANNEL', 'channel', true), makeAlias('CHANNEL', 'chan')],
    helpSection: 'system' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: [],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['CHANNEL'],
    arguments: [arg('channel', 'ENUM', 'Target visible channel.', { required: true, enumValues: [...CHAT_VISIBLE_CHANNELS] })],
    permissions: [permission('channel:any', 'ANY_AUTHED_PLAYER', 'Players may switch among allowed visible channels.')],
    cooldown: cooldown('channel:session', 'SESSION', 500),
    route: route('channel.switch', 'CHANNEL', 'channel', 'shared-channel-parser', 'IMMEDIATE', 'CLIENT_STAGED'),
    effectKinds: ['SWITCH_CHANNEL'],
    autocompleteTokens: ['/channel', '/chan'],
    exampleUsages: ['/channel GLOBAL', '/chan DEAL_ROOM'],
    transcriptVisible: false,
    parserNotes: ['Validation must still enforce room-level channel policy.'],
  }),
  descriptor('thread', 'CHANNEL', 'Thread', 'Focus a thread or reply branch.', {
    aliases: [makeAlias('CHANNEL', 'thread', true), makeAlias('CHANNEL', 'focus')],
    helpSection: 'system' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: [],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['THREAD', 'MESSAGE'],
    arguments: [arg('thread', 'THREAD_REF', 'Target thread id or root message reference.', { required: true })],
    permissions: [permission('thread:any', 'ANY_AUTHED_PLAYER', 'Players may focus available threads.')],
    cooldown: cooldown('thread:session', 'SESSION', 250),
    route: route('channel.thread', 'CHANNEL', 'thread', 'shared-thread-parser', 'IMMEDIATE', 'CLIENT_STAGED'),
    effectKinds: ['FOCUS_THREAD'],
    autocompleteTokens: ['/thread', '/focus'],
    exampleUsages: ['/thread th_legend_01', '/focus msg_0123'],
    transcriptVisible: false,
    parserNotes: ['Thread focus is a UI and cursor concern, not transcript mutation.'],
  }),
  descriptor('quote', 'CHANNEL', 'Quote', 'Quote a prior message into the current composer or send a quote callback.', {
    aliases: [makeAlias('CHANNEL', 'quote', true), makeAlias('CHANNEL', 'q')],
    helpSection: 'system' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['NPC_SHADOW', 'RIVALRY_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['MESSAGE'],
    arguments: [
      arg('message', 'MESSAGE_REF', 'Message to quote.', { required: true }),
      arg('text', 'STRING', 'Optional added text.', { maxLength: 220 }),
    ],
    permissions: [permission('quote:any', 'ANY_AUTHED_PLAYER', 'Players may quote visible messages.')],
    cooldown: cooldown('quote:session', 'SESSION', 750, 4, 5000),
    route: route('channel.quote', 'CHANNEL', 'quote', 'shared-quote-parser', 'SERVER_ACK', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      emitsSystemMessage: false,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['MARK_MESSAGE'],
    autocompleteTokens: ['/quote', '/q'],
    exampleUsages: ['/quote msg_812', '/q msg_812 Last time this line mattered.'],
    transcriptVisible: true,
    parserNotes: ['Quote callbacks may generate shadow anchor writes for retrieval-backed continuity.'],
  }),
  descriptor('mark', 'CHANNEL', 'Mark', 'Mark a message as important, suspicious, or replay-worthy.', {
    aliases: [makeAlias('CHANNEL', 'mark', true), makeAlias('CHANNEL', 'flag')],
    helpSection: 'system' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['MESSAGE'],
    arguments: [
      arg('message', 'MESSAGE_REF', 'Target message.', { required: true }),
      arg('kind', 'ENUM', 'Mark class.', { required: true, enumValues: ['IMPORTANT', 'SUSPICIOUS', 'REPLAY', 'NEGOTIATION', 'LEGEND'] }),
    ],
    permissions: [permission('mark:any', 'ANY_AUTHED_PLAYER', 'Players may mark messages they can already see.')],
    cooldown: cooldown('mark:session', 'SESSION', 500, 8, 5000),
    route: route('channel.mark', 'CHANNEL', 'mark', 'shared-mark-parser', 'SERVER_ACK', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: false,
      emitsSystemMessage: true,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['MARK_MESSAGE'],
    autocompleteTokens: ['/mark', '/flag'],
    exampleUsages: ['/mark msg_144 IMPORTANT', '/flag msg_144 REPLAY'],
    transcriptVisible: false,
    parserNotes: ['Marks feed proof and replay systems, not visible content by default.'],
  }),
  descriptor('mute', 'SOCIAL', 'Mute', 'Mute a player or NPC locally or at room scope.', {
    aliases: [makeAlias('SOCIAL', 'mute', true)],
    helpSection: 'social' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['USER', 'NPC'],
    arguments: [arg('target', 'USER_REF', 'Target player or actor.', { required: true })],
    permissions: [permission('mute:any', 'ANY_AUTHED_PLAYER', 'Players may mute visible actors for their own session.')],
    cooldown: cooldown('mute:session', 'SESSION', 250),
    route: route('social.mute', 'SOCIAL', 'mute', 'shared-social-parser', 'SERVER_ACK', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['MUTE_TARGET'],
    autocompleteTokens: ['/mute'],
    exampleUsages: ['/mute @raider_12'],
    transcriptVisible: false,
    parserNotes: ['Room-wide mute escalation remains moderator-only.'],
  }),
  descriptor('unmute', 'SOCIAL', 'Unmute', 'Remove a previously applied mute.', {
    aliases: [makeAlias('SOCIAL', 'unmute', true)],
    helpSection: 'social' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['USER', 'NPC'],
    arguments: [arg('target', 'USER_REF', 'Target player or actor.', { required: true })],
    permissions: [permission('unmute:any', 'ANY_AUTHED_PLAYER', 'Players may unmute actors they muted.')],
    cooldown: cooldown('unmute:session', 'SESSION', 250),
    route: route('social.unmute', 'SOCIAL', 'unmute', 'shared-social-parser', 'SERVER_ACK', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['UNMUTE_TARGET'],
    autocompleteTokens: ['/unmute'],
    exampleUsages: ['/unmute @raider_12'],
    transcriptVisible: false,
    parserNotes: ['Pure state mutation; no replay marker required.'],
  }),
  descriptor('block', 'SOCIAL', 'Block', 'Block direct social contact from a user.', {
    aliases: [makeAlias('SOCIAL', 'block', true)],
    helpSection: 'social' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW', 'RIVALRY_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['USER'],
    arguments: [arg('target', 'USER_REF', 'Target player.', { required: true })],
    permissions: [permission('block:any', 'ANY_AUTHED_PLAYER', 'Players may block other players at account scope.')],
    cooldown: cooldown('block:account', 'ACCOUNT', 1000),
    route: route('social.block', 'SOCIAL', 'block', 'shared-social-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['BLOCK_TARGET'],
    autocompleteTokens: ['/block'],
    exampleUsages: ['/block @marketwolf'],
    transcriptVisible: false,
    parserNotes: ['Account-scope block should update relationship and rivalry shadow state.'],
  }),
  descriptor('unblock', 'SOCIAL', 'Unblock', 'Remove an account-level block.', {
    aliases: [makeAlias('SOCIAL', 'unblock', true)],
    helpSection: 'social' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['USER'],
    arguments: [arg('target', 'USER_REF', 'Target player.', { required: true })],
    permissions: [permission('unblock:any', 'ANY_AUTHED_PLAYER', 'Players may remove their own blocks.')],
    cooldown: cooldown('unblock:account', 'ACCOUNT', 1000),
    route: route('social.unblock', 'SOCIAL', 'unblock', 'shared-social-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['UNBLOCK_TARGET'],
    autocompleteTokens: ['/unblock'],
    exampleUsages: ['/unblock @marketwolf'],
    transcriptVisible: false,
    parserNotes: ['Should emit an audit event but not a public message by default.'],
  }),
  descriptor('silence', 'SOCIAL', 'Silence Mode', 'Toggle low-noise rescue-aware silence mode for the current session.', {
    aliases: [makeAlias('SOCIAL', 'silence', true), makeAlias('SOCIAL', 'quiet')],
    helpSection: 'social' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['RESCUE_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['SELF'],
    arguments: [arg('enabled', 'BOOLEAN', 'Optional explicit state.', { defaultValue: true })],
    permissions: [permission('silence:any', 'ANY_AUTHED_PLAYER', 'Players may reduce social pressure for their own session.')],
    cooldown: cooldown('silence:session', 'SESSION', 250),
    route: route('social.silence', 'SOCIAL', 'silence', 'shared-social-parser', 'SERVER_ACK', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['TOGGLE_SILENCE_MODE'],
    autocompleteTokens: ['/silence', '/quiet'],
    exampleUsages: ['/silence', '/quiet false'],
    transcriptVisible: false,
    parserNotes: ['Should feed rescue planner and helper timing policy.'],
  }),
  descriptor('offer', 'NEGOTIATION', 'Offer', 'Submit an offer in the deal room.', {
    aliases: [makeAlias('NEGOTIATION', 'offer', true)],
    helpSection: 'negotiation' as ChatCommandHelpSectionId,
    channelFamilies: ['NEGOTIATION'],
    visibleChannels: ['DEAL_ROOM'],
    shadowChannelsAllowed: ['SYSTEM_SHADOW', 'NPC_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['OFFER', 'USER', 'NPC'],
    arguments: [
      arg('amount', 'DECIMAL', 'Primary offer amount.', { required: true, decimalRange: { min: 0, max: 1000000000 } }),
      arg('terms', 'STRING', 'Optional terms.', { maxLength: 240 }),
      arg('target', 'USER_REF', 'Counterparty.', { required: false }),
    ],
    permissions: [permission('offer:participant', 'NEGOTIATION_PARTICIPANT', 'Only active deal-room participants may submit offers.', ['NEGOTIATION'])],
    cooldown: cooldown('offer:room', 'ROOM', 750, 4, 5000),
    route: route('negotiation.offer', 'NEGOTIATION', 'offer', 'shared-negotiation-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      emitsSystemMessage: false,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['SUBMIT_OFFER'],
    autocompleteTokens: ['/offer'],
    exampleUsages: ['/offer 15000', '/offer 15000 target:@broker_9 terms:3 ticks'],
    transcriptVisible: true,
    parserNotes: ['Negotiation engine may attach bluff risk and urgency shadow annotations.'],
  }),
  descriptor('counter', 'NEGOTIATION', 'Counter', 'Submit a counteroffer in the deal room.', {
    aliases: [makeAlias('NEGOTIATION', 'counter', true)],
    helpSection: 'negotiation' as ChatCommandHelpSectionId,
    channelFamilies: ['NEGOTIATION'],
    visibleChannels: ['DEAL_ROOM'],
    shadowChannelsAllowed: ['SYSTEM_SHADOW', 'NPC_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['OFFER'],
    arguments: [
      arg('offer', 'STRING', 'Offer identifier.', { required: true, maxLength: 128 }),
      arg('amount', 'DECIMAL', 'Counter amount.', { required: true, decimalRange: { min: 0, max: 1000000000 } }),
      arg('terms', 'STRING', 'Optional terms.', { maxLength: 240 }),
    ],
    permissions: [permission('counter:participant', 'NEGOTIATION_PARTICIPANT', 'Only active deal-room participants may submit counters.', ['NEGOTIATION'])],
    cooldown: cooldown('counter:room', 'ROOM', 750, 4, 5000),
    route: route('negotiation.counter', 'NEGOTIATION', 'counter', 'shared-negotiation-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['SUBMIT_COUNTER'],
    autocompleteTokens: ['/counter'],
    exampleUsages: ['/counter offer_17 12500'],
    transcriptVisible: true,
    parserNotes: ['Counteroffers must preserve offer-thread causality for replay and proof.'],
  }),
  descriptor('accept', 'NEGOTIATION', 'Accept', 'Accept a negotiation offer.', {
    aliases: [makeAlias('NEGOTIATION', 'accept', true)],
    helpSection: 'negotiation' as ChatCommandHelpSectionId,
    channelFamilies: ['NEGOTIATION'],
    visibleChannels: ['DEAL_ROOM'],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['OFFER'],
    arguments: [arg('offer', 'STRING', 'Offer identifier.', { required: true, maxLength: 128 })],
    permissions: [permission('accept:participant', 'NEGOTIATION_PARTICIPANT', 'Only active deal-room participants may accept offers.', ['NEGOTIATION'])],
    cooldown: cooldown('accept:room', 'ROOM', 500),
    route: route('negotiation.accept', 'NEGOTIATION', 'accept', 'shared-negotiation-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      emitsSystemMessage: true,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['ACCEPT_OFFER'],
    autocompleteTokens: ['/accept'],
    exampleUsages: ['/accept offer_17'],
    transcriptVisible: true,
    parserNotes: ['May emit a visible recap plus shadow trust/reputation updates.'],
  }),
  descriptor('decline', 'NEGOTIATION', 'Decline', 'Decline a negotiation offer.', {
    aliases: [makeAlias('NEGOTIATION', 'decline', true)],
    helpSection: 'negotiation' as ChatCommandHelpSectionId,
    channelFamilies: ['NEGOTIATION'],
    visibleChannels: ['DEAL_ROOM'],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['OFFER'],
    arguments: [
      arg('offer', 'STRING', 'Offer identifier.', { required: true, maxLength: 128 }),
      arg('reason', 'STRING', 'Optional decline note.', { maxLength: 160 }),
    ],
    permissions: [permission('decline:participant', 'NEGOTIATION_PARTICIPANT', 'Only active deal-room participants may decline offers.', ['NEGOTIATION'])],
    cooldown: cooldown('decline:room', 'ROOM', 500),
    route: route('negotiation.decline', 'NEGOTIATION', 'decline', 'shared-negotiation-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      emitsSystemMessage: true,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['DECLINE_OFFER'],
    autocompleteTokens: ['/decline'],
    exampleUsages: ['/decline offer_17 reason:need more time'],
    transcriptVisible: true,
    parserNotes: ['Decline reasons should be safe for moderation and replay export.'],
  }),
  descriptor('rescue', 'RESCUE', 'Rescue', 'Request an explicit helper intervention.', {
    aliases: [makeAlias('RESCUE', 'rescue', true), makeAlias('RESCUE', 'helpme')],
    helpSection: 'rescue' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION'],
    visibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    shadowChannelsAllowed: ['RESCUE_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['SELF'],
    arguments: [arg('urgency', 'ENUM', 'Urgency level.', { enumValues: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], defaultValue: 'MEDIUM' })],
    permissions: [permission('rescue:any', 'ANY_AUTHED_PLAYER', 'Any player may request rescue support.')],
    cooldown: cooldown('rescue:session', 'SESSION', 2000, 2, 15000),
    route: route('rescue.request', 'RESCUE', 'rescue', 'shared-rescue-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      emitsSystemMessage: true,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['REQUEST_RESCUE'],
    autocompleteTokens: ['/rescue', '/helpme'],
    exampleUsages: ['/rescue', '/helpme urgency:CRITICAL'],
    transcriptVisible: true,
    parserNotes: ['Rescue requests should seed helper timing, silence policy, and drop-off mitigation.'],
  }),
  descriptor('helper', 'RESCUE', 'Helper', 'Call a specific helper persona if available.', {
    aliases: [makeAlias('RESCUE', 'helper', true)],
    helpSection: 'rescue' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION'],
    visibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    shadowChannelsAllowed: ['RESCUE_SHADOW', 'NPC_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['NPC'],
    arguments: [arg('npc', 'NPC_REF', 'Helper persona.', { required: true })],
    permissions: [permission('helper:any', 'HELPER_ELIGIBLE', 'Only helper-eligible players may force a helper summon.')],
    cooldown: cooldown('helper:session', 'SESSION', 4000),
    route: route('rescue.helper', 'RESCUE', 'helper', 'shared-rescue-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      emitsSystemMessage: false,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['REQUEST_RESCUE'],
    autocompleteTokens: ['/helper'],
    exampleUsages: ['/helper npc:kade'],
    transcriptVisible: true,
    parserNotes: ['Backend may downgrade to suggestion-only if the helper is unavailable or suppressed.'],
  }),
  descriptor('reset-pressure', 'RESCUE', 'Reset Pressure', 'Request a one-step recovery prompt rather than full chatter.', {
    aliases: [makeAlias('RESCUE', 'reset-pressure', true), makeAlias('RESCUE', 'reset')],
    helpSection: 'rescue' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION'],
    visibleChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    shadowChannelsAllowed: ['RESCUE_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['SELF'],
    arguments: [],
    permissions: [permission('reset:any', 'ANY_AUTHED_PLAYER', 'Any player may request a low-noise recovery move.')],
    cooldown: cooldown('reset:session', 'SESSION', 5000),
    route: route('rescue.reset', 'RESCUE', 'reset-pressure', 'shared-rescue-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['REQUEST_RESCUE'],
    autocompleteTokens: ['/reset-pressure', '/reset'],
    exampleUsages: ['/reset-pressure'],
    transcriptVisible: false,
    parserNotes: ['Designed for churn interception without escalating social visibility.'],
  }),
  descriptor('replay', 'REPLAY', 'Replay', 'Open replay mode or the run-linked chat replay surface.', {
    aliases: [makeAlias('REPLAY', 'replay', true)],
    helpSection: 'replay' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: [],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['REPLAY', 'TRANSCRIPT'],
    arguments: [arg('replay', 'STRING', 'Optional replay id.', { maxLength: 128 })],
    permissions: [permission('replay:any', 'ANY_AUTHED_PLAYER', 'Players may open replay surfaces they can access.')],
    cooldown: cooldown('replay:session', 'SESSION', 250),
    route: route('replay.open', 'REPLAY', 'replay', 'shared-replay-parser', 'IMMEDIATE', 'CLIENT_STAGED'),
    effectKinds: ['SEEK_REPLAY'],
    autocompleteTokens: ['/replay'],
    exampleUsages: ['/replay', '/replay rp_20260315_01'],
    transcriptVisible: false,
    parserNotes: ['UI action only until a seek/export mutation is requested.'],
  }),
  descriptor('seek', 'REPLAY', 'Seek', 'Seek replay or transcript to a specific message, moment, or offset.', {
    aliases: [makeAlias('REPLAY', 'seek', true)],
    helpSection: 'replay' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: [],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['MESSAGE', 'REPLAY', 'TRANSCRIPT'],
    arguments: [
      arg('target', 'STRING', 'Replay id, message id, or offset expression.', { required: true, maxLength: 128 }),
    ],
    permissions: [permission('seek:any', 'ANY_AUTHED_PLAYER', 'Players may seek replay surfaces they can view.')],
    cooldown: cooldown('seek:session', 'SESSION', 250),
    route: route('replay.seek', 'REPLAY', 'seek', 'shared-replay-parser', 'IMMEDIATE', 'CLIENT_STAGED'),
    effectKinds: ['SEEK_REPLAY'],
    autocompleteTokens: ['/seek'],
    exampleUsages: ['/seek msg_1224', '/seek +30s'],
    transcriptVisible: false,
    parserNotes: ['Cursor and transcript window contracts should interpret the final seek target.'],
  }),
  descriptor('export', 'REPLAY', 'Export', 'Export a transcript slice or replay-ready chat package.', {
    aliases: [makeAlias('REPLAY', 'export', true)],
    helpSection: 'replay' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['TRANSCRIPT', 'REPLAY'],
    arguments: [
      arg('scope', 'ENUM', 'Export scope.', { required: true, enumValues: ['WINDOW', 'THREAD', 'RUN', 'LEGEND_ONLY'] }),
      arg('format', 'ENUM', 'Export format.', { required: false, enumValues: ['JSON', 'NDJSON', 'CSV', 'MARKDOWN'], defaultValue: 'JSON' }),
    ],
    permissions: [permission('export:any', 'ANY_AUTHED_PLAYER', 'Players may export accessible transcript slices.')],
    cooldown: cooldown('export:session', 'SESSION', 3000),
    route: route('replay.export', 'REPLAY', 'export', 'shared-replay-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      requiresReplayMarker: true,
    }),
    effectKinds: ['EXPORT_TRANSCRIPT'],
    autocompleteTokens: ['/export'],
    exampleUsages: ['/export WINDOW', '/export RUN format:NDJSON'],
    transcriptVisible: false,
    parserNotes: ['Export requests should pass through moderation and privacy policy before fulfillment.'],
  }),
  descriptor('excerpt', 'REPLAY', 'Excerpt', 'Create a compact excerpt around a moment or message.', {
    aliases: [makeAlias('REPLAY', 'excerpt', true)],
    helpSection: 'replay' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['MESSAGE', 'TRANSCRIPT'],
    arguments: [arg('target', 'STRING', 'Moment id, message id, or legend id.', { required: true, maxLength: 128 })],
    permissions: [permission('excerpt:any', 'ANY_AUTHED_PLAYER', 'Players may request excerpts around accessible moments.')],
    cooldown: cooldown('excerpt:session', 'SESSION', 1000),
    route: route('replay.excerpt', 'REPLAY', 'excerpt', 'shared-replay-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      requiresReplayMarker: false,
    }),
    effectKinds: ['EXPORT_TRANSCRIPT'],
    autocompleteTokens: ['/excerpt'],
    exampleUsages: ['/excerpt msg_1202'],
    transcriptVisible: false,
    parserNotes: ['Excerpt generation should preserve proof links where available.'],
  }),
  descriptor('shadow-note', 'MODERATION', 'Shadow Note', 'Create a system-shadow moderation note without visible transcript mutation.', {
    aliases: [makeAlias('MODERATION', 'shadow-note', true)],
    helpSection: 'moderation' as ChatCommandHelpSectionId,
    channelFamilies: ['SHADOW'],
    visibleChannels: [],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['MESSAGE', 'USER', 'NPC', 'THREAD'],
    arguments: [
      arg('target', 'STRING', 'Target id.', { required: true, maxLength: 128 }),
      arg('note', 'STRING', 'Shadow note body.', { required: true, maxLength: 400 }),
    ],
    permissions: [permission('shadow-note:mod', 'MODERATOR_ONLY', 'Reserved for moderators and trusted system actors.')],
    cooldown: cooldown('shadow-note:room', 'ROOM', 250),
    route: route('moderation.shadow-note', 'MODERATION', 'shadow-note', 'shared-moderation-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: false,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['SHADOW_WRITE'],
    autocompleteTokens: ['/shadow-note'],
    exampleUsages: ['/shadow-note target:msg_1202 note:possible manipulation loop'],
    transcriptVisible: false,
    parserNotes: ['Strictly shadow-only. Never rendered as a visible chat message.'],
  }),
  descriptor('redact', 'MODERATION', 'Redact', 'Redact a visible message while preserving audit and proof edges.', {
    aliases: [makeAlias('MODERATION', 'redact', true)],
    helpSection: 'moderation' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['MESSAGE'],
    arguments: [
      arg('message', 'MESSAGE_REF', 'Message to redact.', { required: true }),
      arg('reason', 'STRING', 'Reason code or note.', { required: true, maxLength: 128 }),
    ],
    permissions: [permission('redact:mod', 'MODERATOR_ONLY', 'Reserved for moderators and backend authority.')],
    cooldown: cooldown('redact:room', 'ROOM', 100),
    route: route('moderation.redact', 'MODERATION', 'redact', 'shared-moderation-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: true,
      emitsSystemMessage: true,
      requiresReplayMarker: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['ROUTE_TO_MODERATION'],
    autocompleteTokens: ['/redact'],
    exampleUsages: ['/redact msg_1202 spam'],
    transcriptVisible: false,
    parserNotes: ['Must preserve auditability and redaction lineage, not hard-delete content.'],
  }),
  descriptor('quarantine', 'MODERATION', 'Quarantine', 'Quarantine a user or NPC at the chat policy layer.', {
    aliases: [makeAlias('MODERATION', 'quarantine', true)],
    helpSection: 'moderation' as ChatCommandHelpSectionId,
    channelFamilies: ['PUBLIC', 'PRIVATE', 'NEGOTIATION', 'PRE_RUN'],
    visibleChannels: [...CHAT_VISIBLE_CHANNELS],
    shadowChannelsAllowed: ['SYSTEM_SHADOW', 'RIVALRY_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['USER', 'NPC'],
    arguments: [
      arg('target', 'STRING', 'Target actor id.', { required: true, maxLength: 128 }),
      arg('duration', 'INTEGER', 'Duration in seconds.', { required: false, integerRange: { min: 1, max: 86400 }, defaultValue: 300 }),
    ],
    permissions: [permission('quarantine:mod', 'MODERATOR_ONLY', 'Reserved for moderators and backend authority.')],
    cooldown: cooldown('quarantine:room', 'ROOM', 100),
    route: route('moderation.quarantine', 'MODERATION', 'quarantine', 'shared-moderation-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['ROUTE_TO_MODERATION'],
    autocompleteTokens: ['/quarantine'],
    exampleUsages: ['/quarantine @raider_77 600'],
    transcriptVisible: false,
    parserNotes: ['Quarantine should route future content through stricter moderation and suppression policy.'],
  }),
  descriptor('world-event', 'LIVEOPS', 'World Event', 'Inject or stage a liveops world event into the chat runtime.', {
    aliases: [makeAlias('LIVEOPS', 'world-event', true), makeAlias('LIVEOPS', 'wevent')],
    helpSection: 'moderation' as ChatCommandHelpSectionId,
    channelFamilies: ['SHADOW'],
    visibleChannels: [],
    shadowChannelsAllowed: ['LIVEOPS_SHADOW', 'SYSTEM_SHADOW'],
    modeScopes: [...CHAT_MODE_SCOPES],
    targetKinds: ['WORLD_EVENT'],
    arguments: [
      arg('event', 'STRING', 'World event key.', { required: true, maxLength: 128 }),
      arg('duration', 'INTEGER', 'Duration seconds.', { required: false, integerRange: { min: 1, max: 86400 }, defaultValue: 1200 }),
      arg('public', 'BOOLEAN', 'Whether the event should become visible.', { defaultValue: true }),
    ],
    permissions: [permission('wevent:liveops', 'LIVEOPS_ONLY', 'Reserved for liveops and system orchestration.')],
    cooldown: cooldown('wevent:global', 'GLOBAL', 0),
    route: route('liveops.world-event', 'LIVEOPS', 'world-event', 'shared-liveops-parser', 'BACKEND_AUTHORITY', 'BACKEND_AUTHORITATIVE', {
      writesTranscript: false,
      emitsSystemMessage: true,
      allowsShadowCompanionWrite: true,
    }),
    effectKinds: ['SHADOW_WRITE'],
    autocompleteTokens: ['/world-event', '/wevent'],
    exampleUsages: ['/world-event liquidator_hunt duration:1200 public:true'],
    transcriptVisible: false,
    parserNotes: ['Visible rendering happens only after world-event policy approves reveal.'],
  }),
] as const;

// ============================================================================
// MARK: Derived indexes and lookups
// ============================================================================

export const CHAT_COMMAND_DESCRIPTOR_BY_KEY: Readonly<Record<string, ChatCommandDescriptor>> =
  Object.freeze(
    Object.fromEntries(
      CHAT_COMMAND_DESCRIPTORS.map((item) => [item.commandKey, item]),
    ),
  );

export const CHAT_COMMAND_DESCRIPTOR_BY_ALIAS: Readonly<Record<string, ChatCommandDescriptor>> =
  Object.freeze(
    Object.fromEntries(
      CHAT_COMMAND_DESCRIPTORS.flatMap((item) =>
        item.aliases.map((alias) => [alias.value.toLowerCase(), item] as const),
      ),
    ),
  );

export const CHAT_COMMAND_KEYS = Object.freeze(
  CHAT_COMMAND_DESCRIPTORS.map((item) => item.commandKey),
) as readonly string[];

export const CHAT_COMMAND_NAMESPACES_BY_KEY: Readonly<Record<string, ChatCommandNamespace>> =
  Object.freeze(
    Object.fromEntries(
      CHAT_COMMAND_DESCRIPTORS.map((item) => [item.commandKey, item.namespace]),
    ),
  );

// ============================================================================
// MARK: Suggestions and presets
// ============================================================================

export const CHAT_DEFAULT_COMMAND_SUGGESTIONS: readonly ChatCommandSuggestion[] = [
  Object.freeze({
    suggestionId: 'suggest:offer' as ChatCommandSuggestionId,
    commandKey: 'offer',
    namespace: 'NEGOTIATION',
    title: 'Make an offer',
    description: 'Fast path into deal-room negotiation.',
    example: '/offer 15000',
    score: 0.91 as Score01,
    allowedInChannelFamilies: ['NEGOTIATION' as ChatChannelFamily],
    allowedInModeScopes: [...CHAT_MODE_SCOPES],
  }),
  Object.freeze({
    suggestionId: 'suggest:rescue' as ChatCommandSuggestionId,
    commandKey: 'rescue',
    namespace: 'RESCUE',
    title: 'Ask for help',
    description: 'Escalate a helper when pressure spikes.',
    example: '/rescue urgency:HIGH',
    score: 0.88 as Score01,
    allowedInChannelFamilies: ['PUBLIC' as ChatChannelFamily, 'PRIVATE' as ChatChannelFamily, 'NEGOTIATION' as ChatChannelFamily],
    allowedInModeScopes: [...CHAT_MODE_SCOPES],
  }),
  Object.freeze({
    suggestionId: 'suggest:quote' as ChatCommandSuggestionId,
    commandKey: 'quote',
    namespace: 'CHANNEL',
    title: 'Quote a line',
    description: 'Carry a prior line into the current exchange.',
    example: '/quote msg_812',
    score: 0.74 as Score01,
    allowedInChannelFamilies: ['PUBLIC' as ChatChannelFamily, 'PRIVATE' as ChatChannelFamily, 'NEGOTIATION' as ChatChannelFamily, 'PRE_RUN' as ChatChannelFamily],
    allowedInModeScopes: [...CHAT_MODE_SCOPES],
  }),
] as const;

export interface ChatCommandPreset {
  readonly presetId: ChatCommandPresetId;
  readonly title: string;
  readonly description: string;
  readonly commands: readonly string[];
  readonly channelFamily: ChatChannelFamily;
}

export const CHAT_COMMAND_PRESETS: readonly ChatCommandPreset[] = [
  Object.freeze({
    presetId: 'preset:dealroom' as ChatCommandPresetId,
    title: 'Deal Room Core',
    description: 'Core negotiation command set.',
    commands: ['offer', 'counter', 'accept', 'decline'],
    channelFamily: 'NEGOTIATION',
  }),
  Object.freeze({
    presetId: 'preset:recovery' as ChatCommandPresetId,
    title: 'Recovery Core',
    description: 'Commands used when pressure and frustration spike.',
    commands: ['rescue', 'helper', 'reset-pressure', 'silence'],
    channelFamily: 'PUBLIC',
  }),
  Object.freeze({
    presetId: 'preset:moderation' as ChatCommandPresetId,
    title: 'Moderation Core',
    description: 'System and moderator-only command set.',
    commands: ['shadow-note', 'redact', 'quarantine', 'world-event'],
    channelFamily: 'SHADOW',
  }),
] as const;

// ============================================================================
// MARK: Legacy compatibility shims
// ============================================================================

export interface LegacyChatSlashCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export interface LegacyChatCommandParseOutcome {
  readonly ok: boolean;
  readonly command?: string;
  readonly reason?: string;
}

export function isChatCommandNamespace(value: string): value is ChatCommandNamespace {
  return (CHAT_COMMAND_NAMESPACES as readonly string[]).includes(value);
}

export function isChatCommandSurface(value: string): value is ChatCommandSurface {
  return (CHAT_COMMAND_SURFACES as readonly string[]).includes(value);
}

export function isChatCommandTargetKind(value: string): value is ChatCommandTargetKind {
  return (CHAT_COMMAND_TARGET_KINDS as readonly string[]).includes(value);
}

export function isChatCommandKey(value: string): boolean {
  return CHAT_COMMAND_KEYS.includes(value);
}

export function getChatCommandDescriptor(input: string): ChatCommandDescriptor | undefined {
  const normalized = input.trim().replace(/^\//, '').toLowerCase();
  return CHAT_COMMAND_DESCRIPTOR_BY_KEY[normalized] ?? CHAT_COMMAND_DESCRIPTOR_BY_ALIAS[normalized];
}

export function getChatCommandsForChannelFamily(
  family: ChatChannelFamily,
): readonly ChatCommandDescriptor[] {
  return CHAT_COMMAND_DESCRIPTORS.filter((item) => item.channelFamilies.includes(family));
}

export function getChatCommandsForModeScope(
  scope: ChatModeScope,
): readonly ChatCommandDescriptor[] {
  return CHAT_COMMAND_DESCRIPTORS.filter((item) => item.modeScopes.includes(scope));
}

export function getChatCommandsForVisibleChannel(
  channelId: ChatChannelId,
): readonly ChatCommandDescriptor[] {
  return CHAT_COMMAND_DESCRIPTORS.filter((item) => item.visibleChannels.includes(channelId));
}

export function buildLegacySlashCommand(
  input: string,
): LegacyChatSlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const tokens = trimmed.slice(1).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }
  return Object.freeze({
    command: tokens[0].toLowerCase(),
    args: tokens.slice(1),
  });
}

export function buildLegacyChatCommandParseOutcome(
  input: string,
): LegacyChatCommandParseOutcome {
  const legacy = buildLegacySlashCommand(input);
  if (!legacy) {
    return Object.freeze({ ok: false, reason: 'Not a slash command.' });
  }
  const descriptor = getChatCommandDescriptor(legacy.command);
  if (!descriptor) {
    return Object.freeze({ ok: false, command: legacy.command, reason: 'Unknown command.' });
  }
  return Object.freeze({ ok: true, command: descriptor.commandKey });
}

// ============================================================================
// MARK: Contract descriptor
// ============================================================================

export const CHAT_COMMAND_CONTRACT_DESCRIPTOR = Object.freeze({
  name: 'ChatCommand',
  version: '1.0.0-alpha',
  contractVersion: CHAT_CONTRACT_VERSION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  totalCommands: CHAT_COMMAND_DESCRIPTORS.length,
  namespaces: CHAT_COMMAND_NAMESPACES,
  surfaces: CHAT_COMMAND_SURFACES,
  targetKinds: CHAT_COMMAND_TARGET_KINDS,
  validationCodes: CHAT_COMMAND_VALIDATION_CODES,
  telemetryEvents: CHAT_COMMAND_TELEMETRY_EVENT_NAMES,
  helpSections: CHAT_COMMAND_HELP_SECTIONS.map((item) => item.sectionId),
} as const);

export type ChatCommandContractDescriptor = typeof CHAT_COMMAND_CONTRACT_DESCRIPTOR;
