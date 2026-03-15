/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT CONTRACT BARREL + REGISTRY
 * FILE: shared/contracts/chat/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical import root for the unified shared chat contract lane.
 *
 * This file is intentionally more than a flat barrel. The chat contract estate
 * is wide, and many sibling modules reuse foundational names such as Brand,
 * UnixMs, ChatRoomId, and ChatChannelId. A naive `export *` surface would turn
 * the shared lane into a collision factory. This registry therefore does four
 * jobs at once:
 *
 * 1. Exposes stable module namespaces for every shared chat contract file.
 * 2. Re-exports only the low-risk root primitives that are expected to be
 *    imported directly across frontend, backend, and server lanes.
 * 3. Publishes a runtime-safe manifest, dependency graph, and package registry
 *    for introspection, tooling, boot checks, and migration safety.
 * 4. Preserves repo truth by aligning with the actual shared/contracts/chat
 *    tree plus the nested learning/ barrel.
 *
 * Barrel law
 * ----------
 * - Import module-specific symbols through namespaces when there is any chance
 *   of name collision.
 * - Import foundational types and constants directly from ChatChannels and
 *   ChatEvents only.
 * - Treat learning as a grouped namespace rooted at ./learning.
 * - Do not put gameplay policy here. This file owns discovery and export
 *   topology, not runtime law.
 * ============================================================================
 */

import {
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_REVISION,
  CHAT_CONTRACT_VERSION,
  CHAT_CHANNEL_CONTRACT,
} from './ChatChannels';
import {
  CHAT_EVENT_CONTRACT,
  CHAT_EVENTS_PUBLIC_API_VERSION,
  CHAT_SOCKET_PROTOCOL_VERSION,
} from './ChatEvents';

import * as ChatChannelsModule from './ChatChannels';
import * as ChatEventsModule from './ChatEvents';
import * as ChatMessageModule from './ChatMessage';
import * as ChatPresenceModule from './ChatPresence';
import * as ChatTypingModule from './ChatTyping';
import * as ChatCursorModule from './ChatCursor';
import * as ChatTranscriptModule from './ChatTranscript';
import * as ChatNpcModule from './ChatNpc';
import * as ChatCommandModule from './ChatCommand';
import * as ChatModerationModule from './ChatModeration';
import * as ChatInvasionModule from './ChatInvasion';
import * as ChatTelemetryModule from './ChatTelemetry';
import * as ChatProofModule from './ChatProof';
import * as LearningModule from './learning';

// ============================================================================
// MARK: Stable low-risk direct re-exports
// ============================================================================

export * from './ChatChannels';
export * from './ChatEvents';

export {
  CHAT_CHANNEL_CONTRACT,
  CHAT_EVENT_CONTRACT,
  CHAT_CONTRACT_AUTHORITIES,
  CHAT_CONTRACT_REVISION,
  CHAT_CONTRACT_VERSION,
  CHAT_EVENTS_PUBLIC_API_VERSION,
  CHAT_SOCKET_PROTOCOL_VERSION,
};

// ============================================================================
// MARK: Stable namespace exports
// ============================================================================

export {
  ChatChannelsModule as ChatChannels,
  ChatEventsModule as ChatEvents,
  ChatMessageModule as ChatMessage,
  ChatPresenceModule as ChatPresence,
  ChatTypingModule as ChatTyping,
  ChatCursorModule as ChatCursor,
  ChatTranscriptModule as ChatTranscript,
  ChatNpcModule as ChatNpc,
  ChatCommandModule as ChatCommand,
  ChatModerationModule as ChatModeration,
  ChatInvasionModule as ChatInvasion,
  ChatTelemetryModule as ChatTelemetry,
  ChatProofModule as ChatProof,
  LearningModule as Learning,
};

// ============================================================================
// MARK: Registry keys and categories
// ============================================================================

export const CHAT_SHARED_CONTRACT_BARREL_PATH =
  'shared/contracts/chat/index.ts' as const;

