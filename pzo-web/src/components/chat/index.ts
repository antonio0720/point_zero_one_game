/**
 * ============================================================================
 * POINT ZERO ONE — COMPONENT CHAT BARREL + UI REGISTRY
 * FILE: pzo-web/src/components/chat/index.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical public import surface for the thin chat render shell.
 *
 * This file does more than a normal barrel because the repo is still in an
 * active migration between:
 * - legacy component-owned chat authority (`ChatPanel.tsx`, `useChatEngine.ts`,
 *   `chatTypes.ts`),
 * - the newer component shell (`UnifiedChatDock.tsx`, `useUnifiedChat.ts`,
 *   `uiTypes.ts`, thin render components),
 * - the canonical frontend engine lane (`pzo-web/src/engines/chat`),
 * - and the canonical shared contract lane (`shared/contracts/chat`).
 *
 * Design laws
 * -----------
 * 1. This file is the public barrel for the presentation lane only.
 * 2. The barrel may expose compatibility wrappers, but it must make their
 *    status explicit so future work does not accidentally re-promote them into
 *    primary authority.
 * 3. UI imports should be able to discover the component surface, registry,
 *    manifest, descriptors, and helper lookups from one place.
 * 4. This file must remain compile-safe even while individual component files
 *    keep evolving during migration.
 * 5. The component lane must not become a second engine. It may describe,
 *    register, and export UI modules, but not own chat truth.
 *
 * Long-term authority doctrine
 * ----------------------------
 * - shared contracts: /shared/contracts/chat
 * - frontend engine: /pzo-web/src/engines/chat
 * - frontend render shell: /pzo-web/src/components/chat
 * - backend authority: /backend/src/game/engine/chat
 * - server transport: /pzo-server/src/chat
 *
 * Migration doctrine for this barrel
 * ---------------------------------
 * - primary UI shell exports stay first-class
 * - compatibility wrappers stay available but are explicitly tagged legacy
 * - low-risk direct re-exports are allowed
 * - module namespace exports are always available for tools, codegen, and
 *   large-scale refactors that need stable module-level access
 * ============================================================================
 */

import * as SharedChat from '../../../../shared/contracts/chat';
import * as SharedLearning from '../../../../shared/contracts/chat/learning';
import * as ChatEnginePublic from '../../engines/chat';

import * as UnifiedChatDockModule from './UnifiedChatDock';
import * as ChatComposerModule from './ChatComposer';
import * as ChatMessageFeedModule from './ChatMessageFeed';
import * as ChatMessageCardModule from './ChatMessageCard';
import * as ChatChannelTabsModule from './ChatChannelTabs';
import * as ChatPresenceStripModule from './ChatPresenceStrip';
import * as ChatTypingIndicatorModule from './ChatTypingIndicator';
import * as ChatInvasionBannerModule from './ChatInvasionBanner';
import * as ChatThreatMeterModule from './ChatThreatMeter';
import * as ChatHelperPromptModule from './ChatHelperPrompt';
import * as ChatCollapsedPillModule from './ChatCollapsedPill';
import * as ChatTranscriptDrawerModule from './ChatTranscriptDrawer';
import * as ChatRoomHeaderModule from './ChatRoomHeader';
import * as ChatEmptyStateModule from './ChatEmptyState';
import * as UseUnifiedChatModule from './useUnifiedChat';
import * as UiTypesModule from './uiTypes';

import * as ChatPanelModule from './ChatPanel';
import * as UseChatEngineModule from './useChatEngine';
import * as ChatTypesModule from './chatTypes';

// ============================================================================
// MARK: Low-risk direct re-exports
// ============================================================================

export * from './chatTypes';
export * from './uiTypes';
export * from './UnifiedChatDock';
export * from './ChatComposer';
export * from './ChatMessageFeed';
export * from './ChatMessageCard';
export * from './ChatChannelTabs';
export * from './ChatPresenceStrip';
export * from './ChatTypingIndicator';
export * from './ChatInvasionBanner';
export * from './ChatThreatMeter';
export * from './ChatHelperPrompt';
export * from './ChatCollapsedPill';
export * from './ChatTranscriptDrawer';
export * from './ChatRoomHeader';
export * from './ChatEmptyState';
export * from './useUnifiedChat';

// Compatibility exports stay live during migration.
export * from './ChatPanel';
export * from './useChatEngine';

// ============================================================================
// MARK: Stable namespace exports
// ============================================================================

