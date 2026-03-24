/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT COMMAND PARSER
 * FILE: backend/src/game/engine/chat/ChatCommandParser.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend command parsing and command-law execution for the
 * authoritative chat lane.
 *
 * Backend-truth question
 * ----------------------
 * This module answers:
 *
 *   "If a player attempts a slash or structured chat command inside an
 *    authoritative room, what command did they mean, is it legal here, and what
 *    backend-visible effects should be emitted before transcript mutation?"
 *
 * Design doctrine
 * ---------------
 * - commands are not transport concerns;
 * - commands are not UI conveniences;
 * - commands are not reducer mutations by themselves;
 * - commands are parsed and validated before transcript truth is written;
 * - accepted command effects become system messages, shadow writes, and backend
 *   intent outputs that downstream policy/orchestration may honor or reject.
 *
 * This file therefore does more than split on spaces. It owns:
 * - prefix detection and command tokenization,
 * - alias normalization,
 * - quoted and escaped argument parsing,
 * - structured flag parsing (--flag, --key=value, key:value),
 * - room/role/channel legality checks,
 * - command-specific policy law,
 * - explainable execution bundles,
 * - system-message generation for accepted commands,
 * - backend shadow-write generation for non-visible side effects.
 *
 * Why this file is large
 * ----------------------
 * Your locked backend tree makes ChatCommandParser.ts a core law file sitting
 * between player intent and authoritative mutation. That means it must be deep,
 * deterministic, explainable, and extraction-ready.
 * ============================================================================
 */

import {
  CHAT_CHANNEL_DESCRIPTORS,
  CHAT_MOUNT_POLICIES,
  type ChatChannelDecision,
  type ChatChannelId,
  type ChatCommandExecution,
  type ChatPlayerMessageSubmitRequest,
  type ChatRoomId,
  type ChatRoomKind,
  type ChatRoomStageMood,
  type ChatRoomState,
  type ChatMountPolicy,
  type ChatRuntimeConfig,
  type ChatSessionRole,
  type ChatSessionState,
  type ChatSourceType,
  type ChatState,
  type ChatVisibleChannel,
  type JsonValue,
  type UnixMs,
} from './types';
import {
  DEFAULT_BACKEND_CHAT_RUNTIME,
  mergeRuntimeConfig,
  runtimeAllowsVisibleChannel,
  type ChatRuntimeConfigOptions,
} from './ChatRuntimeConfig';

// ============================================================================
// MARK: Ports, options, and context
// ============================================================================