export const CHAT_SHARED_CONTRACT_BARREL_VERSION =
  CHAT_CONTRACT_VERSION;

export const CHAT_SHARED_CONTRACT_NAMESPACE =
  'shared/contracts/chat' as const;

export const CHAT_CONTRACT_MODULE_KEYS = [
  'ChatChannels',
  'ChatEvents',
  'ChatMessage',
  'ChatPresence',
  'ChatTyping',
  'ChatCursor',
  'ChatTranscript',
  'ChatNpc',
  'ChatCommand',
  'ChatModeration',
  'ChatInvasion',
  'ChatTelemetry',
  'ChatProof',
  'Learning',
] as const;

export type ChatContractModuleKey =
  (typeof CHAT_CONTRACT_MODULE_KEYS)[number];

export const CHAT_CONTRACT_CATEGORIES = [
  'FOUNDATION',
  'MESSAGE',
  'PRESENCE',
  'TRANSCRIPT',
  'NPC',
  'COMMAND',
  'MODERATION',
  'INVASION',
  'TELEMETRY',
  'PROOF',
  'LEARNING',
] as const;

export type ChatContractCategory =
  (typeof CHAT_CONTRACT_CATEGORIES)[number];

export const CHAT_RUNTIME_LANES = [
  'frontend-engine',
  'frontend-ui',
  'backend-engine',
  'server-transport',
  'shared-contracts',
] as const;

export type ChatRuntimeLane = (typeof CHAT_RUNTIME_LANES)[number];

export const CHAT_CONTRACT_RELATIVE_PATHS = {
  ChatChannels: './ChatChannels',
  ChatEvents: './ChatEvents',
  ChatMessage: './ChatMessage',
  ChatPresence: './ChatPresence',
  ChatTyping: './ChatTyping',
  ChatCursor: './ChatCursor',
  ChatTranscript: './ChatTranscript',
  ChatNpc: './ChatNpc',
  ChatCommand: './ChatCommand',
  ChatModeration: './ChatModeration',
  ChatInvasion: './ChatInvasion',
  ChatTelemetry: './ChatTelemetry',
  ChatProof: './ChatProof',
  Learning: './learning',
} as const satisfies Record<ChatContractModuleKey, string>;

export type ChatContractRelativePath =
  (typeof CHAT_CONTRACT_RELATIVE_PATHS)[ChatContractModuleKey];

export const CHAT_CONTRACT_FILE_NAMES = {
  ChatChannels: 'ChatChannels.ts',
  ChatEvents: 'ChatEvents.ts',
  ChatMessage: 'ChatMessage.ts',
  ChatPresence: 'ChatPresence.ts',
  ChatTyping: 'ChatTyping.ts',
  ChatCursor: 'ChatCursor.ts',
  ChatTranscript: 'ChatTranscript.ts',
  ChatNpc: 'ChatNpc.ts',
  ChatCommand: 'ChatCommand.ts',
  ChatModeration: 'ChatModeration.ts',
  ChatInvasion: 'ChatInvasion.ts',
  ChatTelemetry: 'ChatTelemetry.ts',
  ChatProof: 'ChatProof.ts',
  Learning: 'learning/index.ts',
} as const satisfies Record<ChatContractModuleKey, string>;

export type ChatContractFileName =
  (typeof CHAT_CONTRACT_FILE_NAMES)[ChatContractModuleKey];

export interface ChatContractModuleDescriptor {
  readonly key: ChatContractModuleKey;
  readonly fileName: ChatContractFileName;
  readonly importPath: ChatContractRelativePath;
  readonly category: ChatContractCategory;
  readonly description: string;
  readonly sharedRootPath: string;
  readonly usedBy: readonly ChatRuntimeLane[];
  readonly dependsOn: readonly ChatContractModuleKey[];
  readonly defaultExportName: string | null;
  readonly contractExportName: string | null;
  readonly manifestExportName: string | null;
}