export {
  SharedChat,
  SharedLearning,
  ChatEnginePublic,
  UnifiedChatDockModule,
  ChatComposerModule,
  ChatMessageFeedModule,
  ChatMessageCardModule,
  ChatChannelTabsModule,
  ChatPresenceStripModule,
  ChatTypingIndicatorModule,
  ChatInvasionBannerModule,
  ChatThreatMeterModule,
  ChatHelperPromptModule,
  ChatCollapsedPillModule,
  ChatTranscriptDrawerModule,
  ChatRoomHeaderModule,
  ChatEmptyStateModule,
  UseUnifiedChatModule,
  UiTypesModule,
  ChatPanelModule,
  UseChatEngineModule,
  ChatTypesModule,
};

// ============================================================================
// MARK: Registry types
// ============================================================================

export const CHAT_COMPONENT_BARREL_PATH =
  'pzo-web/src/components/chat/index.ts' as const;

export const CHAT_COMPONENT_NAMESPACE =
  'pzo-web/src/components/chat' as const;

export const CHAT_COMPONENT_VERSION = '2026.03.15' as const;

export const CHAT_COMPONENT_REVISION =
  'pzo.components.chat.barrel.v1' as const;

export const CHAT_COMPONENT_MODULE_KEYS = [
  'UnifiedChatDock',
  'ChatComposer',
  'ChatMessageFeed',
  'ChatMessageCard',
  'ChatChannelTabs',
  'ChatPresenceStrip',
  'ChatTypingIndicator',
  'ChatInvasionBanner',
  'ChatThreatMeter',
  'ChatHelperPrompt',
  'ChatCollapsedPill',
  'ChatTranscriptDrawer',
  'ChatRoomHeader',
  'ChatEmptyState',
  'useUnifiedChat',
  'uiTypes',
  'ChatPanel',
  'useChatEngine',
  'chatTypes',
] as const;

export type ChatComponentModuleKey =
  (typeof CHAT_COMPONENT_MODULE_KEYS)[number];

export const CHAT_COMPONENT_FILE_NAMES = [
  'UnifiedChatDock.tsx',
  'ChatComposer.tsx',
  'ChatMessageFeed.tsx',
  'ChatMessageCard.tsx',
  'ChatChannelTabs.tsx',
  'ChatPresenceStrip.tsx',
  'ChatTypingIndicator.tsx',
  'ChatInvasionBanner.tsx',
  'ChatThreatMeter.tsx',
  'ChatHelperPrompt.tsx',
  'ChatCollapsedPill.tsx',
  'ChatTranscriptDrawer.tsx',
  'ChatRoomHeader.tsx',
  'ChatEmptyState.tsx',
  'useUnifiedChat.ts',
  'uiTypes.ts',
  'ChatPanel.tsx',
  'useChatEngine.ts',
  'chatTypes.ts',
] as const;

export type ChatComponentFileName =
  (typeof CHAT_COMPONENT_FILE_NAMES)[number];

export const CHAT_COMPONENT_CATEGORIES = [
  'SHELL',
  'FEED',
  'COMPOSER',
  'CHANNELS',
  'PRESENCE',
  'INVASION',
  'THREAT',
  'HELPER',
  'TRANSCRIPT',
  'HEADER',
  'EMPTY',
  'HOOK',
  'TYPES',
  'COMPATIBILITY',
] as const;

export type ChatComponentCategory =
  (typeof CHAT_COMPONENT_CATEGORIES)[number];

export const CHAT_COMPONENT_STABILITY = [
  'PRIMARY',
  'MIGRATION_BRIDGE',
  'LEGACY_COMPAT',
] as const;

export type ChatComponentStability =
  (typeof CHAT_COMPONENT_STABILITY)[number];

export const CHAT_COMPONENT_RENDER_LAYERS = [
  'dock',
  'composer',
  'feed',
  'presence',
  'banner',
  'drawer',
  'header',
  'hook',
  'types',
  'compat',
] as const;

export type ChatComponentRenderLayer =
  (typeof CHAT_COMPONENT_RENDER_LAYERS)[number];

export interface ChatComponentModuleDescriptor {
  readonly key: ChatComponentModuleKey;
  readonly fileName: ChatComponentFileName;
  readonly importPath: string;
  readonly category: ChatComponentCategory;
  readonly stability: ChatComponentStability;
  readonly renderLayer: ChatComponentRenderLayer;
  readonly description: string;
  readonly usedByMounts: readonly SharedChat.ChatChannelsModule.ChatMountTarget[];
  readonly dependsOnEngine: boolean;
  readonly dependsOnSharedContracts: boolean;
  readonly directExportRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly longTermAuthority: boolean;
}

