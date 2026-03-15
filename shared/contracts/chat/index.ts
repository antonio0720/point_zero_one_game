/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT CONTRACT REGISTRY
 * FILE: shared/contracts/chat/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical shared registry and namespace surface for the unified chat
 * contracts lane. This file intentionally does more than a normal barrel: it
 * provides stable namespace exports, module descriptors, lookup helpers,
 * contract package accessors, category manifests, import-path truth, and
 * runtime-safe registry objects for every shared chat contract file.
 *
 * Design laws
 * -----------
 * 1. This registry must not become a source of flat export ambiguity. Many of
 *    the chat modules intentionally reuse foundational type names such as
 *    Brand, UnixMs, ChatRoomId, and ChatChannelId. The registry therefore
 *    exports stable namespaces instead of flattening everything into one
 *    collision-prone global surface.
 * 2. Import paths and file descriptors must reflect the actual repo split:
 *    frontend chat engine under /pzo-web/src/engines/chat, frontend render
 *    shell under /pzo-web/src/components/chat, transport under /pzo-server,
 *    and authoritative simulation beside backend battle lanes.
 * 3. Every module in /shared/contracts/chat should be discoverable here by
 *    key, file name, category, concern, and long-term authority path.
 *
 * Repo-aligned doctrine
 * ---------------------
 * The repo currently exposes the frontend chat engine tree with adapters,
 * channels, intelligence, NPC, replay, telemetry, and runtime files under
 * /pzo-web/src/engines/chat; a thin but still donor-heavy UI tree under
 * /pzo-web/src/components/chat; transport primitives in /pzo-server/src/ws and
 * /pzo-server/src/haters; and battle authority in
 * /backend/src/game/engine/battle. This registry exists so every one of those
 * lanes can anchor on one shared contract root instead of drifting into local
 * donor vocabularies. citeturn409074view0turn218451view0turn399251view0turn399251view1turn399251view2turn399251view3
 * ============================================================================
 */

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

export { ChatChannelsModule, ChatEventsModule, ChatMessageModule, ChatPresenceModule, ChatTypingModule, ChatCursorModule, ChatTranscriptModule, ChatNpcModule, ChatCommandModule, ChatModerationModule, ChatInvasionModule, ChatTelemetryModule, ChatProofModule };

// ============================================================================
// MARK: Foundational registry types
// ============================================================================

export type ChatContractModuleKey =
  | 'ChatChannels'
  | 'ChatEvents'
  | 'ChatMessage'
  | 'ChatPresence'
  | 'ChatTyping'
  | 'ChatCursor'
  | 'ChatTranscript'
  | 'ChatNpc'
  | 'ChatCommand'
  | 'ChatModeration'
  | 'ChatInvasion'
  | 'ChatTelemetry'
  | 'ChatProof'
  ;

export type ChatContractFileName =
  | 'ChatChannels.ts'
  | 'ChatEvents.ts'
  | 'ChatMessage.ts'
  | 'ChatPresence.ts'
  | 'ChatTyping.ts'
  | 'ChatCursor.ts'
  | 'ChatTranscript.ts'
  | 'ChatNpc.ts'
  | 'ChatCommand.ts'
  | 'ChatModeration.ts'
  | 'ChatInvasion.ts'
  | 'ChatTelemetry.ts'
  | 'ChatProof.ts'
  ;

export type ChatContractCategory = 'FOUNDATION' | 'MESSAGE' | 'PRESENCE' | 'TRANSCRIPT' | 'NPC' | 'COMMAND' | 'MODERATION' | 'INVASION' | 'TELEMETRY' | 'PROOF';

export type ChatRuntimeLane = 'frontend-engine' | 'frontend-ui' | 'backend-engine' | 'server-transport' | 'shared-contracts';