export type ChatContractModuleNamespace =
  | typeof ChatChannelsModule
  | typeof ChatEventsModule
  | typeof ChatMessageModule
  | typeof ChatPresenceModule
  | typeof ChatTypingModule
  | typeof ChatCursorModule
  | typeof ChatTranscriptModule
  | typeof ChatNpcModule
  | typeof ChatCommandModule
  | typeof ChatModerationModule
  | typeof ChatInvasionModule
  | typeof ChatTelemetryModule
  | typeof ChatProofModule
  | typeof LearningModule;

const ALL_RUNTIME_LANES = [
  'shared-contracts',
  'frontend-engine',
  'frontend-ui',
  'backend-engine',
  'server-transport',
] as const satisfies readonly ChatRuntimeLane[];

export const CHAT_CONTRACT_MODULE_DESCRIPTORS = Object.freeze({
  ChatChannels: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatChannels',
    fileName: 'ChatChannels.ts',
    importPath: './ChatChannels',
    category: 'FOUNDATION',
    description:
      'Foundational channel law, room and mount scope descriptors, brands, helpers, and primary shared contract authorities.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatChannels.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_CHANNEL_CONTRACT',
    manifestExportName: null,
  }),
  ChatEvents: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatEvents',
    fileName: 'ChatEvents.ts',
    importPath: './ChatEvents',
    category: 'FOUNDATION',
    description:
      'Canonical event grammar for transport, intent, authority, replay, proof, rescue, legend, telemetry, and learning hooks.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatEvents.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_EVENT_CONTRACT',
    manifestExportName: null,
  }),
  ChatMessage: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatMessage',
    fileName: 'ChatMessage.ts',
    importPath: './ChatMessage',
    category: 'MESSAGE',
    description:
      'Canonical message payloads, bodies, delivery metadata, and transcript-adjacent message semantics.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatMessage.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultExportName: null,
    contractExportName: null,
    manifestExportName: null,
  }),
  ChatPresence: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatPresence',
    fileName: 'ChatPresence.ts',
    importPath: './ChatPresence',
    category: 'PRESENCE',
    description:
      'Presence roster, occupancy snapshots, role visibility, and room-side presence semantics.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatPresence.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultExportName: null,
    contractExportName: null,
    manifestExportName: null,
  }),
  ChatTyping: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatTyping',
    fileName: 'ChatTyping.ts',
    importPath: './ChatTyping',
    category: 'PRESENCE',
    description:
      'Typing theater, cadence, timeout windows, and typing-state wire contracts.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatTyping.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatPresence'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_TYPING_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatCursor: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatCursor',
    fileName: 'ChatCursor.ts',
    importPath: './ChatCursor',
    category: 'PRESENCE',
    description:
      'Cursor anchors, transcript focus windows, reveal ranges, and cursor-wire envelopes.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatCursor.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatPresence', 'ChatMessage'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_CURSOR_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatTranscript: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatTranscript',
    fileName: 'ChatTranscript.ts',
    importPath: './ChatTranscript',
    category: 'TRANSCRIPT',
    description:
      'Transcript segments, indexes, replay-facing ranges, and transcript contract namespace helpers.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatTranscript.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatPresence'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_TRANSCRIPT_CONTRACT_NAMESPACE',
    manifestExportName: null,
  }),
  ChatNpc: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatNpc',
    fileName: 'ChatNpc.ts',
    importPath: './ChatNpc',
    category: 'NPC',
    description:
      'Canonical NPC descriptors, helper/hater/ambient registries, and NPC contract namespace exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatNpc.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatPresence'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_NPC_CONTRACT_NAMESPACE',
    manifestExportName: null,
  }),
  ChatCommand: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatCommand',
    fileName: 'ChatCommand.ts',
    importPath: './ChatCommand',
    category: 'COMMAND',
    description:
      'Slash-command descriptors, invocation payloads, parsing contracts, and command contract descriptor.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatCommand.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatTyping',
      'ChatCursor',
      'ChatTranscript',
      'ChatNpc',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_COMMAND_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatModeration: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatModeration',
    fileName: 'ChatModeration.ts',
    importPath: './ChatModeration',
    category: 'MODERATION',
    description:
      'Moderation queue contracts, decision surfaces, audit semantics, and moderation descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatModeration.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatTyping',
      'ChatTranscript',
      'ChatNpc',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_MODERATION_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatInvasion: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatInvasion',
    fileName: 'ChatInvasion.ts',
    importPath: './ChatInvasion',
    category: 'INVASION',
    description:
      'Invasion scenes, beats, escalation envelopes, runtime state, and invasion descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatInvasion.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatTyping',
      'ChatTranscript',
      'ChatNpc',
      'ChatModeration',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_INVASION_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatTelemetry: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatTelemetry',
    fileName: 'ChatTelemetry.ts',
    importPath: './ChatTelemetry',
    category: 'TELEMETRY',
    description:
      'Telemetry envelopes, metric semantics, stream-write contracts, and telemetry descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatTelemetry.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatTyping',
      'ChatCursor',
      'ChatTranscript',
      'ChatNpc',
      'ChatInvasion',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_TELEMETRY_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatProof: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatProof',
    fileName: 'ChatProof.ts',
    importPath: './ChatProof',
    category: 'PROOF',
    description:
      'Proof-chain edges, causal integrity surfaces, audit links, and proof contract exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatProof.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatTranscript',
      'ChatTelemetry',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_PROOF_CONTRACT',
    manifestExportName: null,
  }),
  Learning: Object.freeze<ChatContractModuleDescriptor>({
    key: 'Learning',
    fileName: 'learning/index.ts',
    importPath: './learning',
    category: 'LEARNING',
    description:
      'Grouped learning barrel for learning events, profile, features, labels, cold-start doctrine, and response ranking.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedLearningRoot}/index.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultExportName: null,
    contractExportName: 'LEARNING_CONTRACT_RUNTIME_BUNDLE',
    manifestExportName: 'LEARNING_CONTRACT_MANIFEST',
  }),
} as const satisfies Record<ChatContractModuleKey, ChatContractModuleDescriptor>);