export type ChatComponentModuleNamespace =
  | typeof UnifiedChatDockModule
  | typeof ChatComposerModule
  | typeof ChatMessageFeedModule
  | typeof ChatMessageCardModule
  | typeof ChatChannelTabsModule
  | typeof ChatPresenceStripModule
  | typeof ChatTypingIndicatorModule
  | typeof ChatInvasionBannerModule
  | typeof ChatThreatMeterModule
  | typeof ChatHelperPromptModule
  | typeof ChatCollapsedPillModule
  | typeof ChatTranscriptDrawerModule
  | typeof ChatRoomHeaderModule
  | typeof ChatEmptyStateModule
  | typeof UseUnifiedChatModule
  | typeof UiTypesModule
  | typeof ChatPanelModule
  | typeof UseChatEngineModule
  | typeof ChatTypesModule;

const ALL_MOUNTS = SharedChat.ChatChannelsModule.CHAT_MOUNT_TARGETS;

const COMMON_UI_MOUNTS = [
  'BattleHUD',
  'ClubUI',
  'EmpireGameScreen',
  'GameBoard',
  'LeagueUI',
  'LobbyScreen',
  'PhantomGameScreen',
  'PredatorGameScreen',
  'SyndicateGameScreen',
] as const satisfies readonly SharedChat.ChatChannelsModule.ChatMountTarget[];

const AUXILIARY_MOUNTS = [
  'CounterplayModal',
  'EmpireBleedBanner',
  'MomentFlash',
  'ProofCard',
  'ProofCardV2',
  'RescueWindowBanner',
  'SabotageImpactPanel',
  'ThreatRadarPanel',
] as const satisfies readonly SharedChat.ChatChannelsModule.ChatMountTarget[];

export const CHAT_COMPONENT_IMPORT_PATHS = Object.freeze({
  UnifiedChatDock: './UnifiedChatDock',
  ChatComposer: './ChatComposer',
  ChatMessageFeed: './ChatMessageFeed',
  ChatMessageCard: './ChatMessageCard',
  ChatChannelTabs: './ChatChannelTabs',
  ChatPresenceStrip: './ChatPresenceStrip',
  ChatTypingIndicator: './ChatTypingIndicator',
  ChatInvasionBanner: './ChatInvasionBanner',
  ChatThreatMeter: './ChatThreatMeter',
  ChatHelperPrompt: './ChatHelperPrompt',
  ChatCollapsedPill: './ChatCollapsedPill',
  ChatTranscriptDrawer: './ChatTranscriptDrawer',
  ChatRoomHeader: './ChatRoomHeader',
  ChatEmptyState: './ChatEmptyState',
  useUnifiedChat: './useUnifiedChat',
  uiTypes: './uiTypes',
  ChatPanel: './ChatPanel',
  useChatEngine: './useChatEngine',
  chatTypes: './chatTypes',
} as const satisfies Record<ChatComponentModuleKey, string>);