export interface ChatCommandParserLoggerPort {
  debug(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  warn(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
  error(message: string, payload?: Readonly<Record<string, JsonValue>>): void;
}

export interface ChatCommandParserOptions {
  readonly runtime?: Partial<ChatRuntimeConfig>;
  readonly runtimeOptions?: ChatRuntimeConfigOptions;
  readonly logger?: ChatCommandParserLoggerPort;
  readonly commandPrefix?: string;
}

export interface ChatCommandParserContext {
  readonly runtime: ChatRuntimeConfig;
  readonly logger: ChatCommandParserLoggerPort;
  readonly commandPrefix: string;
}

export interface ChatCommandParseRequest {
  readonly request: ChatPlayerMessageSubmitRequest;
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly sourceType?: ChatSourceType;
  readonly suggestedChannelDecision?: ChatChannelDecision;
}

export interface ChatCommandExecutionEnvelope {
  readonly execution: ChatCommandExecution;
  readonly parsed: ChatParsedCommand | null;
  readonly systemMessages: readonly string[];
  readonly shadowWrites: readonly string[];
  readonly requestedChannelSwitch: ChatVisibleChannel | null;
  readonly requestedPresenceMode: ChatPresenceCommandMode | null;
  readonly requestedReplayAnchor: string | null;
  readonly requestedProofLookup: string | null;
  readonly requestedFocusIntent: string | null;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

// ============================================================================
// MARK: Token, AST, and registry types
// ============================================================================

export type ChatCommandName =
  | 'help'
  | 'clear'
  | 'mood'
  | 'focus'
  | 'channel'
  | 'who'
  | 'away'
  | 'back'
  | 'hide'
  | 'rescue'
  | 'proof'
  | 'replay'
  | 'deal'
  | 'heat'
  | 'hush'
  | 'ping'
  | 'legend';

export type ChatPresenceCommandMode =
  | 'AWAY'
  | 'BACK'
  | 'HIDE';

export interface ChatCommandToken {
  readonly raw: string;
  readonly normalized: string;
  readonly quoted: boolean;
  readonly index: number;
}

export interface ChatCommandFlag {
  readonly key: string;
  readonly value: string | true;
}

export interface ChatKeyValueArgument {
  readonly key: string;
  readonly value: string;
}

export interface ChatParsedCommand {
  readonly prefix: string;
  readonly rawName: string;
  readonly name: ChatCommandName;
  readonly aliasUsed: boolean;
  readonly rawText: string;
  readonly remainderText: string;
  readonly tokens: readonly ChatCommandToken[];
  readonly positional: readonly string[];
  readonly flags: readonly ChatCommandFlag[];
  readonly keyValues: readonly ChatKeyValueArgument[];
  readonly mentionedChannels: readonly ChatVisibleChannel[];
}

export interface ChatCommandHandlerRequest {
  readonly parse: ChatParsedCommand;
  readonly room: ChatRoomState;
  readonly session: ChatSessionState;
  readonly state: ChatState;
  readonly now: UnixMs;
  readonly sourceType: ChatSourceType;
  readonly suggestedChannelDecision: ChatChannelDecision | null;
  readonly runtime: ChatRuntimeConfig;
}

export interface ChatCommandHandlerResponse {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly generatedSystemMessages: readonly string[];
  readonly shadowWrites: readonly string[];
  readonly requestedChannelSwitch: ChatVisibleChannel | null;
  readonly requestedPresenceMode: ChatPresenceCommandMode | null;
  readonly requestedReplayAnchor: string | null;
  readonly requestedProofLookup: string | null;
  readonly requestedFocusIntent: string | null;
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface ChatCommandDescriptor {
  readonly name: ChatCommandName;
  readonly aliases: readonly string[];
  readonly helpLine: string;
  readonly roomKinds: readonly ChatRoomKind[];
  readonly roles: readonly ChatSessionRole[];
  readonly visibleChannelsRequired?: readonly ChatVisibleChannel[];
  readonly requiresComposerChannelSupport?: boolean;
  readonly acceptsStructuredArguments: boolean;
  readonly handler: (request: ChatCommandHandlerRequest) => ChatCommandHandlerResponse;
}

// ============================================================================
// MARK: No-op logger and registry constants
// ============================================================================

const NOOP_LOGGER: ChatCommandParserLoggerPort = {
  debug: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const ALL_COMMAND_ROLES: readonly ChatSessionRole[] = ['PLAYER', 'SPECTATOR', 'SYSTEM', 'MODERATOR', 'NPC'];
const PLAYER_LIKE_ROLES: readonly ChatSessionRole[] = ['PLAYER', 'MODERATOR', 'SYSTEM'];
const PLAYER_AND_SPECTATOR_ROLES: readonly ChatSessionRole[] = ['PLAYER', 'SPECTATOR', 'MODERATOR', 'SYSTEM'];
const ROOM_KINDS_ALL: readonly ChatRoomKind[] = ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE', 'SYSTEM'];

const CHANNEL_ALIAS_MAP: Readonly<Record<string, ChatVisibleChannel>> = Object.freeze({
  global: 'GLOBAL',
  g: 'GLOBAL',
  syndicate: 'SYNDICATE',
  synd: 'SYNDICATE',
  s: 'SYNDICATE',
  deal: 'DEAL_ROOM',
  dealroom: 'DEAL_ROOM',
  deal_room: 'DEAL_ROOM',
  d: 'DEAL_ROOM',
  lobby: 'LOBBY',
  l: 'LOBBY',
});

const PRESENCE_ALIAS_MAP: Readonly<Record<string, ChatPresenceCommandMode>> = Object.freeze({
  away: 'AWAY',
  afk: 'AWAY',
  back: 'BACK',
  return: 'BACK',
  hide: 'HIDE',
  invisible: 'HIDE',
});

// ============================================================================
// MARK: Presence mode resolver
// ============================================================================

export function resolvePresenceMode(raw: string): ChatPresenceCommandMode | null {
  return PRESENCE_ALIAS_MAP[raw.toLowerCase()] ?? null;
}

const HELP_SECTIONS: Readonly<Record<ChatRoomKind, readonly ChatCommandName[]>> = Object.freeze({
  GLOBAL: ['help', 'clear', 'mood', 'focus', 'channel', 'who', 'away', 'back', 'hide', 'proof', 'replay', 'heat', 'ping', 'legend'],
  SYNDICATE: ['help', 'clear', 'mood', 'focus', 'channel', 'who', 'away', 'back', 'hide', 'proof', 'replay', 'heat', 'hush', 'ping', 'legend'],
  DEAL_ROOM: ['help', 'clear', 'mood', 'focus', 'channel', 'who', 'away', 'back', 'hide', 'proof', 'replay', 'deal', 'heat', 'hush', 'ping', 'legend'],
  LOBBY: ['help', 'clear', 'mood', 'focus', 'channel', 'who', 'away', 'back', 'hide', 'rescue', 'proof', 'replay', 'ping'],
  PRIVATE: ['help', 'clear', 'mood', 'focus', 'channel', 'who', 'hide', 'proof', 'replay', 'deal', 'hush', 'ping'],
  SYSTEM: ['help', 'mood', 'proof', 'replay', 'legend'],
});

// ============================================================================
// MARK: Parser class
// ============================================================================

export class ChatCommandParser {
  private readonly context: ChatCommandParserContext;
  private readonly registry: Readonly<Record<ChatCommandName, ChatCommandDescriptor>>;
  private readonly aliasIndex: Readonly<Record<string, ChatCommandName>>;

  constructor(options?: ChatCommandParserOptions) {
    this.context = Object.freeze({
      runtime: mergeRuntimeConfig(options?.runtime, options?.runtimeOptions),
      logger: options?.logger ?? NOOP_LOGGER,
      commandPrefix: options?.commandPrefix ?? '/',
    });

    this.registry = createCommandRegistry();
    this.aliasIndex = createAliasIndex(this.registry);
  }

  public getRuntime(): ChatRuntimeConfig {
    return this.context.runtime;
  }

  public execute(request: ChatCommandParseRequest): ChatCommandExecutionEnvelope {
    const text = request.request.text.trim();

    if (!isCommandText(text, this.context.commandPrefix)) {
      return createPassThroughEnvelope();
    }

    if (!this.context.runtime.moderationPolicy.allowSlashCommands) {
      return createRejectedEnvelope({
        commandName: 'disabled',
        reasons: ['Slash commands are disabled by runtime policy.'],
      });
    }

    const parsed = this.parseCommandText(text);
    if (!parsed) {
      return createRejectedEnvelope({
        commandName: 'invalid',
        reasons: ['Command could not be parsed.'],
      });
    }

    const descriptor = this.registry[parsed.name];
    const preflightIssues = this.preflight({
      parse: parsed,
      room: request.room,
      session: request.session,
      state: request.state,
      now: request.now,
      sourceType: request.sourceType ?? 'PLAYER',
      suggestedChannelDecision: request.suggestedChannelDecision ?? null,
      runtime: this.context.runtime,
    }, descriptor);

    if (preflightIssues.length > 0) {
      return toEnvelope(parsed, {
        accepted: false,
        reasons: preflightIssues,
        generatedSystemMessages: [],
        shadowWrites: [],
        requestedChannelSwitch: null,
        requestedPresenceMode: null,
        requestedReplayAnchor: null,
        requestedProofLookup: null,
        requestedFocusIntent: null,
      });
    }

    const response = descriptor.handler({
      parse: parsed,
      room: request.room,
      session: request.session,
      state: request.state,
      now: request.now,
      sourceType: request.sourceType ?? 'PLAYER',
      suggestedChannelDecision: request.suggestedChannelDecision ?? null,
      runtime: this.context.runtime,
    });

    return toEnvelope(parsed, response);
  }

  public parseCommandText(text: string): ChatParsedCommand | null {
    const trimmed = text.trim();
    if (!isCommandText(trimmed, this.context.commandPrefix)) {
      return null;
    }

    const withoutPrefix = trimmed.slice(this.context.commandPrefix.length).trim();
    if (!withoutPrefix) {
      return null;
    }

    const tokens = tokenizeCommand(withoutPrefix);
    if (tokens.length === 0) {
      return null;
    }

    const rawName = tokens[0].normalized;
    const resolvedName = this.resolveCommandName(rawName);
    if (!resolvedName) {
      return {
        prefix: this.context.commandPrefix,
        rawName,
        name: 'help',
        aliasUsed: false,
        rawText: trimmed,
        remainderText: withoutPrefix.slice(tokens[0].raw.length).trim(),
        tokens,
        positional: [],
        flags: [],
        keyValues: [],
        mentionedChannels: [],
      };
    }

    const { positional, flags, keyValues, mentionedChannels } = parseArguments(tokens.slice(1));
    const remainderText = withoutPrefix.slice(tokens[0].raw.length).trim();

    return Object.freeze({
      prefix: this.context.commandPrefix,
      rawName,
      name: resolvedName,
      aliasUsed: rawName !== resolvedName,
      rawText: trimmed,
      remainderText,
      tokens: Object.freeze(tokens),
      positional: Object.freeze(positional),
      flags: Object.freeze(flags),
      keyValues: Object.freeze(keyValues),
      mentionedChannels: Object.freeze(mentionedChannels),
    });
  }

  private resolveCommandName(rawName: string): ChatCommandName | null {
    if ((this.registry as Record<string, ChatCommandDescriptor>)[rawName]) {
      return rawName as ChatCommandName;
    }
    return this.aliasIndex[rawName] ?? null;
  }

  private preflight(
    request: ChatCommandHandlerRequest,
    descriptor: ChatCommandDescriptor,
  ): readonly string[] {
    const reasons: string[] = [];

    if (!descriptor.roomKinds.includes(request.room.roomKind)) {
      reasons.push(`/${descriptor.name} is not allowed in ${request.room.roomKind} rooms.`);
    }

    if (!descriptor.roles.includes(request.session.identity.role)) {
      reasons.push(`/${descriptor.name} is not allowed for role ${request.session.identity.role}.`);
    }

    if (request.session.shadowMuted) {
      reasons.push('Session is shadow-muted and cannot issue commands that change visible room state.');
    }

    if (request.session.mutedUntil !== null && Number(request.session.mutedUntil) > Number(request.now)) {
      reasons.push('Session is currently muted.');
    }

    if (!request.session.roomIds.includes(request.room.roomId)) {
      reasons.push('Session is not admitted to the target room.');
    }

    if (descriptor.visibleChannelsRequired && descriptor.visibleChannelsRequired.length > 0) {
      const missing = descriptor.visibleChannelsRequired.filter((channel) => !request.room.allowedVisibleChannels.includes(channel));
      if (missing.length > 0) {
        reasons.push(`/${descriptor.name} requires visible channels not enabled in this room: ${missing.join(', ')}.`);
      }
    }

    if (descriptor.requiresComposerChannelSupport) {
      const descriptorForRoomChannel = CHAT_CHANNEL_DESCRIPTORS[request.room.activeVisibleChannel];
      if (!descriptorForRoomChannel.supportsComposer) {
        reasons.push(`/${descriptor.name} requires a composer-capable active channel.`);
      }
    }

    return Object.freeze(reasons);
  }
}

// ============================================================================
// MARK: Public convenience function
// ============================================================================

export function evaluateChatCommand(
  request: ChatCommandParseRequest,
  options?: ChatCommandParserOptions,
): ChatCommandExecutionEnvelope {
  const parser = new ChatCommandParser(options);
  return parser.execute(request);
}

// ============================================================================
// MARK: Registry construction
// ============================================================================

function createCommandRegistry(): Readonly<Record<ChatCommandName, ChatCommandDescriptor>> {
  const registry: Record<ChatCommandName, ChatCommandDescriptor> = {
    help: {
      name: 'help',
      aliases: ['h', '?', 'commands'],
      helpLine: '/help [topic] — show allowed commands for this room.',
      roomKinds: ROOM_KINDS_ALL,
      roles: ALL_COMMAND_ROLES,
      acceptsStructuredArguments: true,
      handler: handleHelp,
    },
    clear: {
      name: 'clear',
      aliases: ['cls', 'wipe'],
      helpLine: '/clear — clear local mirror guidance; backend transcript remains authoritative.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_AND_SPECTATOR_ROLES,
      requiresComposerChannelSupport: true,
      acceptsStructuredArguments: false,
      handler: handleClear,
    },
    mood: {
      name: 'mood',
      aliases: ['stage', 'tone'],
      helpLine: '/mood — report the current room mood and active channel posture.',
      roomKinds: ROOM_KINDS_ALL,
      roles: ALL_COMMAND_ROLES,
      acceptsStructuredArguments: false,
      handler: handleMood,
    },
    focus: {
      name: 'focus',
      aliases: ['intent', 'aim'],
      helpLine: '/focus <intent> — record player focus intent into backend shadow memory.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_LIKE_ROLES,
      acceptsStructuredArguments: true,
      handler: handleFocus,
    },
    channel: {
      name: 'channel',
      aliases: ['switch', 'chan'],
      helpLine: '/channel <global|syndicate|deal|lobby> — request visible channel switch.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_AND_SPECTATOR_ROLES,
      acceptsStructuredArguments: true,
      handler: handleChannel,
    },
    who: {
      name: 'who',
      aliases: ['roster', 'online'],
      helpLine: '/who — summarize visible presence in the room.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_AND_SPECTATOR_ROLES,
      acceptsStructuredArguments: false,
      handler: handleWho,
    },
    away: {
      name: 'away',
      aliases: ['afk'],
      helpLine: '/away — request away presence mode.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_AND_SPECTATOR_ROLES,
      acceptsStructuredArguments: false,
      handler: handleAway,
    },
    back: {
      name: 'back',
      aliases: ['return'],
      helpLine: '/back — request active presence mode.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_AND_SPECTATOR_ROLES,
      acceptsStructuredArguments: false,
      handler: handleBack,
    },
    hide: {
      name: 'hide',
      aliases: ['ghost', 'invisible'],
      helpLine: '/hide — request hidden presence mode.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_AND_SPECTATOR_ROLES,
      acceptsStructuredArguments: false,
      handler: handleHide,
    },
    rescue: {
      name: 'rescue',
      aliases: ['helpme', 'recover'],
      helpLine: '/rescue [reason] — ask for helper intervention or recovery guidance.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_LIKE_ROLES,
      acceptsStructuredArguments: true,
      handler: handleRescue,
    },
    proof: {
      name: 'proof',
      aliases: ['hash', 'receipt'],
      helpLine: '/proof [messageId|last] — request proof lookup guidance.',
      roomKinds: ROOM_KINDS_ALL,
      roles: ALL_COMMAND_ROLES,
      acceptsStructuredArguments: true,
      handler: handleProof,
    },
    replay: {
      name: 'replay',
      aliases: ['clip', 'moment'],
      helpLine: '/replay [anchor] — request replay anchor lookup guidance.',
      roomKinds: ROOM_KINDS_ALL,
      roles: ALL_COMMAND_ROLES,
      acceptsStructuredArguments: true,
      handler: handleReplay,
    },
    deal: {
      name: 'deal',
      aliases: ['offer', 'bid'],
      helpLine: '/deal key:value ... — structure a negotiation intent for the deal room.',
      roomKinds: ['DEAL_ROOM', 'PRIVATE'],
      roles: PLAYER_LIKE_ROLES,
      visibleChannelsRequired: ['DEAL_ROOM'],
      acceptsStructuredArguments: true,
      handler: handleDeal,
    },
    heat: {
      name: 'heat',
      aliases: ['pressure', 'crowd'],
      helpLine: '/heat — summarize crowd posture and channel heat.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'LOBBY', 'PRIVATE'],
      roles: PLAYER_AND_SPECTATOR_ROLES,
      acceptsStructuredArguments: false,
      handler: handleHeat,
    },
    hush: {
      name: 'hush',
      aliases: ['quiet', 'lowprofile'],
      helpLine: '/hush [reason] — request reduced attention / quieter treatment via shadow writes.',
      roomKinds: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'PRIVATE'],
      roles: PLAYER_LIKE_ROLES,
      acceptsStructuredArguments: true,
      handler: handleHush,
    },
    ping: {
      name: 'ping',
      aliases: ['status', 'alive'],
      helpLine: '/ping — lightweight backend acknowledgement.',
      roomKinds: ROOM_KINDS_ALL,
      roles: ALL_COMMAND_ROLES,
      acceptsStructuredArguments: false,
      handler: handlePing,
    },
    legend: {
      name: 'legend',
      aliases: ['prestige', 'aura'],
      helpLine: '/legend — describe whether this room is in a legend-eligible moment.',
      roomKinds: ROOM_KINDS_ALL,
      roles: ALL_COMMAND_ROLES,
      acceptsStructuredArguments: false,
      handler: handleLegend,
    },
  };

  return Object.freeze(registry);
}

function createAliasIndex(
  registry: Readonly<Record<ChatCommandName, ChatCommandDescriptor>>,
): Readonly<Record<string, ChatCommandName>> {
  const index: Record<string, ChatCommandName> = {};

  for (const descriptor of Object.values(registry)) {
    index[descriptor.name] = descriptor.name;
    for (const alias of descriptor.aliases) {
      index[alias.toLowerCase()] = descriptor.name;
    }
  }

  return Object.freeze(index);
}

// ============================================================================
// MARK: Command handlers
// ============================================================================

function handleHelp(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const roomCommands = HELP_SECTIONS[request.room.roomKind] ?? HELP_SECTIONS.GLOBAL;
  const registry = createCommandRegistry();
  const requestedTopic = request.parse.positional[0]?.toLowerCase() ?? null;

  if (requestedTopic && (registry as Record<string, ChatCommandDescriptor>)[requestedTopic]) {
    const descriptor = (registry as Record<string, ChatCommandDescriptor>)[requestedTopic];
    return {
      accepted: true,
      reasons: [],
      generatedSystemMessages: [
        `${descriptor.helpLine}`,
        `Allowed roles: ${descriptor.roles.join(', ')}`,
        `Allowed room kinds: ${descriptor.roomKinds.join(', ')}`,
      ],
      shadowWrites: [`help_topic:${descriptor.name}`],
      requestedChannelSwitch: null,
      requestedPresenceMode: null,
      requestedReplayAnchor: null,
      requestedProofLookup: null,
      requestedFocusIntent: null,
      metadata: Object.freeze({ topic: descriptor.name }),
    };
  }

  const lines = roomCommands.map((command) => registry[command].helpLine);
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [
      `Allowed commands for ${request.room.roomKind}:`,
      ...lines,
    ],
    shadowWrites: [`help_room:${request.room.roomKind}`],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ roomKind: request.room.roomKind }),
  };
}

function handleClear(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [
      `Local mirror clear acknowledged for ${request.room.title}.`,
      'Authoritative backend transcript remains intact.',
    ],
    shadowWrites: ['clear:local_mirror_only'],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ roomId: request.room.roomId as unknown as string }),
  };
}