export type ChatContractModuleDescriptorMap =
  typeof CHAT_CONTRACT_MODULE_DESCRIPTORS;

export const CHAT_CONTRACT_DEPENDENCY_GRAPH = Object.freeze({
  ChatChannels: [] as const,
  ChatEvents: ['ChatChannels'] as const,
  ChatMessage: ['ChatChannels', 'ChatEvents'] as const,
  ChatPresence: ['ChatChannels', 'ChatEvents'] as const,
  ChatTyping: ['ChatChannels', 'ChatEvents', 'ChatPresence'] as const,
  ChatCursor: ['ChatChannels', 'ChatEvents', 'ChatPresence', 'ChatMessage'] as const,
  ChatTranscript: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatPresence'] as const,
  ChatNpc: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatPresence'] as const,
  ChatCommand: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatTyping',
    'ChatCursor',
    'ChatTranscript',
    'ChatNpc',
  ] as const,
  ChatModeration: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatTyping',
    'ChatTranscript',
    'ChatNpc',
  ] as const,
  ChatInvasion: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatTyping',
    'ChatTranscript',
    'ChatNpc',
    'ChatModeration',
  ] as const,
  ChatTelemetry: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatTyping',
    'ChatCursor',
    'ChatTranscript',
    'ChatNpc',
    'ChatInvasion',
  ] as const,
  ChatProof: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatTranscript',
    'ChatTelemetry',
  ] as const,
  Learning: ['ChatChannels', 'ChatEvents'] as const,
} as const satisfies Record<ChatContractModuleKey, readonly ChatContractModuleKey[]>);

// ============================================================================
// MARK: Runtime namespaces and package bundle
// ============================================================================