export const CHAT_COMPONENT_MODULE_DESCRIPTORS = Object.freeze({
  UnifiedChatDock: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'UnifiedChatDock',
    fileName: 'UnifiedChatDock.tsx',
    importPath: './UnifiedChatDock',
    category: 'SHELL',
    stability: 'PRIMARY',
    renderLayer: 'dock',
    description:
      'Primary dock shell that mounts one chat surface across many screens without reclaiming engine authority.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: true,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatComposer: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatComposer',
    fileName: 'ChatComposer.tsx',
    importPath: './ChatComposer',
    category: 'COMPOSER',
    stability: 'PRIMARY',
    renderLayer: 'composer',
    description:
      'Render-only composer shell for draft text, channel-aware placeholders, and send affordances.',
    usedByMounts: COMMON_UI_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatMessageFeed: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatMessageFeed',
    fileName: 'ChatMessageFeed.tsx',
    importPath: './ChatMessageFeed',
    category: 'FEED',
    stability: 'PRIMARY',
    renderLayer: 'feed',
    description:
      'Grouped message feed surface for transcript rows, chronology, empty states, and feed virtualization decisions.',
    usedByMounts: COMMON_UI_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatMessageCard: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatMessageCard',
    fileName: 'ChatMessageCard.tsx',
    importPath: './ChatMessageCard',
    category: 'FEED',
    stability: 'PRIMARY',
    renderLayer: 'feed',
    description:
      'Single message presentation unit for sender chrome, proof badges, metadata chips, and narrative surface styling.',
    usedByMounts: COMMON_UI_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatChannelTabs: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatChannelTabs',
    fileName: 'ChatChannelTabs.tsx',
    importPath: './ChatChannelTabs',
    category: 'CHANNELS',
    stability: 'PRIMARY',
    renderLayer: 'dock',
    description:
      'Visible channel selector for Global, Syndicate, Deal Room, and future mount-eligible lanes.',
    usedByMounts: COMMON_UI_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatPresenceStrip: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatPresenceStrip',
    fileName: 'ChatPresenceStrip.tsx',
    importPath: './ChatPresenceStrip',
    category: 'PRESENCE',
    stability: 'PRIMARY',
    renderLayer: 'presence',
    description:
      'Room presence strip for player, helper, hater, ambient, and system audience indicators.',
    usedByMounts: COMMON_UI_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatTypingIndicator: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatTypingIndicator',
    fileName: 'ChatTypingIndicator.tsx',
    importPath: './ChatTypingIndicator',
    category: 'PRESENCE',
    stability: 'PRIMARY',
    renderLayer: 'presence',
    description:
      'Typing theater component that visualizes present-tense chat pressure without owning typing truth.',
    usedByMounts: COMMON_UI_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatInvasionBanner: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatInvasionBanner',
    fileName: 'ChatInvasionBanner.tsx',
    importPath: './ChatInvasionBanner',
    category: 'INVASION',
    stability: 'PRIMARY',
    renderLayer: 'banner',
    description:
      'Top-level invasion / raid / pressure banner surface for visible escalation moments.',
    usedByMounts: [...COMMON_UI_MOUNTS, ...AUXILIARY_MOUNTS],
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatThreatMeter: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatThreatMeter',
    fileName: 'ChatThreatMeter.tsx',
    importPath: './ChatThreatMeter',
    category: 'THREAT',
    stability: 'PRIMARY',
    renderLayer: 'banner',
    description:
      'Threat posture meter for taunt load, attack pressure, rescue urgency, and active aggression windows.',
    usedByMounts: [...COMMON_UI_MOUNTS, ...AUXILIARY_MOUNTS],
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatHelperPrompt: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatHelperPrompt',
    fileName: 'ChatHelperPrompt.tsx',
    importPath: './ChatHelperPrompt',
    category: 'HELPER',
    stability: 'PRIMARY',
    renderLayer: 'banner',
    description:
      'Helper prompt shell for rescue / guidance calls-to-action derived from engine and learning hints.',
    usedByMounts: [...COMMON_UI_MOUNTS, 'RescueWindowBanner'],
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatCollapsedPill: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatCollapsedPill',
    fileName: 'ChatCollapsedPill.tsx',
    importPath: './ChatCollapsedPill',
    category: 'SHELL',
    stability: 'PRIMARY',
    renderLayer: 'dock',
    description:
      'Collapsed shell for unread counts, quick reopen, and mount-safe minimal chat presence.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatTranscriptDrawer: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatTranscriptDrawer',
    fileName: 'ChatTranscriptDrawer.tsx',
    importPath: './ChatTranscriptDrawer',
    category: 'TRANSCRIPT',
    stability: 'PRIMARY',
    renderLayer: 'drawer',
    description:
      'Drawer surface for transcript search, grouped history inspection, and replay-adjacent message review.',
    usedByMounts: [...COMMON_UI_MOUNTS, 'ProofCard', 'ProofCardV2'],
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatRoomHeader: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatRoomHeader',
    fileName: 'ChatRoomHeader.tsx',
    importPath: './ChatRoomHeader',
    category: 'HEADER',
    stability: 'PRIMARY',
    renderLayer: 'header',
    description:
      'Header shell for room titles, subtitles, connection state, mount labels, and contextual channel metadata.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatEmptyState: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatEmptyState',
    fileName: 'ChatEmptyState.tsx',
    importPath: './ChatEmptyState',
    category: 'EMPTY',
    stability: 'PRIMARY',
    renderLayer: 'feed',
    description:
      'Empty feed shell for quiet channels, no-history states, and low-noise transition moments.',
    usedByMounts: COMMON_UI_MOUNTS,
    dependsOnEngine: false,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  useUnifiedChat: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'useUnifiedChat',
    fileName: 'useUnifiedChat.ts',
    importPath: './useUnifiedChat',
    category: 'HOOK',
    stability: 'PRIMARY',
    renderLayer: 'hook',
    description:
      'Primary presentation hook for shell open state, drafts, transcript drawer state, and render-safe derivations.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: true,
    dependsOnSharedContracts: true,
    directExportRisk: 'MEDIUM',
    longTermAuthority: true,
  }),
  uiTypes: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'uiTypes',
    fileName: 'uiTypes.ts',
    importPath: './uiTypes',
    category: 'TYPES',
    stability: 'PRIMARY',
    renderLayer: 'types',
    description:
      'Canonical presentation-only type surface for the component chat shell.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: true,
    dependsOnSharedContracts: true,
    directExportRisk: 'LOW',
    longTermAuthority: true,
  }),
  ChatPanel: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'ChatPanel',
    fileName: 'ChatPanel.tsx',
    importPath: './ChatPanel',
    category: 'COMPATIBILITY',
    stability: 'LEGACY_COMPAT',
    renderLayer: 'compat',
    description:
      'Legacy panel wrapper retained for import stability while UnifiedChatDock takes over as the primary shell.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: true,
    dependsOnSharedContracts: true,
    directExportRisk: 'HIGH',
    longTermAuthority: false,
  }),
  useChatEngine: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'useChatEngine',
    fileName: 'useChatEngine.ts',
    importPath: './useChatEngine',
    category: 'COMPATIBILITY',
    stability: 'LEGACY_COMPAT',
    renderLayer: 'compat',
    description:
      'Legacy hook bridge preserved for callers that have not yet moved to useUnifiedChat or the engine public lane.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: true,
    dependsOnSharedContracts: true,
    directExportRisk: 'HIGH',
    longTermAuthority: false,
  }),
  chatTypes: Object.freeze<ChatComponentModuleDescriptor>({
    key: 'chatTypes',
    fileName: 'chatTypes.ts',
    importPath: './chatTypes',
    category: 'COMPATIBILITY',
    stability: 'MIGRATION_BRIDGE',
    renderLayer: 'types',
    description:
      'Compatibility contract shim that keeps old imports alive while moving canonical truth into shared/contracts/chat.',
    usedByMounts: ALL_MOUNTS,
    dependsOnEngine: true,
    dependsOnSharedContracts: true,
    directExportRisk: 'HIGH',
    longTermAuthority: false,
  }),
} as const satisfies Record<ChatComponentModuleKey, ChatComponentModuleDescriptor>);