export interface ChatContractModuleDescriptor {
  readonly key: ChatContractModuleKey;
  readonly fileName: ChatContractFileName;
  readonly importPath: string;
  readonly category: ChatContractCategory;
  readonly description: string;
  readonly sharedRootPath: string;
  readonly usedBy: readonly ChatRuntimeLane[];
  readonly dependsOn: readonly ChatContractModuleKey[];
  readonly defaultContractExportName: string;
}

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
] as const;

export const CHAT_CONTRACT_FILE_NAMES = [
  'ChatChannels.ts',
  'ChatEvents.ts',
  'ChatMessage.ts',
  'ChatPresence.ts',
  'ChatTyping.ts',
  'ChatCursor.ts',
  'ChatTranscript.ts',
  'ChatNpc.ts',
  'ChatCommand.ts',
  'ChatModeration.ts',
  'ChatInvasion.ts',
  'ChatTelemetry.ts',
  'ChatProof.ts',
] as const;

export const CHAT_CONTRACT_MODULE_DESCRIPTORS: Readonly<Record<ChatContractModuleKey, ChatContractModuleDescriptor>> = Object.freeze({
  ChatChannels: Object.freeze({
    key: 'ChatChannels',
    fileName: 'ChatChannels.ts',
    importPath: './ChatChannels',
    category: 'FOUNDATION',
    description: 'channel authority, mount presets, room scopes, and mode/channel descriptors',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatChannels.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: [] as const,
    defaultContractExportName: 'CHAT_CHANNEL_CONTRACT',
  }),
  ChatEvents: Object.freeze({
    key: 'ChatEvents',
    fileName: 'ChatEvents.ts',
    importPath: './ChatEvents',
    category: 'FOUNDATION',
    description: 'canonical event names, transport envelopes, authority frames, and upstream signals',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatEvents.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels'] as const,
    defaultContractExportName: 'CHAT_EVENT_CONTRACT',
  }),
  ChatMessage: Object.freeze({
    key: 'ChatMessage',
    fileName: 'ChatMessage.ts',
    importPath: './ChatMessage',
    category: 'MESSAGE',
    description: 'canonical message shape, delivery state, proof envelopes, and rich metadata blocks',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatMessage.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultContractExportName: 'CHAT_MESSAGE_CONTRACT',
  }),
  ChatPresence: Object.freeze({
    key: 'ChatPresence',
    fileName: 'ChatPresence.ts',
    importPath: './ChatPresence',
    category: 'PRESENCE',
    description: 'presence roster, read-receipt visibility, and occupancy state',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatPresence.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultContractExportName: 'CHAT_PRESENCE_CONTRACT',
  }),
  ChatTyping: Object.freeze({
    key: 'ChatTyping',
    fileName: 'ChatTyping.ts',
    importPath: './ChatTyping',
    category: 'PRESENCE',
    description: 'typing cadence, theater simulation, and timeout planning',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatTyping.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultContractExportName: 'CHAT_TYPING_CONTRACT',
  }),
  ChatCursor: Object.freeze({
    key: 'ChatCursor',
    fileName: 'ChatCursor.ts',
    importPath: './ChatCursor',
    category: 'PRESENCE',
    description: 'cursor anchors, windows, transcript pointer semantics, and hover state',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatCursor.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultContractExportName: 'CHAT_CURSOR_CONTRACT',
  }),
  ChatTranscript: Object.freeze({
    key: 'ChatTranscript',
    fileName: 'ChatTranscript.ts',
    importPath: './ChatTranscript',
    category: 'TRANSCRIPT',
    description: 'ledger slices, diffs, query results, and export-grade transcript truth',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatTranscript.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage'] as const,
    defaultContractExportName: 'CHAT_TRANSCRIPT_CONTRACT',
  }),
  ChatNpc: Object.freeze({
    key: 'ChatNpc',
    fileName: 'ChatNpc.ts',
    importPath: './ChatNpc',
    category: 'NPC',
    description: 'NPC descriptors, candidate lines, registry snapshots, and reaction planning inputs',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatNpc.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultContractExportName: 'CHAT_NPC_CONTRACT',
  }),
  ChatCommand: Object.freeze({
    key: 'ChatCommand',
    fileName: 'ChatCommand.ts',
    importPath: './ChatCommand',
    category: 'COMMAND',
    description: 'command descriptors, parsing, validation, routing, envelopes, and receipts',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatCommand.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatPresence', 'ChatTyping', 'ChatCursor', 'ChatTranscript', 'ChatNpc'] as const,
    defaultContractExportName: 'CHAT_COMMAND_CONTRACT',
  }),
  ChatModeration: Object.freeze({
    key: 'ChatModeration',
    fileName: 'ChatModeration.ts',
    importPath: './ChatModeration',
    category: 'MODERATION',
    description: 'moderation profiles, rules, decision envelopes, and audit records',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatModeration.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatPresence', 'ChatTyping', 'ChatTranscript', 'ChatNpc'] as const,
    defaultContractExportName: 'CHAT_MODERATION_CONTRACT',
  }),
  ChatInvasion: Object.freeze({
    key: 'ChatInvasion',
    fileName: 'ChatInvasion.ts',
    importPath: './ChatInvasion',
    category: 'INVASION',
    description: 'invasion scenes, beats, runtime state, replay anchors, and outcomes',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatInvasion.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatTranscript', 'ChatNpc'] as const,
    defaultContractExportName: 'CHAT_INVASION_CONTRACT',
  }),
  ChatTelemetry: Object.freeze({
    key: 'ChatTelemetry',
    fileName: 'ChatTelemetry.ts',
    importPath: './ChatTelemetry',
    category: 'TELEMETRY',
    description: 'facts, streams, sinks, batch state, summaries, and export manifests',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatTelemetry.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatPresence', 'ChatTyping', 'ChatCursor', 'ChatTranscript', 'ChatNpc', 'ChatCommand', 'ChatModeration', 'ChatInvasion'] as const,
    defaultContractExportName: 'CHAT_TELEMETRY_CONTRACT',
  }),
  ChatProof: Object.freeze({
    key: 'ChatProof',
    fileName: 'ChatProof.ts',
    importPath: './ChatProof',
    category: 'PROOF',
    description: 'causal lineage, verification state, conflict records, bundle exports, and proof ledger state',
    sharedRootPath: `${ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/{file}`.replace('{file}', 'ChatProof.ts'),
    usedBy: ['shared-contracts', 'frontend-engine', 'frontend-ui', 'backend-engine', 'server-transport'] as const,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMessage', 'ChatTranscript', 'ChatNpc', 'ChatCommand', 'ChatModeration', 'ChatInvasion', 'ChatTelemetry'] as const,
    defaultContractExportName: 'CHAT_PROOF_CONTRACT',
  }),
});