function handleMood(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const descriptor = CHAT_CHANNEL_DESCRIPTORS[request.room.activeVisibleChannel];
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [
      `Room mood: ${request.room.stageMood}.`,
      `Active channel: ${request.room.activeVisibleChannel}.`,
      `Crowd heat support: ${descriptor.supportsCrowdHeat ? 'yes' : 'no'}.`,
      `Replay support: ${descriptor.supportsReplay ? 'yes' : 'no'}.`,
    ],
    shadowWrites: [`mood:${request.room.stageMood}`, `channel:${request.room.activeVisibleChannel}`],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({
      mood: request.room.stageMood,
      channel: request.room.activeVisibleChannel,
      roomKind: request.room.roomKind,
    }),
  };
}

function handleFocus(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const intent = normalizeHumanText([
    ...request.parse.positional,
    ...extractFocusFromStructuredArgs(request.parse),
  ].join(' '));

  if (!intent) {
    return {
      accepted: false,
      reasons: ['Focus command requires an intent, target, or directional note.'],
      generatedSystemMessages: [],
      shadowWrites: [],
      requestedChannelSwitch: null,
      requestedPresenceMode: null,
      requestedReplayAnchor: null,
      requestedProofLookup: null,
      requestedFocusIntent: null,
    };
  }

  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [`Focus intent recorded: ${intent}.`],
    shadowWrites: [
      `focus:${intent}`,
      `focus_room:${request.room.roomId as unknown as string}`,
      `focus_channel:${request.room.activeVisibleChannel}`,
    ],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: intent,
    metadata: Object.freeze({ intent }),
  };
}