export const CHAT_COMPONENT_MODULE_NAMESPACES = Object.freeze({
  UnifiedChatDock: UnifiedChatDockModule,
  ChatComposer: ChatComposerModule,
  ChatMessageFeed: ChatMessageFeedModule,
  ChatMessageCard: ChatMessageCardModule,
  ChatChannelTabs: ChatChannelTabsModule,
  ChatPresenceStrip: ChatPresenceStripModule,
  ChatTypingIndicator: ChatTypingIndicatorModule,
  ChatInvasionBanner: ChatInvasionBannerModule,
  ChatThreatMeter: ChatThreatMeterModule,
  ChatHelperPrompt: ChatHelperPromptModule,
  ChatCollapsedPill: ChatCollapsedPillModule,
  ChatTranscriptDrawer: ChatTranscriptDrawerModule,
  ChatRoomHeader: ChatRoomHeaderModule,
  ChatEmptyState: ChatEmptyStateModule,
  useUnifiedChat: UseUnifiedChatModule,
  uiTypes: UiTypesModule,
  ChatPanel: ChatPanelModule,
  useChatEngine: UseChatEngineModule,
  chatTypes: ChatTypesModule,
} as const satisfies Record<ChatComponentModuleKey, ChatComponentModuleNamespace>);

// ============================================================================
// MARK: Export groups and lookup helpers
// ============================================================================

export const CHAT_COMPONENT_PRIMARY_MODULES = [
  'UnifiedChatDock',
  'ChatComposer',
  'ChatMessageFeed',
  'ChatMessageCard',
  'ChatChannelTabs',
  'ChatPresenceStrip',
  'ChatTypingIndicator',
  'ChatInvasionBanner',
  'ChatThreatMeter',
  'ChatHelperPrompt',
  'ChatCollapsedPill',
  'ChatTranscriptDrawer',
  'ChatRoomHeader',
  'ChatEmptyState',
  'useUnifiedChat',
  'uiTypes',
] as const satisfies readonly ChatComponentModuleKey[];