// ============================================================================
// MARK: Stable namespaces
// ============================================================================

export const ChatChannels = Object.freeze(ChatChannelsModule);

export const ChatEvents = Object.freeze(ChatEventsModule);

export const ChatMessage = Object.freeze(ChatMessageModule);

export const ChatPresence = Object.freeze(ChatPresenceModule);

export const ChatTyping = Object.freeze(ChatTypingModule);

export const ChatCursor = Object.freeze(ChatCursorModule);

export const ChatTranscript = Object.freeze(ChatTranscriptModule);

export const ChatNpc = Object.freeze(ChatNpcModule);

export const ChatCommand = Object.freeze(ChatCommandModule);

export const ChatModeration = Object.freeze(ChatModerationModule);

export const ChatInvasion = Object.freeze(ChatInvasionModule);

export const ChatTelemetry = Object.freeze(ChatTelemetryModule);

export const ChatProof = Object.freeze(ChatProofModule);

export const CHAT_SHARED_CHAT_NAMESPACES = Object.freeze({
  ChatChannels,
  ChatEvents,
  ChatMessage,
  ChatPresence,
  ChatTyping,
  ChatCursor,
  ChatTranscript,
  ChatNpc,
  ChatCommand,
  ChatModeration,
  ChatInvasion,
  ChatTelemetry,
  ChatProof,
} as const);