function handleChannel(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const target = resolveRequestedVisibleChannel(request.parse, request.room, request.runtime);
  if (!target) {
    return {
      accepted: false,
      reasons: ['Channel command requires a valid visible channel for this room.'],
      generatedSystemMessages: [],
      shadowWrites: [],
      requestedChannelSwitch: null,
      requestedPresenceMode: null,
      requestedReplayAnchor: null,
      requestedProofLookup: null,
      requestedFocusIntent: null,
    };
  }

  if (!request.room.allowedVisibleChannels.includes(target)) {
    return {
      accepted: false,
      reasons: [`Visible channel ${target} is not allowed in this room.`],
      generatedSystemMessages: [],
      shadowWrites: [],
      requestedChannelSwitch: null,
      requestedPresenceMode: null,
      requestedReplayAnchor: null,
      requestedProofLookup: null,
      requestedFocusIntent: null,
    };
  }

  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [`Requested active channel switch: ${target}.`],
    shadowWrites: [`channel_request:${target}`],
    requestedChannelSwitch: target,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ target }),
  };
}

function handleWho(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const roomPresence = request.state.presence.byRoom[request.room.roomId] ?? {};
  const visible = Object.values(roomPresence).filter((entry) => entry.visibleToRoom !== false);
  const labels = visible.slice(0, 12).map((entry) => `${entry.actorLabel}:${entry.mode}`);
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [
      `Visible room presence count: ${visible.length}.`,
      labels.length > 0 ? labels.join(' | ') : 'No visible room presence snapshot available.',
    ],
    shadowWrites: [`presence_count:${visible.length}`],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ visibleCount: visible.length }),
  };
}

function handleAway(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  return createPresenceResponse('AWAY', 'Away presence requested.');
}

function handleBack(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  return createPresenceResponse('BACK', 'Active presence requested.');
}

function handleHide(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  return createPresenceResponse('HIDE', 'Hidden presence requested.');
}

function handleRescue(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const reason = normalizeHumanText([
    ...request.parse.positional,
    ...extractByKeys(request.parse, ['reason', 'why', 'because']),
  ].join(' '));

  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [
      reason ? `Recovery request recorded: ${reason}.` : 'Recovery request recorded.',
      'Helper intervention planner may use backend rescue shadow state.',
    ],
    shadowWrites: [reason ? `rescue:${reason}` : 'rescue:manual_request'],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ reason: reason ?? '' }),
  };
}

function handleProof(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const lookup = normalizeHumanText(request.parse.positional[0] ?? extractByKeys(request.parse, ['id', 'message', 'proof'])[0] ?? 'last');
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [`Proof lookup requested for: ${lookup}.`],
    shadowWrites: [`proof_lookup:${lookup}`],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: lookup,
    requestedFocusIntent: null,
    metadata: Object.freeze({ lookup }),
  };
}

function handleReplay(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const anchor = normalizeHumanText(request.parse.positional[0] ?? extractByKeys(request.parse, ['anchor', 'moment', 'label'])[0] ?? 'last');
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [`Replay anchor requested for: ${anchor}.`],
    shadowWrites: [`replay_lookup:${anchor}`],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: anchor,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ anchor }),
  };
}

function handleDeal(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const kv = request.parse.keyValues;
  const price = extractSingleValue(kv, 'price') ?? extractSingleValue(kv, 'bid') ?? extractSingleValue(kv, 'offer');
  const asset = extractSingleValue(kv, 'asset') ?? extractSingleValue(kv, 'item') ?? request.parse.positional[0] ?? null;
  const side = extractSingleValue(kv, 'side') ?? extractSingleValue(kv, 'action') ?? 'unspecified';

  if (!asset && !price) {
    return {
      accepted: false,
      reasons: ['Deal command requires structured negotiation fields such as asset:, price:, side:, or offer:.'],
      generatedSystemMessages: [],
      shadowWrites: [],
      requestedChannelSwitch: null,
      requestedPresenceMode: null,
      requestedReplayAnchor: null,
      requestedProofLookup: null,
      requestedFocusIntent: null,
    };
  }

  const summary = `Deal intent recorded${asset ? ` for ${asset}` : ''}${price ? ` at ${price}` : ''}${side ? ` (${side})` : ''}.`;
  const shadow = [`deal_intent:${JSON.stringify({ asset: asset ?? '', price: price ?? '', side })}`];

  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [summary],
    shadowWrites: shadow,
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({
      asset: asset ?? '',
      price: price ?? '',
      side,
    }),
  };
}

function handleHeat(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const active = request.state.audienceHeatByRoom[request.room.roomId] ?? null;
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [
      active
        ? `Heat ${request.room.activeVisibleChannel}: ${Math.round(Number(active.heat01) * 100)}% (${active.swarmDirection}).`
        : `No channel heat snapshot available for ${request.room.activeVisibleChannel}.`,
    ],
    shadowWrites: [active ? `heat:${request.room.activeVisibleChannel}:${Math.round(Number(active.heat01) * 100)}` : `heat:${request.room.activeVisibleChannel}:unknown`],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
  };
}

function handleHush(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const reason = normalizeHumanText([
    ...request.parse.positional,
    ...extractByKeys(request.parse, ['reason', 'why']),
  ].join(' ')) || 'quiet_request';

  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: ['Low-profile request recorded. Backend shadow systems may reduce visible pressure where policy allows.'],
    shadowWrites: [`hush:${reason}`],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ reason }),
  };
}

function handlePing(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [`Backend chat authority acknowledged ${request.room.title}.`],
    shadowWrites: ['ping:ok'],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
  };
}

function handleLegend(request: ChatCommandHandlerRequest): ChatCommandHandlerResponse {
  const legend = request.room.activeLegendId;
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [
      legend
        ? `Legend candidate active: ${legend as unknown as string}.`
        : 'No active legend candidate is attached to this room right now.',
    ],
    shadowWrites: [legend ? `legend:${legend as unknown as string}` : 'legend:none'],
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
  };
}

// ============================================================================
// MARK: Parser mechanics
// ============================================================================

function isCommandText(text: string, prefix: string): boolean {
  return text.trim().startsWith(prefix);
}

function tokenizeCommand(text: string): readonly ChatCommandToken[] {
  const tokens: ChatCommandToken[] = [];
  let buffer = '';
  let quoted = false;
  let quoteChar = '"';
  let tokenQuoted = false;
  let index = 0;

  const flush = (): void => {
    const normalized = buffer.trim();
    if (!normalized) {
      buffer = '';
      tokenQuoted = false;
      return;
    }
    tokens.push(Object.freeze({
      raw: buffer,
      normalized: normalized.toLowerCase(),
      quoted: tokenQuoted,
      index,
    }));
    index += 1;
    buffer = '';
    tokenQuoted = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const previous = i > 0 ? text[i - 1] : '';

    if ((char === '"' || char === "'") && previous !== '\\') {
      if (!quoted) {
        quoted = true;
        quoteChar = char;
        tokenQuoted = true;
        continue;
      }
      if (quoteChar === char) {
        quoted = false;
        continue;
      }
    }

    if (!quoted && /\s/.test(char)) {
      flush();
      continue;
    }

    if (char === '\\' && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === '"' || next === "'" || next === '\\') {
        buffer += next;
        i += 1;
        continue;
      }
    }

    buffer += char;
  }

  flush();
  return Object.freeze(tokens);
}

