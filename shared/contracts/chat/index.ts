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
import * as ChatMomentModule from './ChatMoment';
import * as ChatSceneModule from './ChatScene';
import * as ChatInterruptionModule from './ChatInterruption';
import * as ChatBossFightModule from './ChatBossFight';
import * as ChatCounterplayModule from './ChatCounterplay';
import * as ChatRescueModule from './ChatRescue';
import * as ChatRecoveryModule from './ChatRecovery';
import * as ChatNegotiationModuleNS from './ChatNegotiation';
import * as ChatOfferModuleNS from './ChatOffer';
import * as LearningModule from './learning';

// ============================================================================
// MARK: Stable low-risk direct re-exports
// ============================================================================

export * from './ChatChannels';
export * from './ChatEvents';
export * from './ChatMoment';
export * from './ChatScene';
export * from './ChatInterruption';
export * from './ChatBossFight';
export * from './ChatCounterplay';
export * from './ChatRescue';
export * from './ChatRecovery';
export * from './ChatNegotiation';
export * from './ChatOffer';

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
  ChatMomentModule as ChatMoment,
  ChatSceneModule as ChatScene,
  ChatInterruptionModule as ChatInterruption,
  ChatBossFightModule as ChatBossFight,
  ChatCounterplayModule as ChatCounterplay,
  ChatRescueModule as ChatRescue,
  ChatRecoveryModule as ChatRecovery,
  ChatNegotiationModuleNS as ChatNegotiation,
  ChatOfferModuleNS as ChatOffer,
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
  'ChatMoment',
  'ChatScene',
  'ChatInterruption',
  'ChatBossFight',
  'ChatCounterplay',
  'ChatRescue',
  'ChatRecovery',
  'ChatNegotiation',
  'ChatOffer',
  'Learning',
] as const;

export type ChatContractModuleKey =
  (typeof CHAT_CONTRACT_MODULE_KEYS)[number];