export const CHAT_COMPONENT_COMPATIBILITY_MODULES = [
  'ChatPanel',
  'useChatEngine',
  'chatTypes',
] as const satisfies readonly ChatComponentModuleKey[];

export const CHAT_COMPONENT_FEED_SURFACE = [
  'UnifiedChatDock',
  'ChatMessageFeed',
  'ChatMessageCard',
  'ChatTranscriptDrawer',
  'ChatEmptyState',
  'uiTypes',
  'chatTypes',
] as const satisfies readonly ChatComponentModuleKey[];

export const CHAT_COMPONENT_INTERACTION_SURFACE = [
  'ChatComposer',
  'ChatChannelTabs',
  'ChatPresenceStrip',
  'ChatTypingIndicator',
  'ChatHelperPrompt',
  'useUnifiedChat',
  'useChatEngine',
] as const satisfies readonly ChatComponentModuleKey[];

export const CHAT_COMPONENT_STATUS_SURFACE = [
  'ChatInvasionBanner',
  'ChatThreatMeter',
  'ChatRoomHeader',
  'ChatCollapsedPill',
] as const satisfies readonly ChatComponentModuleKey[];

export function isChatComponentModuleKey(
  value: string,
): value is ChatComponentModuleKey {
  return (CHAT_COMPONENT_MODULE_KEYS as readonly string[]).includes(value);
}

export function getChatComponentDescriptor(
  key: ChatComponentModuleKey,
): ChatComponentModuleDescriptor {
  return CHAT_COMPONENT_MODULE_DESCRIPTORS[key];
}

export function getChatComponentNamespace(
  key: ChatComponentModuleKey,
): ChatComponentModuleNamespace {
  return CHAT_COMPONENT_MODULE_NAMESPACES[key];
}

export function getChatComponentImportPath(
  key: ChatComponentModuleKey,
): string {
  return CHAT_COMPONENT_IMPORT_PATHS[key];
}

export function getChatComponentFileName(
  key: ChatComponentModuleKey,
): ChatComponentFileName {
  return CHAT_COMPONENT_MODULE_DESCRIPTORS[key].fileName;
}

export function listPrimaryChatComponentModules(): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_PRIMARY_MODULES;
}

export function listCompatibilityChatComponentModules(): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_COMPATIBILITY_MODULES;
}

export function listChatComponentModulesByCategory(
  category: ChatComponentCategory,
): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_MODULE_KEYS.filter(
    (key) => CHAT_COMPONENT_MODULE_DESCRIPTORS[key].category === category,
  );
}

export function listChatComponentModulesByStability(
  stability: ChatComponentStability,
): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_MODULE_KEYS.filter(
    (key) => CHAT_COMPONENT_MODULE_DESCRIPTORS[key].stability === stability,
  );
}

export function moduleIsPrimary(
  key: ChatComponentModuleKey,
): boolean {
  return CHAT_COMPONENT_MODULE_DESCRIPTORS[key].stability === 'PRIMARY';
}

export function moduleIsCompatibilityOnly(
  key: ChatComponentModuleKey,
): boolean {
  return CHAT_COMPONENT_MODULE_DESCRIPTORS[key].stability !== 'PRIMARY';
}

export function moduleOwnsLongTermAuthority(
  key: ChatComponentModuleKey,
): boolean {
  return CHAT_COMPONENT_MODULE_DESCRIPTORS[key].longTermAuthority;
}

export function getModulesForMount(
  mountTarget: SharedChat.ChatChannelsModule.ChatMountTarget,
): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_MODULE_KEYS.filter((key) =>
    CHAT_COMPONENT_MODULE_DESCRIPTORS[key].usedByMounts.includes(mountTarget),
  );
}

export function getPrimaryModulesForMount(
  mountTarget: SharedChat.ChatChannelsModule.ChatMountTarget,
): readonly ChatComponentModuleKey[] {
  return getModulesForMount(mountTarget).filter(moduleIsPrimary);
}

export function getCompatibilityModulesForMount(
  mountTarget: SharedChat.ChatChannelsModule.ChatMountTarget,
): readonly ChatComponentModuleKey[] {
  return getModulesForMount(mountTarget).filter(moduleIsCompatibilityOnly);
}

function readNamedExport(
  namespace: Record<string, unknown>,
  key: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(namespace, key)
    ? namespace[key]
    : undefined;
}