// ============================================================================
// MARK: Contract package accessors
// ============================================================================

export function getChatChannelsContract() {
  return (ChatChannelsModule as Record<string, unknown>)['CHAT_CHANNEL_CONTRACT'];
}

export function getChatEventsContract() {
  return (ChatEventsModule as Record<string, unknown>)['CHAT_EVENT_CONTRACT'];
}

export function getChatMessageContract() {
  return (ChatMessageModule as Record<string, unknown>)['CHAT_MESSAGE_CONTRACT'];
}

export function getChatPresenceContract() {
  return (ChatPresenceModule as Record<string, unknown>)['CHAT_PRESENCE_CONTRACT'];
}

export function getChatTypingContract() {
  return (ChatTypingModule as Record<string, unknown>)['CHAT_TYPING_CONTRACT'];
}

export function getChatCursorContract() {
  return (ChatCursorModule as Record<string, unknown>)['CHAT_CURSOR_CONTRACT'];
}

export function getChatTranscriptContract() {
  return (ChatTranscriptModule as Record<string, unknown>)['CHAT_TRANSCRIPT_CONTRACT'];
}

export function getChatNpcContract() {
  return (ChatNpcModule as Record<string, unknown>)['CHAT_NPC_CONTRACT'];
}

export function getChatCommandContract() {
  return (ChatCommandModule as Record<string, unknown>)['CHAT_COMMAND_CONTRACT'];
}

export function getChatModerationContract() {
  return (ChatModerationModule as Record<string, unknown>)['CHAT_MODERATION_CONTRACT'];
}

export function getChatInvasionContract() {
  return (ChatInvasionModule as Record<string, unknown>)['CHAT_INVASION_CONTRACT'];
}

export function getChatTelemetryContract() {
  return (ChatTelemetryModule as Record<string, unknown>)['CHAT_TELEMETRY_CONTRACT'];
}

export function getChatProofContract() {
  return (ChatProofModule as Record<string, unknown>)['CHAT_PROOF_CONTRACT'];
}

export const CHAT_SHARED_CHAT_CONTRACT_PACKAGES = Object.freeze({
  ChatChannels: getChatChannelsContract(),
  ChatEvents: getChatEventsContract(),
  ChatMessage: getChatMessageContract(),
  ChatPresence: getChatPresenceContract(),
  ChatTyping: getChatTypingContract(),
  ChatCursor: getChatCursorContract(),
  ChatTranscript: getChatTranscriptContract(),
  ChatNpc: getChatNpcContract(),
  ChatCommand: getChatCommandContract(),
  ChatModeration: getChatModerationContract(),
  ChatInvasion: getChatInvasionContract(),
  ChatTelemetry: getChatTelemetryContract(),
  ChatProof: getChatProofContract(),
} as const);

// ============================================================================
// MARK: Concern-grouped file lists
// ============================================================================

export const CHAT_FOUNDATION_MODULES = [
  'ChatChannels',
  'ChatEvents',
] as const;

export const CHAT_MESSAGE_MODULES = [
  'ChatMessage',
  'ChatTranscript',
  'ChatProof',
] as const;

export const CHAT_PRESENCE_MODULES = [
  'ChatPresence',
  'ChatTyping',
  'ChatCursor',
] as const;

export const CHAT_ACTOR_MODULES = [
  'ChatNpc',
  'ChatCommand',
  'ChatModeration',
  'ChatInvasion',
] as const;

export const CHAT_OBSERVABILITY_MODULES = [
  'ChatTelemetry',
  'ChatProof',
] as const;

export const CHAT_FULL_CONTRACT_ORDER = [
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
] as const;

// ============================================================================
// MARK: Guard and lookup helpers
// ============================================================================