export const CHAT_CONTRACT_MODULE_NAMESPACES = Object.freeze({
  ChatChannels: ChatChannelsModule,
  ChatEvents: ChatEventsModule,
  ChatMessage: ChatMessageModule,
  ChatPresence: ChatPresenceModule,
  ChatTyping: ChatTypingModule,
  ChatCursor: ChatCursorModule,
  ChatTranscript: ChatTranscriptModule,
  ChatNpc: ChatNpcModule,
  ChatCommand: ChatCommandModule,
  ChatModeration: ChatModerationModule,
  ChatInvasion: ChatInvasionModule,
  ChatTelemetry: ChatTelemetryModule,
  ChatProof: ChatProofModule,
  Learning: LearningModule,
} as const satisfies Record<ChatContractModuleKey, ChatContractModuleNamespace>);

function readNamedExport(
  namespace: Record<string, unknown>,
  key: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(namespace, key)
    ? namespace[key]
    : undefined;
}

export interface ChatSharedContractPackage {
  readonly descriptor: ChatContractModuleDescriptor;
  readonly namespace: ChatContractModuleNamespace;
  readonly defaultContract: unknown;
  readonly manifest: unknown;
}

export const CHAT_SHARED_CONTRACT_PACKAGES = Object.freeze({
  ChatChannels: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatChannels,
    namespace: ChatChannelsModule,
    defaultContract: readNamedExport(ChatChannelsModule, 'CHAT_CHANNEL_CONTRACT'),
    manifest: readNamedExport(ChatChannelsModule, 'CHAT_CHANNEL_CONTRACT'),
  }),
  ChatEvents: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatEvents,
    namespace: ChatEventsModule,
    defaultContract: readNamedExport(ChatEventsModule, 'CHAT_EVENT_CONTRACT'),
    manifest: readNamedExport(ChatEventsModule, 'CHAT_EVENT_CONTRACT'),
  }),
  ChatMessage: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatMessage,
    namespace: ChatMessageModule,
    defaultContract: undefined,
    manifest: undefined,
  }),
  ChatPresence: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatPresence,
    namespace: ChatPresenceModule,
    defaultContract: undefined,
    manifest: undefined,
  }),
  ChatTyping: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatTyping,
    namespace: ChatTypingModule,
    defaultContract: readNamedExport(ChatTypingModule, 'CHAT_TYPING_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatTypingModule, 'CHAT_TYPING_CONTRACT_DESCRIPTOR'),
  }),
  ChatCursor: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatCursor,
    namespace: ChatCursorModule,
    defaultContract: readNamedExport(ChatCursorModule, 'CHAT_CURSOR_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatCursorModule, 'CHAT_CURSOR_CONTRACT_DESCRIPTOR'),
  }),
  ChatTranscript: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatTranscript,
    namespace: ChatTranscriptModule,
    defaultContract: readNamedExport(ChatTranscriptModule, 'CHAT_TRANSCRIPT_CONTRACT_NAMESPACE'),
    manifest: readNamedExport(ChatTranscriptModule, 'CHAT_TRANSCRIPT_CONTRACT_NAMESPACE'),
  }),
  ChatNpc: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatNpc,
    namespace: ChatNpcModule,
    defaultContract: readNamedExport(ChatNpcModule, 'CHAT_NPC_CONTRACT_NAMESPACE'),
    manifest: readNamedExport(ChatNpcModule, 'CHAT_NPC_CONTRACT_NAMESPACE'),
  }),
  ChatCommand: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatCommand,
    namespace: ChatCommandModule,
    defaultContract: readNamedExport(ChatCommandModule, 'CHAT_COMMAND_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatCommandModule, 'CHAT_COMMAND_CONTRACT_DESCRIPTOR'),
  }),
  ChatModeration: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatModeration,
    namespace: ChatModerationModule,
    defaultContract: readNamedExport(ChatModerationModule, 'CHAT_MODERATION_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatModerationModule, 'CHAT_MODERATION_CONTRACT_DESCRIPTOR'),
  }),
  ChatInvasion: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatInvasion,
    namespace: ChatInvasionModule,
    defaultContract: readNamedExport(ChatInvasionModule, 'CHAT_INVASION_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatInvasionModule, 'CHAT_INVASION_CONTRACT_DESCRIPTOR'),
  }),
  ChatTelemetry: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatTelemetry,
    namespace: ChatTelemetryModule,
    defaultContract: readNamedExport(ChatTelemetryModule, 'CHAT_TELEMETRY_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatTelemetryModule, 'CHAT_TELEMETRY_CONTRACT_DESCRIPTOR'),
  }),
  ChatProof: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatProof,
    namespace: ChatProofModule,
    defaultContract: readNamedExport(ChatProofModule, 'CHAT_PROOF_CONTRACT'),
    manifest: readNamedExport(ChatProofModule, 'CHAT_PROOF_CONTRACT'),
  }),
  Learning: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.Learning,
    namespace: LearningModule,
    defaultContract: readNamedExport(LearningModule as unknown as Record<string, unknown>, 'LEARNING_CONTRACT_RUNTIME_BUNDLE'),
    manifest: readNamedExport(LearningModule as unknown as Record<string, unknown>, 'LEARNING_CONTRACT_MANIFEST'),
  }),
} as const satisfies Record<ChatContractModuleKey, ChatSharedContractPackage>);