export interface ChatComponentPackage {
  readonly descriptor: ChatComponentModuleDescriptor;
  readonly namespace: ChatComponentModuleNamespace;
  readonly namedExportHints: readonly string[];
  readonly defaultExportPresent: boolean;
}

export const CHAT_COMPONENT_PACKAGES = Object.freeze({
  UnifiedChatDock: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.UnifiedChatDock,
    namespace: UnifiedChatDockModule,
    namedExportHints: ['UnifiedChatDock'],
    defaultExportPresent: Boolean(
      readNamedExport(UnifiedChatDockModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatComposer: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatComposer,
    namespace: ChatComposerModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatComposerModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatMessageFeed: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatMessageFeed,
    namespace: ChatMessageFeedModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatMessageFeedModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatMessageCard: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatMessageCard,
    namespace: ChatMessageCardModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatMessageCardModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatChannelTabs: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatChannelTabs,
    namespace: ChatChannelTabsModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatChannelTabsModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatPresenceStrip: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatPresenceStrip,
    namespace: ChatPresenceStripModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatPresenceStripModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatTypingIndicator: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatTypingIndicator,
    namespace: ChatTypingIndicatorModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatTypingIndicatorModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatInvasionBanner: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatInvasionBanner,
    namespace: ChatInvasionBannerModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatInvasionBannerModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatThreatMeter: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatThreatMeter,
    namespace: ChatThreatMeterModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatThreatMeterModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatHelperPrompt: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatHelperPrompt,
    namespace: ChatHelperPromptModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatHelperPromptModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatCollapsedPill: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatCollapsedPill,
    namespace: ChatCollapsedPillModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatCollapsedPillModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatTranscriptDrawer: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatTranscriptDrawer,
    namespace: ChatTranscriptDrawerModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatTranscriptDrawerModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatRoomHeader: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatRoomHeader,
    namespace: ChatRoomHeaderModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatRoomHeaderModule as Record<string, unknown>, 'default'),
    ),
  }),
  ChatEmptyState: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatEmptyState,
    namespace: ChatEmptyStateModule,
    namedExportHints: [],
    defaultExportPresent: Boolean(
      readNamedExport(ChatEmptyStateModule as Record<string, unknown>, 'default'),
    ),
  }),
  useUnifiedChat: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.useUnifiedChat,
    namespace: UseUnifiedChatModule,
    namedExportHints: ['useUnifiedChat'],
    defaultExportPresent: Boolean(
      readNamedExport(UseUnifiedChatModule as Record<string, unknown>, 'default'),
    ),
  }),
  uiTypes: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.uiTypes,
    namespace: UiTypesModule,
    namedExportHints: [],
    defaultExportPresent: false,
  }),
  ChatPanel: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.ChatPanel,
    namespace: ChatPanelModule,
    namedExportHints: ['ChatPanel'],
    defaultExportPresent: Boolean(
      readNamedExport(ChatPanelModule as Record<string, unknown>, 'default'),
    ),
  }),
  useChatEngine: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.useChatEngine,
    namespace: UseChatEngineModule,
    namedExportHints: ['useChatEngine'],
    defaultExportPresent: Boolean(
      readNamedExport(UseChatEngineModule as Record<string, unknown>, 'default'),
    ),
  }),
  chatTypes: Object.freeze<ChatComponentPackage>({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS.chatTypes,
    namespace: ChatTypesModule,
    namedExportHints: ['ChatMessage', 'GameChatContext', 'SabotageEvent'],
    defaultExportPresent: false,
  }),
} as const satisfies Record<ChatComponentModuleKey, ChatComponentPackage>);

// ============================================================================
// MARK: Manifest and runtime surface
// ============================================================================

export interface ChatComponentManifestEntry {
  readonly key: ChatComponentModuleKey;
  readonly fileName: ChatComponentFileName;
  readonly importPath: string;
  readonly category: ChatComponentCategory;
  readonly stability: ChatComponentStability;
  readonly longTermAuthority: boolean;
}