export const CHAT_CONTRACT_CATEGORIES = [
  'FOUNDATION',
  'EXPERIENCE',
  'MESSAGE',
  'PRESENCE',
  'TRANSCRIPT',
  'NPC',
  'COMMAND',
  'MODERATION',
  'INVASION',
  'TELEMETRY',
  'PROOF',
  'BOSSFIGHT',
  'COUNTERPLAY',
  'RESCUE',
  'NEGOTIATION',
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
  ChatMoment: './ChatMoment',
  ChatScene: './ChatScene',
  ChatInterruption: './ChatInterruption',
  ChatBossFight: './ChatBossFight',
  ChatCounterplay: './ChatCounterplay',
  ChatRescue: './ChatRescue',
  ChatRecovery: './ChatRecovery',
  ChatNegotiation: './ChatNegotiation',
  ChatOffer: './ChatOffer',
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
  ChatMoment: 'ChatMoment.ts',
  ChatScene: 'ChatScene.ts',
  ChatInterruption: 'ChatInterruption.ts',
  ChatBossFight: 'ChatBossFight.ts',
  ChatCounterplay: 'ChatCounterplay.ts',
  ChatRescue: 'ChatRescue.ts',
  ChatRecovery: 'ChatRecovery.ts',
  ChatNegotiation: 'ChatNegotiation.ts',
  ChatOffer: 'ChatOffer.ts',
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
  | typeof ChatMomentModule
  | typeof ChatSceneModule
  | typeof ChatInterruptionModule
  | typeof ChatBossFightModule
  | typeof ChatCounterplayModule
  | typeof ChatRescueModule
  | typeof ChatRecoveryModule
  | typeof ChatNegotiationModuleNS
  | typeof ChatOfferModuleNS
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
  ChatMoment: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatMoment',
    fileName: 'ChatMoment.ts',
    importPath: './ChatMoment',
    category: 'EXPERIENCE',
    description: 'Moment-level dramaturgy contract.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatMoment.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_MOMENT_CONTRACT_DESCRIPTOR',
    manifestExportName: 'CHAT_MOMENT_CONTRACT_DESCRIPTOR',
  }),
  ChatScene: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatScene',
    fileName: 'ChatScene.ts',
    importPath: './ChatScene',
    category: 'EXPERIENCE',
    description: 'Scene and beat planning contract.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatScene.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMoment'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_SCENE_CONTRACT_DESCRIPTOR',
    manifestExportName: 'CHAT_SCENE_CONTRACT_DESCRIPTOR',
  }),
  ChatInterruption: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatInterruption',
    fileName: 'ChatInterruption.ts',
    importPath: './ChatInterruption',
    category: 'EXPERIENCE',
    description: 'Interruption arbitration, silence protection, and preemption law.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatInterruption.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: ['ChatChannels', 'ChatEvents', 'ChatMoment', 'ChatScene'] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_INTERRUPTION_CONTRACT_DESCRIPTOR',
    manifestExportName: 'CHAT_INTERRUPTION_CONTRACT_DESCRIPTOR',
  }),
  ChatBossFight: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatBossFight',
    fileName: 'ChatBossFight.ts',
    importPath: './ChatBossFight',
    category: 'BOSSFIGHT',
    description:
      'Boss-fight phase contracts, encounter escalation envelopes, reward surfaces, and boss-fight descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatBossFight.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatNpc',
      'ChatInvasion',
      'ChatMoment',
      'ChatScene',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_BOSS_FIGHT_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatCounterplay: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatCounterplay',
    fileName: 'ChatCounterplay.ts',
    importPath: './ChatCounterplay',
    category: 'COUNTERPLAY',
    description:
      'Counterplay response contracts, player-agency windows, defiance mechanics, and counterplay descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatCounterplay.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatNpc',
      'ChatInvasion',
      'ChatMoment',
      'ChatScene',
      'ChatBossFight',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_COUNTERPLAY_CONTRACT_DESCRIPTOR',
    manifestExportName: null,
  }),
  ChatRescue: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatRescue',
    fileName: 'ChatRescue.ts',
    importPath: './ChatRescue',
    category: 'RESCUE',
    description:
      'Rescue interception contracts, churn-prevention triggers, helper handoff surfaces, and rescue descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatRescue.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatMoment',
      'ChatScene',
      'ChatInterruption',
      'ChatBossFight',
      'ChatCounterplay',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_RESCUE_CONTRACT_DESCRIPTOR',
    manifestExportName: 'CHAT_RESCUE_CONTRACT_DESCRIPTOR',
  }),
  ChatRecovery: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatRecovery',
    fileName: 'ChatRecovery.ts',
    importPath: './ChatRecovery',
    category: 'RESCUE',
    description:
      'Recovery ladders, one-card reset bundles, checkpoint contracts, and recovery descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatRecovery.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMoment',
      'ChatScene',
      'ChatBossFight',
      'ChatCounterplay',
      'ChatRescue',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_RECOVERY_CONTRACT_DESCRIPTOR',
    manifestExportName: 'CHAT_RECOVERY_CONTRACT_DESCRIPTOR',
  }),
  ChatNegotiation: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatNegotiation',
    fileName: 'ChatNegotiation.ts',
    importPath: './ChatNegotiation',
    category: 'NEGOTIATION',
    description:
      'Negotiation state contracts, offer ladders, deal-room session surfaces, and negotiation descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatNegotiation.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatMoment',
      'ChatScene',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_NEGOTIATION_CONTRACT_DESCRIPTOR',
    manifestExportName: 'CHAT_NEGOTIATION_CONTRACT_DESCRIPTOR',
  }),
  ChatOffer: Object.freeze<ChatContractModuleDescriptor>({
    key: 'ChatOffer',
    fileName: 'ChatOffer.ts',
    importPath: './ChatOffer',
    category: 'NEGOTIATION',
    description:
      'Offer payload contracts, acceptance surfaces, counter-offer semantics, and offer descriptor exports.',
    sharedRootPath: `${CHAT_CONTRACT_AUTHORITIES.sharedContractsRoot}/ChatOffer.ts`,
    usedBy: ALL_RUNTIME_LANES,
    dependsOn: [
      'ChatChannels',
      'ChatEvents',
      'ChatMessage',
      'ChatPresence',
      'ChatMoment',
      'ChatScene',
      'ChatNegotiation',
    ] as const,
    defaultExportName: null,
    contractExportName: 'CHAT_OFFER_CONTRACT_DESCRIPTOR',
    manifestExportName: 'CHAT_OFFER_CONTRACT_DESCRIPTOR',
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
  ChatMoment: ['ChatChannels', 'ChatEvents'] as const,
  ChatScene: ['ChatChannels', 'ChatEvents', 'ChatMoment'] as const,
  ChatInterruption: ['ChatChannels', 'ChatEvents', 'ChatMoment', 'ChatScene'] as const,
  ChatBossFight: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatNpc',
    'ChatInvasion',
    'ChatMoment',
    'ChatScene',
  ] as const,
  ChatCounterplay: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatNpc',
    'ChatInvasion',
    'ChatMoment',
    'ChatScene',
    'ChatBossFight',
  ] as const,
  ChatRescue: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatMoment',
    'ChatScene',
    'ChatInterruption',
    'ChatBossFight',
    'ChatCounterplay',
  ] as const,
  ChatRecovery: [
    'ChatChannels',
    'ChatEvents',
    'ChatMoment',
    'ChatScene',
    'ChatBossFight',
    'ChatCounterplay',
    'ChatRescue',
  ] as const,
  ChatNegotiation: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatMoment',
    'ChatScene',
  ] as const,
  ChatOffer: [
    'ChatChannels',
    'ChatEvents',
    'ChatMessage',
    'ChatPresence',
    'ChatMoment',
    'ChatScene',
    'ChatNegotiation',
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
  ChatMoment: ChatMomentModule,
  ChatScene: ChatSceneModule,
  ChatInterruption: ChatInterruptionModule,
  ChatBossFight: ChatBossFightModule,
  ChatCounterplay: ChatCounterplayModule,
  ChatRescue: ChatRescueModule,
  ChatRecovery: ChatRecoveryModule,
  ChatNegotiation: ChatNegotiationModuleNS,
  ChatOffer: ChatOfferModuleNS,
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
  ChatMoment: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatMoment,
    namespace: ChatMomentModule,
    defaultContract: readNamedExport(ChatMomentModule, 'CHAT_MOMENT_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatMomentModule, 'CHAT_MOMENT_CONTRACT_DESCRIPTOR'),
  }),
  ChatScene: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatScene,
    namespace: ChatSceneModule,
    defaultContract: readNamedExport(ChatSceneModule, 'CHAT_SCENE_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatSceneModule, 'CHAT_SCENE_CONTRACT_DESCRIPTOR'),
  }),
  ChatInterruption: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatInterruption,
    namespace: ChatInterruptionModule,
    defaultContract: readNamedExport(ChatInterruptionModule, 'CHAT_INTERRUPTION_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatInterruptionModule, 'CHAT_INTERRUPTION_CONTRACT_DESCRIPTOR'),
  }),
  ChatBossFight: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatBossFight,
    namespace: ChatBossFightModule,
    defaultContract: readNamedExport(ChatBossFightModule, 'CHAT_BOSS_FIGHT_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatBossFightModule, 'CHAT_BOSS_FIGHT_CONTRACT_DESCRIPTOR'),
  }),
  ChatCounterplay: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatCounterplay,
    namespace: ChatCounterplayModule,
    defaultContract: readNamedExport(ChatCounterplayModule, 'CHAT_COUNTERPLAY_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatCounterplayModule, 'CHAT_COUNTERPLAY_CONTRACT_DESCRIPTOR'),
  }),
  ChatRescue: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatRescue,
    namespace: ChatRescueModule,
    defaultContract: readNamedExport(ChatRescueModule, 'CHAT_RESCUE_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatRescueModule, 'CHAT_RESCUE_CONTRACT_DESCRIPTOR'),
  }),
  ChatRecovery: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatRecovery,
    namespace: ChatRecoveryModule,
    defaultContract: readNamedExport(ChatRecoveryModule, 'CHAT_RECOVERY_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatRecoveryModule, 'CHAT_RECOVERY_CONTRACT_DESCRIPTOR'),
  }),
  ChatNegotiation: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatNegotiation,
    namespace: ChatNegotiationModuleNS,
    defaultContract: readNamedExport(ChatNegotiationModuleNS, 'CHAT_NEGOTIATION_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatNegotiationModuleNS, 'CHAT_NEGOTIATION_CONTRACT_DESCRIPTOR'),
  }),
  ChatOffer: Object.freeze<ChatSharedContractPackage>({
    descriptor: CHAT_CONTRACT_MODULE_DESCRIPTORS.ChatOffer,
    namespace: ChatOfferModuleNS,
    defaultContract: readNamedExport(ChatOfferModuleNS, 'CHAT_OFFER_CONTRACT_DESCRIPTOR'),
    manifest: readNamedExport(ChatOfferModuleNS, 'CHAT_OFFER_CONTRACT_DESCRIPTOR'),
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
  EXPERIENCE: ['ChatMoment', 'ChatScene', 'ChatInterruption'] as const,
  MESSAGE: ['ChatMessage'] as const,
  PRESENCE: ['ChatPresence', 'ChatTyping', 'ChatCursor'] as const,
  TRANSCRIPT: ['ChatTranscript'] as const,
  NPC: ['ChatNpc'] as const,
  COMMAND: ['ChatCommand'] as const,
  MODERATION: ['ChatModeration'] as const,
  INVASION: ['ChatInvasion'] as const,
  TELEMETRY: ['ChatTelemetry'] as const,
  PROOF: ['ChatProof'] as const,
  BOSSFIGHT: ['ChatBossFight'] as const,
  COUNTERPLAY: ['ChatCounterplay'] as const,
  RESCUE: ['ChatRescue', 'ChatRecovery'] as const,
  NEGOTIATION: ['ChatNegotiation', 'ChatOffer'] as const,
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
  'ChatMoment',
  'ChatScene',
  'ChatInterruption',
  'ChatBossFight',
  'ChatCounterplay',
  'ChatRescue',
  'ChatRecovery',
  'ChatNegotiation',
  'ChatOffer',
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