export type ChatSharedContractPackages = typeof CHAT_SHARED_CONTRACT_PACKAGES;

// ============================================================================
// MARK: Category indexes and helpers
// ============================================================================

export const CHAT_CONTRACT_KEYS_BY_CATEGORY = Object.freeze({
  FOUNDATION: ['ChatChannels', 'ChatEvents'] as const,
  MESSAGE: ['ChatMessage'] as const,
  PRESENCE: ['ChatPresence', 'ChatTyping', 'ChatCursor'] as const,
  TRANSCRIPT: ['ChatTranscript'] as const,
  NPC: ['ChatNpc'] as const,
  COMMAND: ['ChatCommand'] as const,
  MODERATION: ['ChatModeration'] as const,
  INVASION: ['ChatInvasion'] as const,
  TELEMETRY: ['ChatTelemetry'] as const,
  PROOF: ['ChatProof'] as const,
  LEARNING: ['Learning'] as const,
} as const satisfies Record<ChatContractCategory, readonly ChatContractModuleKey[]>);

export function isChatContractModuleKey(
  value: string,
): value is ChatContractModuleKey {
  return (CHAT_CONTRACT_MODULE_KEYS as readonly string[]).includes(value);
}

export function getChatContractDescriptor(
  key: ChatContractModuleKey,
): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS[key];
}

export function getChatContractNamespace(
  key: ChatContractModuleKey,
): ChatContractModuleNamespace {
  return CHAT_CONTRACT_MODULE_NAMESPACES[key];
}

export function getChatContractPackage(
  key: ChatContractModuleKey,
): ChatSharedContractPackage {
  return CHAT_SHARED_CONTRACT_PACKAGES[key];
}

export function listChatContractKeysByCategory(
  category: ChatContractCategory,
): readonly ChatContractModuleKey[] {
  return CHAT_CONTRACT_KEYS_BY_CATEGORY[category];
}

export function listChatContractImportPaths(): readonly ChatContractRelativePath[] {
  return CHAT_CONTRACT_MODULE_KEYS.map(
    (key) => CHAT_CONTRACT_RELATIVE_PATHS[key],
  );
}

export function getChatContractImportPath(
  key: ChatContractModuleKey,
): ChatContractRelativePath {
  return CHAT_CONTRACT_RELATIVE_PATHS[key];
}

export function getChatContractFileName(
  key: ChatContractModuleKey,
): ChatContractFileName {
  return CHAT_CONTRACT_FILE_NAMES[key];
}

export function hasChatContract(
  key: ChatContractModuleKey,
): boolean {
  return Boolean(CHAT_SHARED_CONTRACT_PACKAGES[key].defaultContract);
}

export function hasChatContractManifest(
  key: ChatContractModuleKey,
): boolean {
  return Boolean(CHAT_SHARED_CONTRACT_PACKAGES[key].manifest);
}

// ============================================================================
// MARK: Topology, integrity, and runtime bundle
// ============================================================================