export const CHAT_COMPONENT_MANIFEST = Object.freeze(
  CHAT_COMPONENT_MODULE_KEYS.map<ChatComponentManifestEntry>((key) => ({
    key,
    fileName: CHAT_COMPONENT_MODULE_DESCRIPTORS[key].fileName,
    importPath: CHAT_COMPONENT_MODULE_DESCRIPTORS[key].importPath,
    category: CHAT_COMPONENT_MODULE_DESCRIPTORS[key].category,
    stability: CHAT_COMPONENT_MODULE_DESCRIPTORS[key].stability,
    longTermAuthority: CHAT_COMPONENT_MODULE_DESCRIPTORS[key].longTermAuthority,
  })),
);

export interface ChatComponentSurface {
  readonly version: typeof CHAT_COMPONENT_VERSION;
  readonly revision: typeof CHAT_COMPONENT_REVISION;
  readonly barrelPath: typeof CHAT_COMPONENT_BARREL_PATH;
  readonly namespace: typeof CHAT_COMPONENT_NAMESPACE;
  readonly sharedContracts: typeof SharedChat;
  readonly learningContracts: typeof SharedLearning;
  readonly enginePublic: typeof ChatEnginePublic;
  readonly modules: typeof CHAT_COMPONENT_MODULE_NAMESPACES;
  readonly descriptors: typeof CHAT_COMPONENT_MODULE_DESCRIPTORS;
  readonly packages: typeof CHAT_COMPONENT_PACKAGES;
}

export const CHAT_COMPONENT_SURFACE: ChatComponentSurface = Object.freeze({
  version: CHAT_COMPONENT_VERSION,
  revision: CHAT_COMPONENT_REVISION,
  barrelPath: CHAT_COMPONENT_BARREL_PATH,
  namespace: CHAT_COMPONENT_NAMESPACE,
  sharedContracts: SharedChat,
  learningContracts: SharedLearning,
  enginePublic: ChatEnginePublic,
  modules: CHAT_COMPONENT_MODULE_NAMESPACES,
  descriptors: CHAT_COMPONENT_MODULE_DESCRIPTORS,
  packages: CHAT_COMPONENT_PACKAGES,
});

export const CHAT_COMPONENT_RUNTIME_LAWS = Object.freeze([
  'Component chat remains a render shell, not a source of transcript truth.',
  'Legacy wrappers may preserve imports but must not regain ownership.',
  'All canonical contracts flow inward from shared/contracts/chat.',
  'All engine authority flows inward from pzo-web/src/engines/chat.',
  'Barrel exports must remain migration-safe for multi-screen chat mounts.',
] as const);

export const CHAT_COMPONENT_MIGRATION_STATUS = Object.freeze({
  primaryShellReady: true,
  legacyWrappersStillPresent: true,
  sharedContractBackbonePresent: true,
  frontendEngineLanePresent: true,
  backendAuthorityLaneExpected: true,
  serverTransportLaneExpected: true,
  shellOwnsTruth: false,
  shellOwnsPresentation: true,
  chatTypesIsCompatibilityShim: true,
  useChatEngineIsCompatibilityBridge: true,
  ChatPanelIsCompatibilityBridge: true,
} as const);

export const CHAT_COMPONENT_REGISTRY = Object.freeze({
  manifest: CHAT_COMPONENT_MANIFEST,
  surface: CHAT_COMPONENT_SURFACE,
  descriptors: CHAT_COMPONENT_MODULE_DESCRIPTORS,
  namespaces: CHAT_COMPONENT_MODULE_NAMESPACES,
  packages: CHAT_COMPONENT_PACKAGES,
  groups: Object.freeze({
    primary: CHAT_COMPONENT_PRIMARY_MODULES,
    compatibility: CHAT_COMPONENT_COMPATIBILITY_MODULES,
    feed: CHAT_COMPONENT_FEED_SURFACE,
    interaction: CHAT_COMPONENT_INTERACTION_SURFACE,
    status: CHAT_COMPONENT_STATUS_SURFACE,
  }),
  laws: CHAT_COMPONENT_RUNTIME_LAWS,
  migration: CHAT_COMPONENT_MIGRATION_STATUS,
  helpers: Object.freeze({
    isChatComponentModuleKey,
    getChatComponentDescriptor,
    getChatComponentNamespace,
    getChatComponentImportPath,
    getChatComponentFileName,
    listPrimaryChatComponentModules,
    listCompatibilityChatComponentModules,
    listChatComponentModulesByCategory,
    listChatComponentModulesByStability,
    moduleIsPrimary,
    moduleIsCompatibilityOnly,
    moduleOwnsLongTermAuthority,
    getModulesForMount,
    getPrimaryModulesForMount,
    getCompatibilityModulesForMount,
  }),
});