export function isChatContractModuleKey(value: string): value is ChatContractModuleKey {
  return (CHAT_CONTRACT_MODULE_KEYS as readonly string[]).includes(value);
}

export function isChatContractFileName(value: string): value is ChatContractFileName {
  return (CHAT_CONTRACT_FILE_NAMES as readonly string[]).includes(value);
}

export function getChatContractModuleDescriptor(key: ChatContractModuleKey): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS[key];
}

export function getChatContractImportPath(key: ChatContractModuleKey): string {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS[key].importPath;
}

export function getChatContractFileName(key: ChatContractModuleKey): ChatContractFileName {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS[key].fileName;
}

export function getChatContractCategory(key: ChatContractModuleKey): ChatContractCategory {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS[key].category;
}

export function getChatContractDependencies(key: ChatContractModuleKey): readonly ChatContractModuleKey[] {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS[key].dependsOn;
}

export function moduleDependsOn(key: ChatContractModuleKey, dependency: ChatContractModuleKey): boolean {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS[key].dependsOn.includes(dependency);
}

export function findChatContractDescriptorByFileName(fileName: ChatContractFileName): ChatContractModuleDescriptor | undefined {
  return Object.values(CHAT_CONTRACT_MODULE_DESCRIPTORS).find((descriptor) => descriptor.fileName === fileName);
}

export function listChatContractsByCategory(category: ChatContractCategory): readonly ChatContractModuleDescriptor[] {
  return Object.values(CHAT_CONTRACT_MODULE_DESCRIPTORS).filter((descriptor) => descriptor.category === category);
}

export function listChatContractsUsedBy(lane: ChatRuntimeLane): readonly ChatContractModuleDescriptor[] {
  return Object.values(CHAT_CONTRACT_MODULE_DESCRIPTORS).filter((descriptor) => descriptor.usedBy.includes(lane));
}

export function isChatChannelsModuleKey(value: ChatContractModuleKey): value is "ChatChannels" {
  return value === 'ChatChannels';
}

export function getChatChannelsDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatChannels'];
}

export function isChatEventsModuleKey(value: ChatContractModuleKey): value is "ChatEvents" {
  return value === 'ChatEvents';
}

export function getChatEventsDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatEvents'];
}

export function isChatMessageModuleKey(value: ChatContractModuleKey): value is "ChatMessage" {
  return value === 'ChatMessage';
}

export function getChatMessageDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatMessage'];
}

export function isChatPresenceModuleKey(value: ChatContractModuleKey): value is "ChatPresence" {
  return value === 'ChatPresence';
}

export function getChatPresenceDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatPresence'];
}

export function isChatTypingModuleKey(value: ChatContractModuleKey): value is "ChatTyping" {
  return value === 'ChatTyping';
}

export function getChatTypingDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatTyping'];
}

export function isChatCursorModuleKey(value: ChatContractModuleKey): value is "ChatCursor" {
  return value === 'ChatCursor';
}

export function getChatCursorDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatCursor'];
}

export function isChatTranscriptModuleKey(value: ChatContractModuleKey): value is "ChatTranscript" {
  return value === 'ChatTranscript';
}

export function getChatTranscriptDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatTranscript'];
}

export function isChatNpcModuleKey(value: ChatContractModuleKey): value is "ChatNpc" {
  return value === 'ChatNpc';
}

export function getChatNpcDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatNpc'];
}

export function isChatCommandModuleKey(value: ChatContractModuleKey): value is "ChatCommand" {
  return value === 'ChatCommand';
}

export function getChatCommandDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatCommand'];
}

export function isChatModerationModuleKey(value: ChatContractModuleKey): value is "ChatModeration" {
  return value === 'ChatModeration';
}

export function getChatModerationDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatModeration'];
}

export function isChatInvasionModuleKey(value: ChatContractModuleKey): value is "ChatInvasion" {
  return value === 'ChatInvasion';
}