function parseArguments(tokens: readonly ChatCommandToken[]): {
  positional: readonly string[];
  flags: readonly ChatCommandFlag[];
  keyValues: readonly ChatKeyValueArgument[];
  mentionedChannels: readonly ChatVisibleChannel[];
} {
  const positional: string[] = [];
  const flags: ChatCommandFlag[] = [];
  const keyValues: ChatKeyValueArgument[] = [];
  const mentionedChannels: ChatVisibleChannel[] = [];

  for (const token of tokens) {
    const raw = token.raw.trim();

    if (raw.startsWith('--')) {
      const eqIndex = raw.indexOf('=');
      if (eqIndex > 2) {
        flags.push(Object.freeze({
          key: normalizeTokenKey(raw.slice(2, eqIndex)),
          value: raw.slice(eqIndex + 1),
        }));
      } else {
        flags.push(Object.freeze({
          key: normalizeTokenKey(raw.slice(2)),
          value: true,
        }));
      }
      continue;
    }

    if (raw.includes(':') && !raw.startsWith('http')) {
      const splitIndex = raw.indexOf(':');
      const key = normalizeTokenKey(raw.slice(0, splitIndex));
      const value = raw.slice(splitIndex + 1).trim();
      if (key && value) {
        keyValues.push(Object.freeze({ key, value }));
        const channel = toVisibleChannel(value);
        if (channel) {
          mentionedChannels.push(channel);
        }
        continue;
      }
    }

    const channel = toVisibleChannel(raw.replace(/^#/, ''));
    if (channel) {
      mentionedChannels.push(channel);
    }

    positional.push(raw);
  }

  return {
    positional: Object.freeze(positional),
    flags: Object.freeze(flags),
    keyValues: Object.freeze(keyValues),
    mentionedChannels: Object.freeze(dedupeVisibleChannels(mentionedChannels)),
  };
}

// ============================================================================
// MARK: Envelope conversion and helper responses
// ============================================================================

function toEnvelope(
  parsed: ChatParsedCommand,
  response: ChatCommandHandlerResponse,
): ChatCommandExecutionEnvelope {
  const execution: ChatCommandExecution = Object.freeze({
    accepted: response.accepted,
    commandName: parsed.name,
    reasons: Object.freeze([...response.reasons]),
    generatedSystemMessages: Object.freeze([...response.generatedSystemMessages]),
    shadowWrites: Object.freeze([...response.shadowWrites]),
  });

  return Object.freeze({
    execution,
    parsed,
    systemMessages: execution.generatedSystemMessages,
    shadowWrites: execution.shadowWrites,
    requestedChannelSwitch: response.requestedChannelSwitch,
    requestedPresenceMode: response.requestedPresenceMode,
    requestedReplayAnchor: response.requestedReplayAnchor,
    requestedProofLookup: response.requestedProofLookup,
    requestedFocusIntent: response.requestedFocusIntent,
    metadata: response.metadata ?? Object.freeze({}),
  });
}

function createPassThroughEnvelope(): ChatCommandExecutionEnvelope {
  const execution: ChatCommandExecution = Object.freeze({
    accepted: true,
    commandName: null,
    reasons: Object.freeze([]),
    generatedSystemMessages: Object.freeze([]),
    shadowWrites: Object.freeze([]),
  });

  return Object.freeze({
    execution,
    parsed: null,
    systemMessages: execution.generatedSystemMessages,
    shadowWrites: execution.shadowWrites,
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({}),
  });
}

function createRejectedEnvelope(args: {
  commandName: string | null;
  reasons: readonly string[];
}): ChatCommandExecutionEnvelope {
  const execution: ChatCommandExecution = Object.freeze({
    accepted: false,
    commandName: args.commandName,
    reasons: Object.freeze([...args.reasons]),
    generatedSystemMessages: Object.freeze([]),
    shadowWrites: Object.freeze([]),
  });

  return Object.freeze({
    execution,
    parsed: null,
    systemMessages: execution.generatedSystemMessages,
    shadowWrites: execution.shadowWrites,
    requestedChannelSwitch: null,
    requestedPresenceMode: null,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({}),
  });
}

function createPresenceResponse(
  mode: ChatPresenceCommandMode,
  message: string,
): ChatCommandHandlerResponse {
  return {
    accepted: true,
    reasons: [],
    generatedSystemMessages: [message],
    shadowWrites: [`presence:${mode.toLowerCase()}`],
    requestedChannelSwitch: null,
    requestedPresenceMode: mode,
    requestedReplayAnchor: null,
    requestedProofLookup: null,
    requestedFocusIntent: null,
    metadata: Object.freeze({ mode }),
  };
}

// ============================================================================
// MARK: Structured argument helpers
// ============================================================================

function extractByKeys(parse: ChatParsedCommand, keys: readonly string[]): readonly string[] {
  const wanted = new Set(keys.map((key) => normalizeTokenKey(key)));
  const results: string[] = [];

  for (const kv of parse.keyValues) {
    if (wanted.has(kv.key)) {
      results.push(kv.value);
    }
  }

  for (const flag of parse.flags) {
    if (wanted.has(flag.key) && flag.value !== true) {
      results.push(flag.value);
    }
  }

  return Object.freeze(results);
}

function extractSingleValue(values: readonly ChatKeyValueArgument[], key: string): string | null {
  const found = values.find((entry) => entry.key === normalizeTokenKey(key));
  return found?.value ?? null;
}

function extractFocusFromStructuredArgs(parse: ChatParsedCommand): readonly string[] {
  return extractByKeys(parse, ['focus', 'intent', 'target', 'plan']);
}

function resolveRequestedVisibleChannel(
  parse: ChatParsedCommand,
  room: ChatRoomState,
  runtime: ChatRuntimeConfig,
): ChatVisibleChannel | null {
  const firstPositional = parse.positional[0] ? toVisibleChannel(parse.positional[0].replace(/^#/, '')) : null;
  const fromChannelKey = extractByKeys(parse, ['channel', 'room'])[0] ? toVisibleChannel(extractByKeys(parse, ['channel', 'room'])[0]) : null;
  const mentioned = parse.mentionedChannels[0] ?? null;
  const candidate = firstPositional ?? fromChannelKey ?? mentioned;

  if (!candidate) {
    return null;
  }

  if (!runtimeAllowsVisibleChannel(runtime, candidate)) {
    return null;
  }

  if (!room.allowedVisibleChannels.includes(candidate)) {
    return null;
  }

  return candidate;
}

function normalizeTokenKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
}

function normalizeHumanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toVisibleChannel(value: string): ChatVisibleChannel | null {
  const normalized = value.trim().toLowerCase();
  return CHANNEL_ALIAS_MAP[normalized] ?? null;
}

function dedupeVisibleChannels(values: readonly ChatVisibleChannel[]): readonly ChatVisibleChannel[] {
  const seen = new Set<ChatVisibleChannel>();
  const next: ChatVisibleChannel[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      next.push(value);
    }
  }
  return Object.freeze(next);
}

// ============================================================================
// MARK: Additional explainability helpers
// ============================================================================

export function summarizeCommandEnvelope(envelope: ChatCommandExecutionEnvelope): string {
  if (envelope.execution.commandName === null) {
    return 'plain-text';
  }

  return [
    `command=/${envelope.execution.commandName}`,
    `accepted=${envelope.execution.accepted ? 'yes' : 'no'}`,
    envelope.requestedChannelSwitch ? `channel=${envelope.requestedChannelSwitch}` : null,
    envelope.requestedPresenceMode ? `presence=${envelope.requestedPresenceMode}` : null,
    envelope.requestedReplayAnchor ? `replay=${envelope.requestedReplayAnchor}` : null,
    envelope.requestedProofLookup ? `proof=${envelope.requestedProofLookup}` : null,
    envelope.requestedFocusIntent ? `focus=${envelope.requestedFocusIntent}` : null,
    envelope.execution.reasons.length > 0 ? `reasons=${envelope.execution.reasons.join('|')}` : null,
  ].filter((part): part is string => Boolean(part)).join(' ');
}

export function listAllowedCommandsForRoomKind(kind: ChatRoomKind): readonly string[] {
  const registry = createCommandRegistry();
  const names = HELP_SECTIONS[kind] ?? HELP_SECTIONS.GLOBAL;
  return Object.freeze(names.map((name) => registry[name].helpLine));
}

// ============================================================================
// MARK: Final default instance export
// ============================================================================

export const DEFAULT_BACKEND_CHAT_COMMAND_PARSER = new ChatCommandParser({
  runtime: DEFAULT_BACKEND_CHAT_RUNTIME,
});

// ============================================================================
// MARK: Command parse watch bus
// ============================================================================

export type CommandParseWatchEvent =
  | { kind: 'ACCEPTED'; commandName: string; roomId: ChatRoomId; sessionId: string }
  | { kind: 'REJECTED'; commandName: string; reason: string; roomId: ChatRoomId }
  | { kind: 'UNKNOWN'; raw: string; roomId: ChatRoomId };

export type CommandParseWatchCallback = (event: CommandParseWatchEvent) => void;

export class CommandParseWatchBus {
  private readonly subscribers = new Set<CommandParseWatchCallback>();

  subscribe(cb: CommandParseWatchCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  emit(event: CommandParseWatchEvent): void {
    for (const cb of this.subscribers) {
      try { cb(event); } catch { /* isolate */ }
    }
  }

  emitAccepted(commandName: string, roomId: ChatRoomId, sessionId: string): void {
    this.emit({ kind: 'ACCEPTED', commandName, roomId, sessionId });
  }

  emitRejected(commandName: string, reason: string, roomId: ChatRoomId): void {
    this.emit({ kind: 'REJECTED', commandName, reason, roomId });
  }

  emitUnknown(raw: string, roomId: ChatRoomId): void {
    this.emit({ kind: 'UNKNOWN', raw, roomId });
  }

  size(): number { return this.subscribers.size; }
}

// ============================================================================
// MARK: Command frequency counter
// ============================================================================

export class CommandFrequencyCounter {
  private readonly counts = new Map<string, number>();

  record(commandName: string): void {
    this.counts.set(commandName, (this.counts.get(commandName) ?? 0) + 1);
  }

  count(commandName: string): number {
    return this.counts.get(commandName) ?? 0;
  }

  total(): number {
    let sum = 0;
    for (const n of this.counts.values()) sum += n;
    return sum;
  }

  mostFrequent(): string | null {
    let max = 0;
    let best: string | null = null;
    for (const [name, n] of this.counts) {
      if (n > max) { max = n; best = name; }
    }
    return best;
  }

  distribution(): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const [name, n] of this.counts) result[name] = n;
    return Object.freeze(result);
  }

  reset(): void { this.counts.clear(); }
}

// ============================================================================
// MARK: Command parse result fingerprint
// ============================================================================

export interface CommandParseFingerprint {
  readonly commandName: string;
  readonly accepted: boolean;
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly sessionRole: ChatSessionRole;
  readonly requestedChannelSwitch: ChatVisibleChannel | null;
  readonly hash: string;
}

export function computeCommandParseFingerprint(
  envelope: ChatCommandExecutionEnvelope,
  room: ChatRoomState,
  session: ChatSessionState,
): CommandParseFingerprint {
  const name = envelope.parsed?.name ?? 'unknown';
  const hash = [
    name,
    envelope.execution.accepted ? 'Y' : 'N',
    room.roomId,
    room.roomKind,
    session.identity.role,
    envelope.requestedChannelSwitch ?? 'NONE',
  ].join('|');

  return Object.freeze({
    commandName: name,
    accepted: envelope.execution.accepted,
    roomId: room.roomId,
    roomKind: room.roomKind,
    sessionRole: session.identity.role,
    requestedChannelSwitch: envelope.requestedChannelSwitch,
    hash,
  });
}

// ============================================================================
// MARK: Session command history tracker
// ============================================================================

export interface SessionCommandRecord {
  readonly commandName: string;
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly recordedAt: UnixMs;
}

export class SessionCommandHistoryTracker {
  private readonly history = new Map<string, SessionCommandRecord[]>();

  private keyFor(roomId: ChatRoomId, sessionId: string): string {
    return `${roomId}:${sessionId}`;
  }

  record(
    roomId: ChatRoomId,
    sessionId: string,
    envelope: ChatCommandExecutionEnvelope,
    now: UnixMs,
  ): void {
    const key = this.keyFor(roomId, sessionId);
    if (!this.history.has(key)) this.history.set(key, []);
    this.history.get(key)!.push(Object.freeze({
      commandName: envelope.parsed?.name ?? 'unknown',
      accepted: envelope.execution.accepted,
      reasons: Object.freeze([...envelope.execution.reasons]),
      recordedAt: now,
    }));
  }

  getHistory(roomId: ChatRoomId, sessionId: string): readonly SessionCommandRecord[] {
    return this.history.get(this.keyFor(roomId, sessionId)) ?? [];
  }

  lastCommand(roomId: ChatRoomId, sessionId: string): SessionCommandRecord | null {
    const list = this.history.get(this.keyFor(roomId, sessionId));
    return list && list.length > 0 ? list[list.length - 1]! : null;
  }

  acceptedCount(roomId: ChatRoomId, sessionId: string): number {
    return this.getHistory(roomId, sessionId).filter((r) => r.accepted).length;
  }

  rejectedCount(roomId: ChatRoomId, sessionId: string): number {
    return this.getHistory(roomId, sessionId).filter((r) => !r.accepted).length;
  }

  purge(roomId: ChatRoomId, sessionId: string): void {
    this.history.delete(this.keyFor(roomId, sessionId));
  }
}

// ============================================================================
// MARK: Command legality matrix
// ============================================================================

export interface CommandLegalityEntry {
  readonly commandName: string;
  readonly allowedRoomKinds: readonly ChatRoomKind[];
  readonly allowedRoles: readonly ChatSessionRole[];
  readonly requiresChannel: ChatVisibleChannel | null;
  readonly blockedInMoods: readonly ChatRoomStageMood[];
}

export const COMMAND_LEGALITY_MATRIX: readonly CommandLegalityEntry[] = (Object.freeze([
  Object.freeze({
    commandName: 'help',
    allowedRoomKinds: ['GLOBAL', 'LOBBY', 'SYNDICATE', 'DEAL_ROOM'],
    allowedRoles: ['PLAYER', 'MODERATOR', 'SPECTATOR', 'NPC', 'SYSTEM'] as readonly ChatSessionRole[],
    requiresChannel: null,
    blockedInMoods: [],
  }),
  Object.freeze({
    commandName: 'channel',
    allowedRoomKinds: ['GLOBAL', 'LOBBY', 'SYNDICATE'],
    allowedRoles: ['PLAYER', 'MODERATOR'] as readonly ChatSessionRole[],
    requiresChannel: null,
    blockedInMoods: ['HOSTILE', 'PREDATORY'],
  }),
  Object.freeze({
    commandName: 'quiet',
    allowedRoomKinds: ['GLOBAL', 'LOBBY', 'SYNDICATE', 'DEAL_ROOM'],
    allowedRoles: ['PLAYER', 'MODERATOR'] as readonly ChatSessionRole[],
    requiresChannel: null,
    blockedInMoods: [],
  }),
  Object.freeze({
    commandName: 'replay',
    allowedRoomKinds: ['GLOBAL', 'LOBBY', 'SYNDICATE'],
    allowedRoles: ['PLAYER', 'MODERATOR', 'SPECTATOR'] as readonly ChatSessionRole[],
    requiresChannel: null,
    blockedInMoods: ['HOSTILE', 'PREDATORY'],
  }),
  Object.freeze({
    commandName: 'proof',
    allowedRoomKinds: ['GLOBAL', 'LOBBY', 'SYNDICATE', 'DEAL_ROOM'],
    allowedRoles: ['PLAYER', 'MODERATOR'] as readonly ChatSessionRole[],
    requiresChannel: null,
    blockedInMoods: [],
  }),
  Object.freeze({
    commandName: 'focus',
    allowedRoomKinds: ['DEAL_ROOM', 'SYNDICATE'],
    allowedRoles: ['PLAYER', 'MODERATOR'] as readonly ChatSessionRole[],
    requiresChannel: null,
    blockedInMoods: [],
  }),
  Object.freeze({
    commandName: 'status',
    allowedRoomKinds: ['GLOBAL', 'LOBBY', 'SYNDICATE', 'DEAL_ROOM'],
    allowedRoles: ['PLAYER', 'MODERATOR', 'SPECTATOR', 'NPC', 'SYSTEM'] as readonly ChatSessionRole[],
    requiresChannel: null,
    blockedInMoods: [],
  }),
]) as unknown) as readonly CommandLegalityEntry[];

export function isCommandLegalInContext(
  commandName: string,
  roomKind: ChatRoomKind,
  role: ChatSessionRole,
  mood: ChatRoomStageMood,
): boolean {
  const entry = COMMAND_LEGALITY_MATRIX.find((e) => e.commandName === commandName);
  if (!entry) return false;
  if (!entry.allowedRoomKinds.includes(roomKind)) return false;
  if (!entry.allowedRoles.includes(role)) return false;
  if (entry.blockedInMoods.includes(mood)) return false;
  return true;
}

// ============================================================================
// MARK: Channel switch validator
// ============================================================================

export function validateChannelSwitch(
  fromChannel: ChatVisibleChannel,
  toChannel: ChatVisibleChannel,
  session: ChatSessionState,
  runtime: ChatRuntimeConfig,
): { valid: boolean; reason: string | null } {
  if (!runtimeAllowsVisibleChannel(runtime, toChannel)) {
    return { valid: false, reason: `channel_${toChannel}_not_allowed_in_runtime` };
  }

  const mountKey = session.transportMetadata['mountKey'] as ChatMountPolicy['mountTarget'] | undefined;
  const policy = mountKey ? CHAT_MOUNT_POLICIES[mountKey] : undefined;
  if (!policy) return { valid: false, reason: 'no_mount_policy' };

  if (!policy.allowedVisibleChannels.includes(toChannel)) {
    return { valid: false, reason: `channel_${toChannel}_not_in_mount_policy` };
  }

  if (fromChannel === toChannel) {
    return { valid: false, reason: 'already_on_requested_channel' };
  }

  const desc = CHAT_CHANNEL_DESCRIPTORS[toChannel as ChatChannelId];
  if (desc && !desc.supportsComposer) {
    return { valid: false, reason: 'target_channel_does_not_support_composer' };
  }

  return { valid: true, reason: null };
}

// ============================================================================
// MARK: Command parse batch runner
// ============================================================================

export interface BatchCommandParseResult {
  readonly total: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly unknown: number;
  readonly byCommand: Readonly<Record<string, number>>;
}

export function runBatchCommandParse(
  parser: ChatCommandParser,
  requests: readonly ChatCommandParseRequest[],
): BatchCommandParseResult {
  let accepted = 0;
  let rejected = 0;
  let unknown = 0;
  const byCommand: Record<string, number> = {};

  for (const req of requests) {
    const envelope = parser.execute(req);
    const name = envelope.parsed?.name ?? '__unknown__';
    byCommand[name] = (byCommand[name] ?? 0) + 1;
    if (envelope.parsed === null) {
      unknown++;
    } else if (envelope.execution.accepted) {
      accepted++;
    } else {
      rejected++;
    }
  }

  return Object.freeze({
    total: requests.length,
    accepted,
    rejected,
    unknown,
    byCommand: Object.freeze(byCommand),
  });
}

// ============================================================================
// MARK: Command audit report
// ============================================================================

export interface CommandAuditReport {
  readonly roomId: ChatRoomId;
  readonly sessionId: string;
  readonly totalCommands: number;
  readonly acceptedCommands: number;
  readonly rejectedCommands: number;
  readonly mostFrequentCommand: string | null;
  readonly lastCommandName: string | null;
  readonly lastCommandAccepted: boolean | null;
}

export function buildCommandAuditReport(
  roomId: ChatRoomId,
  sessionId: string,
  tracker: SessionCommandHistoryTracker,
): CommandAuditReport {
  const history = tracker.getHistory(roomId, sessionId);
  const counter = new CommandFrequencyCounter();
  for (const record of history) counter.record(record.commandName);
  const last = tracker.lastCommand(roomId, sessionId);

  return Object.freeze({
    roomId,
    sessionId,
    totalCommands: history.length,
    acceptedCommands: tracker.acceptedCount(roomId, sessionId),
    rejectedCommands: tracker.rejectedCount(roomId, sessionId),
    mostFrequentCommand: counter.mostFrequent(),
    lastCommandName: last?.commandName ?? null,
    lastCommandAccepted: last?.accepted ?? null,
  });
}

// ============================================================================
// MARK: Command state snapshot
// ============================================================================

export interface CommandParserStateSnapshot {
  readonly activeRoomCount: number;
  readonly totalCommandsParsed: number;
  readonly acceptanceRate01: number;
  readonly computedAt: UnixMs;
}

export function buildCommandParserStateSnapshot(
  historyTracker: SessionCommandHistoryTracker,
  roomIds: readonly ChatRoomId[],
  sessionIds: readonly string[],
  now: UnixMs,
): CommandParserStateSnapshot {
  let total = 0;
  let accepted = 0;

  for (const roomId of roomIds) {
    for (const sessionId of sessionIds) {
      const history = historyTracker.getHistory(roomId, sessionId);
      total += history.length;
      accepted += history.filter((r) => r.accepted).length;
    }
  }

  return Object.freeze({
    activeRoomCount: roomIds.length,
    totalCommandsParsed: total,
    acceptanceRate01: total > 0 ? accepted / total : 0,
    computedAt: now,
  });
}

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_COMMAND_PARSER_MODULE_NAME = 'ChatCommandParser' as const;
export const CHAT_COMMAND_PARSER_MODULE_VERSION = '2026.03.14.2' as const;

export const CHAT_COMMAND_PARSER_MODULE_LAWS = Object.freeze([
  'Commands are parsed before any transcript mutation.',
  'Unknown commands produce a rejected execution, never a throw.',
  'Channel switch targets are validated against mount policy and runtime.',
  'Legality checks are deterministic — same inputs always produce same outcome.',
  'System messages for accepted commands are produced here, not downstream.',
  'All parse results are frozen before export.',
]);

export const CHAT_COMMAND_PARSER_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_COMMAND_PARSER_MODULE_NAME,
  version: CHAT_COMMAND_PARSER_MODULE_VERSION,
  laws: CHAT_COMMAND_PARSER_MODULE_LAWS,
});