export const CHAT_SHARED_CONTRACT_ORDER = [
  'ChatChannels',
  'ChatEvents',
  'ChatMessage',
  'ChatPresence',
  'ChatTyping',
  'ChatCursor',
  'ChatTranscript',
  'ChatNpc',
  'ChatCommand',
  'ChatModeration',
  'ChatInvasion',
  'ChatTelemetry',
  'ChatProof',
  'Learning',
] as const satisfies readonly ChatContractModuleKey[];

export const CHAT_SHARED_CONTRACT_MANIFEST = Object.freeze({
  path: CHAT_SHARED_CONTRACT_BARREL_PATH,
  namespace: CHAT_SHARED_CONTRACT_NAMESPACE,
  version: CHAT_SHARED_CONTRACT_BARREL_VERSION,
  revision: CHAT_CONTRACT_REVISION,
  authorities: CHAT_CONTRACT_AUTHORITIES,
  order: CHAT_SHARED_CONTRACT_ORDER,
  categories: CHAT_CONTRACT_CATEGORIES,
  runtimeLanes: CHAT_RUNTIME_LANES,
  modules: CHAT_CONTRACT_MODULE_DESCRIPTORS,
  dependencies: CHAT_CONTRACT_DEPENDENCY_GRAPH,
  importPaths: CHAT_CONTRACT_RELATIVE_PATHS,
  fileNames: CHAT_CONTRACT_FILE_NAMES,
} as const);

export type ChatSharedContractManifest =
  typeof CHAT_SHARED_CONTRACT_MANIFEST;

export interface ChatSharedContractSurface {
  readonly version: typeof CHAT_SHARED_CONTRACT_BARREL_VERSION;
  readonly revision: typeof CHAT_CONTRACT_REVISION;
  readonly barrelPath: typeof CHAT_SHARED_CONTRACT_BARREL_PATH;
  readonly authorities: typeof CHAT_CONTRACT_AUTHORITIES;
  readonly manifest: ChatSharedContractManifest;
  readonly modules: typeof CHAT_CONTRACT_MODULE_NAMESPACES;
  readonly packages: ChatSharedContractPackages;
  readonly channels: typeof CHAT_CHANNEL_CONTRACT;
  readonly events: typeof CHAT_EVENT_CONTRACT;
  readonly learning: typeof LearningModule;
}

export const CHAT_SHARED_CONTRACT_SURFACE: ChatSharedContractSurface =
  Object.freeze({
    version: CHAT_SHARED_CONTRACT_BARREL_VERSION,
    revision: CHAT_CONTRACT_REVISION,
    barrelPath: CHAT_SHARED_CONTRACT_BARREL_PATH,
    authorities: CHAT_CONTRACT_AUTHORITIES,
    manifest: CHAT_SHARED_CONTRACT_MANIFEST,
    modules: CHAT_CONTRACT_MODULE_NAMESPACES,
    packages: CHAT_SHARED_CONTRACT_PACKAGES,
    channels: CHAT_CHANNEL_CONTRACT,
    events: CHAT_EVENT_CONTRACT,
    learning: LearningModule,
  });

export const CHAT_SHARED_CONTRACT_REGISTRY = Object.freeze({
  manifest: CHAT_SHARED_CONTRACT_MANIFEST,
  surface: CHAT_SHARED_CONTRACT_SURFACE,
  descriptors: CHAT_CONTRACT_MODULE_DESCRIPTORS,
  namespaces: CHAT_CONTRACT_MODULE_NAMESPACES,
  packages: CHAT_SHARED_CONTRACT_PACKAGES,
  byCategory: CHAT_CONTRACT_KEYS_BY_CATEGORY,
  helpers: Object.freeze({
    isChatContractModuleKey,
    getChatContractDescriptor,
    getChatContractNamespace,
    getChatContractPackage,
    listChatContractKeysByCategory,
    listChatContractImportPaths,
    getChatContractImportPath,
    getChatContractFileName,
    hasChatContract,
    hasChatContractManifest,
  }),
});