export function getChatInvasionDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatInvasion'];
}

export function isChatTelemetryModuleKey(value: ChatContractModuleKey): value is "ChatTelemetry" {
  return value === 'ChatTelemetry';
}

export function getChatTelemetryDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatTelemetry'];
}

export function isChatProofModuleKey(value: ChatContractModuleKey): value is "ChatProof" {
  return value === 'ChatProof';
}

export function getChatProofDescriptor(): ChatContractModuleDescriptor {
  return CHAT_CONTRACT_MODULE_DESCRIPTORS['ChatProof'];
}

// ============================================================================
// MARK: Manifest, surface, and default package bundle
// ============================================================================

export interface ChatSharedContractManifestEntry {
  readonly key: ChatContractModuleKey;
  readonly fileName: ChatContractFileName;
  readonly importPath: string;
  readonly category: ChatContractCategory;
  readonly descriptor: ChatContractModuleDescriptor;
  readonly namespace: unknown;
  readonly defaultContract: unknown;
}

export const CHAT_SHARED_CONTRACT_MANIFEST = Object.freeze([
  Object.freeze({
    key: 'ChatChannels',
    fileName: 'ChatChannels.ts',
    importPath: './ChatChannels',
    category: 'FOUNDATION',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatChannels,
    namespace: ChatChannels,
    defaultContract: getChatChannelsContract(),
  }),
  Object.freeze({
    key: 'ChatEvents',
    fileName: 'ChatEvents.ts',
    importPath: './ChatEvents',
    category: 'FOUNDATION',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatEvents,
    namespace: ChatEvents,
    defaultContract: getChatEventsContract(),
  }),
  Object.freeze({
    key: 'ChatMessage',
    fileName: 'ChatMessage.ts',
    importPath: './ChatMessage',
    category: 'MESSAGE',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatMessage,
    namespace: ChatMessage,
    defaultContract: getChatMessageContract(),
  }),
  Object.freeze({
    key: 'ChatPresence',
    fileName: 'ChatPresence.ts',
    importPath: './ChatPresence',
    category: 'PRESENCE',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatPresence,
    namespace: ChatPresence,
    defaultContract: getChatPresenceContract(),
  }),
  Object.freeze({
    key: 'ChatTyping',
    fileName: 'ChatTyping.ts',
    importPath: './ChatTyping',
    category: 'PRESENCE',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatTyping,
    namespace: ChatTyping,
    defaultContract: getChatTypingContract(),
  }),
  Object.freeze({
    key: 'ChatCursor',
    fileName: 'ChatCursor.ts',
    importPath: './ChatCursor',
    category: 'PRESENCE',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatCursor,
    namespace: ChatCursor,
    defaultContract: getChatCursorContract(),
  }),
  Object.freeze({
    key: 'ChatTranscript',
    fileName: 'ChatTranscript.ts',
    importPath: './ChatTranscript',
    category: 'TRANSCRIPT',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatTranscript,
    namespace: ChatTranscript,
    defaultContract: getChatTranscriptContract(),
  }),
  Object.freeze({
    key: 'ChatNpc',
    fileName: 'ChatNpc.ts',
    importPath: './ChatNpc',
    category: 'NPC',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatNpc,
    namespace: ChatNpc,
    defaultContract: getChatNpcContract(),
  }),
  Object.freeze({
    key: 'ChatCommand',
    fileName: 'ChatCommand.ts',
    importPath: './ChatCommand',
    category: 'COMMAND',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatCommand,
    namespace: ChatCommand,
    defaultContract: getChatCommandContract(),
  }),
  Object.freeze({
    key: 'ChatModeration',
    fileName: 'ChatModeration.ts',
    importPath: './ChatModeration',
    category: 'MODERATION',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatModeration,
    namespace: ChatModeration,
    defaultContract: getChatModerationContract(),
  }),
  Object.freeze({
    key: 'ChatInvasion',
    fileName: 'ChatInvasion.ts',
    importPath: './ChatInvasion',
    category: 'INVASION',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatInvasion,
    namespace: ChatInvasion,
    defaultContract: getChatInvasionContract(),
  }),
  Object.freeze({
    key: 'ChatTelemetry',
    fileName: 'ChatTelemetry.ts',
    importPath: './ChatTelemetry',
    category: 'TELEMETRY',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatTelemetry,
    namespace: ChatTelemetry,
    defaultContract: getChatTelemetryContract(),
  }),
  Object.freeze({
    key: 'ChatProof',
    fileName: 'ChatProof.ts',
    importPath: './ChatProof',
    category: 'PROOF',
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatProof,
    namespace: ChatProof,
    defaultContract: getChatProofContract(),
  }),
] as const);