export function createCommandParseWatchBus(): CommandParseWatchBus {
  return new CommandParseWatchBus();
}

export function createCommandFrequencyCounter(): CommandFrequencyCounter {
  return new CommandFrequencyCounter();
}

export function createSessionCommandHistoryTracker(): SessionCommandHistoryTracker {
  return new SessionCommandHistoryTracker();
}

// ============================================================================
// MARK: Command parser state snapshot
// ============================================================================

export interface CommandRoomSummary {
  readonly roomId: ChatRoomId;
  readonly roomKind: ChatRoomKind;
  readonly stageMood: ChatRoomStageMood;
  readonly allowedCommands: readonly string[];
}

export function buildCommandRoomSummary(room: ChatRoomState): CommandRoomSummary {
  return Object.freeze({
    roomId: room.roomId,
    roomKind: room.roomKind,
    stageMood: room.stageMood,
    allowedCommands: listAllowedCommandsForRoomKind(room.roomKind),
  });
}

// ============================================================================
// MARK: Command source type classifier
// ============================================================================

export function classifyCommandSourceType(sourceType: ChatSourceType): 'PLAYER' | 'SYSTEM' | 'NPC' | 'UNKNOWN' {
  if (sourceType === 'PLAYER') return 'PLAYER';
  if (sourceType === 'SYSTEM') return 'SYSTEM';
  if (sourceType === 'NPC_HATER' || sourceType === 'NPC_HELPER' || sourceType === 'NPC_AMBIENT') return 'NPC';
  return 'UNKNOWN';
}

// ============================================================================
// MARK: Execution envelope validator
// ============================================================================

export interface ExecutionEnvelopeValidation {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

export function validateExecutionEnvelope(
  envelope: ChatCommandExecutionEnvelope,
): ExecutionEnvelopeValidation {
  const violations: string[] = [];

  if (!envelope.execution) violations.push('execution_required');
  if (envelope.requestedChannelSwitch && envelope.requestedPresenceMode) {
    violations.push('cannot_request_both_channel_switch_and_presence_mode');
  }

  return Object.freeze({
    valid: violations.length === 0,
    violations: Object.freeze(violations),
  });
}

// ============================================================================
// MARK: Extended module namespace
// ============================================================================

export const ChatCommandParserModuleExtended = Object.freeze({
  // Parser class
  ChatCommandParser,
  DEFAULT_BACKEND_CHAT_COMMAND_PARSER,

  // Watch bus
  createCommandParseWatchBus,

  // Frequency counter
  createCommandFrequencyCounter,

  // History tracker
  createSessionCommandHistoryTracker,

  // Fingerprint
  computeCommandParseFingerprint,

  // Legality
  COMMAND_LEGALITY_MATRIX,
  isCommandLegalInContext,

  // Channel switch
  validateChannelSwitch,

  // Batch
  runBatchCommandParse,

  // Audit
  buildCommandAuditReport,

  // Room summary
  buildCommandRoomSummary,

  // State snapshot
  buildCommandParserStateSnapshot,

  // Source type
  classifyCommandSourceType,

  // Envelope validation
  validateExecutionEnvelope,

  // Envelope formatter
  formatExecutionEnvelopeSummary: formatCommandExecutionSummary,

  // Room kind allowed commands
  listAllowedCommandsForRoomKind,

  // Module constants
  CHAT_COMMAND_PARSER_MODULE_DESCRIPTOR,
  CHAT_COMMAND_PARSER_MODULE_LAWS,
  CHAT_COMMAND_PARSER_MODULE_NAME,
  CHAT_COMMAND_PARSER_MODULE_VERSION,
} as const);

// ============================================================================
// MARK: Command prefix detector
// ============================================================================

export function detectCommandPrefix(text: string, prefix: string): boolean {
  return text.trim().startsWith(prefix);
}

export function stripCommandPrefix(text: string, prefix: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  return trimmed;
}

// ============================================================================
// MARK: Command name normalizer
// ============================================================================

export function normalizeCommandName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
}