export function resolveChatSharedContractManifestEntry(key: ChatContractModuleKey) {
  return CHAT_SHARED_CONTRACT_MANIFEST.find((entry) => entry.key === key);
}

export interface ChatSharedContractSurface {
  readonly version: typeof ChatChannelsModule.CHAT_CONTRACT_VERSION;
  readonly authorities: typeof ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES;
  readonly moduleKeys: typeof CHAT_CONTRACT_MODULE_KEYS;
  readonly fileNames: typeof CHAT_CONTRACT_FILE_NAMES;
  readonly descriptors: typeof CHAT_CONTRACT_MODULE_DESCRIPTORS;
  readonly namespaces: typeof CHAT_SHARED_CHAT_NAMESPACES;
  readonly contracts: typeof CHAT_SHARED_CHAT_CONTRACT_PACKAGES;
  readonly manifest: typeof CHAT_SHARED_CONTRACT_MANIFEST;
}

export const CHAT_SHARED_CONTRACT_SURFACE: ChatSharedContractSurface = Object.freeze({
  version: ChatChannelsModule.CHAT_CONTRACT_VERSION,
  authorities: ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES,
  moduleKeys: CHAT_CONTRACT_MODULE_KEYS,
  fileNames: CHAT_CONTRACT_FILE_NAMES,
  descriptors: CHAT_CONTRACT_MODULE_DESCRIPTORS,
  namespaces: CHAT_SHARED_CHAT_NAMESPACES,
  contracts: CHAT_SHARED_CHAT_CONTRACT_PACKAGES,
  manifest: CHAT_SHARED_CONTRACT_MANIFEST,
});

// ============================================================================
// MARK: Stable top-level package
// ============================================================================

export const CHAT_SHARED_CONTRACT_REGISTRY = Object.freeze({
  version: ChatChannelsModule.CHAT_CONTRACT_VERSION,
  apiVersion: '1.0.0-alpha',
  authorities: ChatChannelsModule.CHAT_CONTRACT_AUTHORITIES,
  descriptors: CHAT_CONTRACT_MODULE_DESCRIPTORS,
  manifest: CHAT_SHARED_CONTRACT_MANIFEST,
  namespaces: CHAT_SHARED_CHAT_NAMESPACES,
  contracts: CHAT_SHARED_CHAT_CONTRACT_PACKAGES,
  groups: Object.freeze({
    foundation: CHAT_FOUNDATION_MODULES,
    message: CHAT_MESSAGE_MODULES,
    presence: CHAT_PRESENCE_MODULES,
    actor: CHAT_ACTOR_MODULES,
    observability: CHAT_OBSERVABILITY_MODULES,
    full: CHAT_FULL_CONTRACT_ORDER,
  }),
  ChatChannels,
  ChatEvents,
  ChatMessage,
  ChatPresence,
  ChatTyping,
  ChatCursor,
  ChatTranscript,
  ChatNpc,
  ChatCommand,
  ChatModeration,
  ChatInvasion,
  ChatTelemetry,
  ChatProof,
} as const);

export default CHAT_SHARED_CONTRACT_REGISTRY;