// ============================================================================
// MARK: Command execution summary formatter
// ============================================================================

export function formatCommandExecutionSummary(envelope: ChatCommandExecutionEnvelope): string {
  const parts: string[] = [
    `command=${envelope.parsed?.name ?? 'unknown'}`,
    `accepted=${envelope.execution.accepted ? 'yes' : 'no'}`,
  ];
  if (envelope.requestedChannelSwitch) parts.push(`channel=${envelope.requestedChannelSwitch}`);
  if (envelope.requestedPresenceMode) parts.push(`presence=${envelope.requestedPresenceMode}`);
  if (envelope.execution.reasons.length > 0) parts.push(`reasons=${envelope.execution.reasons.join('|')}`);
  return parts.join(' ');
}

// ============================================================================
// MARK: Session role command gate
// ============================================================================

export const ROLE_COMMAND_ALLOWLIST: Readonly<Record<ChatSessionRole, readonly string[]>> =
  Object.freeze({
    PLAYER: ['help', 'channel', 'quiet', 'replay', 'proof', 'focus', 'status'],
    SYSTEM: ['help', 'channel', 'quiet', 'replay', 'proof', 'focus', 'status'],
    SPECTATOR: ['help', 'replay', 'status'],
    NPC: ['help', 'status'],
    MODERATOR: ['help', 'channel', 'quiet', 'replay', 'proof', 'status'],
  } as const);

export function isCommandAllowedForRole(
  commandName: string,
  role: ChatSessionRole,
): boolean {
  return ROLE_COMMAND_ALLOWLIST[role]?.includes(commandName) ?? false;
}

// ============================================================================
// MARK: State-aware parse context builder
// ============================================================================

export function buildParseRequestFromState(
  request: ChatPlayerMessageSubmitRequest,
  state: ChatState,
  now: UnixMs,
): ChatCommandParseRequest | null {
  const room = state.rooms[request.roomId as ChatRoomId];
  if (!room) return null;

  const session = state.sessions[request.sessionId];
  if (!session) return null;

  return Object.freeze({
    request,
    room,
    session,
    state,
    now,
  });
}

// ============================================================================
// MARK: Command parse epoch tracker
// ============================================================================

export class CommandParseEpochTracker {
  private readonly epochs: Array<{ roomId: ChatRoomId; commandName: string; accepted: boolean; recordedAt: UnixMs }> = [];

  record(roomId: ChatRoomId, commandName: string, accepted: boolean, now: UnixMs): void {
    this.epochs.push(Object.freeze({ roomId, commandName, accepted, recordedAt: now }));
  }

  total(): number { return this.epochs.length; }

  acceptedRate(): number {
    if (this.epochs.length === 0) return 0;
    return this.epochs.filter((e) => e.accepted).length / this.epochs.length;
  }

  recentEpochs(limit: number): readonly typeof this.epochs[0][] {
    return this.epochs.slice(-limit);
  }

  reset(): void { this.epochs.length = 0; }
}

export function createCommandParseEpochTracker(): CommandParseEpochTracker {
  return new CommandParseEpochTracker();
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const ChatCommandParserModule = Object.freeze({
  // Module constants
  name: CHAT_COMMAND_PARSER_MODULE_NAME,
  version: CHAT_COMMAND_PARSER_MODULE_VERSION,
  laws: CHAT_COMMAND_PARSER_MODULE_LAWS,
  descriptor: CHAT_COMMAND_PARSER_MODULE_DESCRIPTOR,

  // Parser class and singleton
  ChatCommandParser,
  DEFAULT_BACKEND_CHAT_COMMAND_PARSER,
  evaluateChatCommand,

  // Envelope helpers
  summarizeCommandEnvelope,
  formatCommandExecutionSummary,
  validateExecutionEnvelope,

  // Presence
  resolvePresenceMode,

  // Channel / room helpers
  listAllowedCommandsForRoomKind,
  validateChannelSwitch,
  buildCommandRoomSummary,

  // Command legality
  COMMAND_LEGALITY_MATRIX,
  isCommandLegalInContext,
  isCommandAllowedForRole,
  ROLE_COMMAND_ALLOWLIST,

  // Batch parse
  runBatchCommandParse,

  // Fingerprint
  computeCommandParseFingerprint,

  // Watch bus
  CommandParseWatchBus,
  createCommandParseWatchBus,

  // Frequency counter
  CommandFrequencyCounter,
  createCommandFrequencyCounter,

  // History tracker
  SessionCommandHistoryTracker,
  createSessionCommandHistoryTracker,

  // Audit report
  buildCommandAuditReport,

  // State snapshot
  buildCommandParserStateSnapshot,

  // Source type classifier
  classifyCommandSourceType,

  // Prefix / name utilities
  detectCommandPrefix,
  stripCommandPrefix,
  normalizeCommandName,

  // Context builder
  buildParseRequestFromState,

  // Epoch tracker
  CommandParseEpochTracker,
  createCommandParseEpochTracker,
} as const);
