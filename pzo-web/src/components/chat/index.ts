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
 * This barrel is intentionally deeper than a normal `index.ts` because the
 * component lane is still carrying three jobs at once:
 * - publish the thin render shell safely,
 * - preserve migration bridges without re-promoting legacy authority,
 * - expose shell-normalization builders/adapters so callers stop reaching into
 *   component internals ad hoc.
 *
 * Design laws
 * -----------
 * 1. This file is the public barrel for the presentation lane only.
 * 2. The barrel may expose compatibility wrappers, but their status must stay
 *    explicit so future work does not accidentally re-promote them into
 *    primary authority.
 * 3. UI imports should be able to discover the component surface, registry,
 *    manifest, descriptors, helper lookups, builders, and adapters from one
 *    place.
 * 4. This file must remain compile-safe even while individual component files
 *    keep evolving during migration.
 * 5. The component lane must not become a second engine. It may describe,
 *    register, normalize, and export UI modules, but not own chat truth.
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
 * - shell normalization builders and adapters are first-class because they are
 *   now part of the presentation contract, not hidden implementation detail
 * - module namespace exports are always available for tools, codegen, and
 *   large-scale refactors that need stable module-level access
 * - helper prompt compatibility aliases may exist here, but canonical helper
 *   view-model truth still lives in ./uiTypes
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
import * as ChannelTabsSurfaceBuilderModule from './channelTabsSurfaceBuilder';
import * as ComposerSurfaceBuilderModule from './composerSurfaceBuilder';
import * as MessageFeedSurfaceBuilderModule from './messageFeedSurfaceBuilder';
import * as PresenceTypingSurfaceBuilderModule from './presenceTypingSurfaceBuilder';
import * as StatusSurfaceBuilderModule from './statusSurfaceBuilder';
import * as TranscriptDrawerAdapterModule from './transcriptDrawerAdapter';
import * as CollapsedPillAdapterModule from './collapsedPillAdapter';
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
export * from './ChatCollapsedPill';
export * from './ChatTranscriptDrawer';
export * from './ChatRoomHeader';
export * from './ChatEmptyState';
export * from './useUnifiedChat';
export * from './channelTabsSurfaceBuilder';
export * from './composerSurfaceBuilder';
export * from './messageFeedSurfaceBuilder';
export * from './presenceTypingSurfaceBuilder';
export * from './statusSurfaceBuilder';
export * from './transcriptDrawerAdapter';
export * from './collapsedPillAdapter';
export * from './ChatPanel';
export * from './useChatEngine';

/**
 * ChatHelperPrompt is handled explicitly instead of through `export *` so the
 * barrel can surface the default component under the canonical
 * `ChatHelperPrompt` name without colliding with the module's internal named
 * export surface.
 */
export { default as ChatHelperPrompt } from './ChatHelperPrompt';
export type {
  ChatHelperActionDescriptor,
  ChatHelperEvidenceLine,
  ChatHelperPromptDensity,
  ChatHelperPromptIntent,
  ChatHelperPromptModel,
  ChatHelperPromptProps,
  ChatHelperPromptTone,
} from './ChatHelperPrompt';

/**
 * Collapsed-pill adapter ships a default export. Surface it here under a
 * stable barrel alias so callers never need to reach for the file directly
 * just to get the canonical builder entry point.
 */
export { default as buildCollapsedPillSurfaceModel } from './collapsedPillAdapter';

// ============================================================================
// MARK: Helper-prompt compatibility aliases
// ============================================================================

/**
 * These aliases preserve a stable public vocabulary for helper-prompt builders
 * during migration. The canonical source of truth remains ./uiTypes.
 */
export type HelperPromptActionViewModel = UiTypesModule.ChatUiHelperPromptAction;
export type HelperPromptBadgeViewModel = UiTypesModule.ChatUiChip;
export type HelperPromptChannelViewModel = UiTypesModule.ChatUiHelperPromptChannel;
export type HelperPromptEvidenceViewModel = UiTypesModule.ChatUiHelperPromptEvidence;
export type HelperPromptMetricViewModel = UiTypesModule.ChatUiMetric;
export type HelperPromptPresentationViewModel = UiTypesModule.ChatUiHelperPromptPresentation;
export type HelperPromptViewModel = UiTypesModule.ChatUiHelperPromptViewModel;

export interface HelperPromptCopyViewModel {
  readonly title: UiTypesModule.UIString;
  readonly body: UiTypesModule.UIString;
  readonly summary?: UiTypesModule.UIString;
  readonly footerNote?: UiTypesModule.UIString;
  readonly provenanceNote?: UiTypesModule.UIString;
}

export interface HelperPromptStateViewModel {
  readonly visible: UiTypesModule.UIBoolean;
  readonly dismissible: UiTypesModule.UIBoolean;
  readonly mode: UiTypesModule.ChatUiHelperMode;
  readonly urgency: UiTypesModule.ChatUiUrgency;
  readonly rescueCritical: UiTypesModule.UIBoolean;
  readonly escalated: UiTypesModule.UIBoolean;
  readonly sticky: UiTypesModule.UIBoolean;
  readonly unreadCountHint?: UiTypesModule.UINumber;
}

export function buildHelperPromptActionViewModel(
  raw: unknown,
): HelperPromptActionViewModel {
  return UiTypesModule.createHelperPromptAction(raw);
}

export function buildHelperPromptBadgeViewModel(
  raw: unknown,
): HelperPromptBadgeViewModel {
  return (
    UiTypesModule.createChips([raw])[0] ?? {
      id: 'helper-badge:unknown',
      label: 'Helper',
      tone: 'neutral',
      accent: 'slate',
      emphasis: 'standard',
      importance: 'normal',
      active: false,
      disabled: false,
    }
  );
}

export function buildHelperPromptChannelViewModel(
  raw: unknown,
): HelperPromptChannelViewModel | undefined {
  return UiTypesModule.createHelperPromptChannel(raw);
}

export function buildHelperPromptCopyViewModel(
  raw: unknown,
): HelperPromptCopyViewModel {
  const source = UiTypesModule.asRecord(raw);
  return {
    title: UiTypesModule.asNonEmptyString(source.title, 'Suggested move'),
    body: UiTypesModule.asNonEmptyString(
      source.body,
      'A helper assist is available, but the shell has not received final copy yet.',
    ),
    summary: UiTypesModule.maybeText(source.summary),
    footerNote: UiTypesModule.maybeText(source.footerNote),
    provenanceNote: UiTypesModule.maybeText(source.provenanceNote),
  };
}

export function buildHelperPromptEvidenceViewModel(
  raw: unknown,
  index = 0,
): HelperPromptEvidenceViewModel {
  return UiTypesModule.createHelperPromptEvidence(raw, index);
}

export function buildHelperPromptMetricViewModel(
  raw: unknown,
  index = 0,
): HelperPromptMetricViewModel {
  return UiTypesModule.createMetric(raw, index);
}

export function buildHelperPromptPresentationViewModel(
  raw: unknown,
): HelperPromptPresentationViewModel | undefined {
  return UiTypesModule.createHelperPromptPresentation(raw);
}

export function buildHelperPromptStateViewModel(
  raw: unknown,
): HelperPromptStateViewModel {
  const source = UiTypesModule.asRecord(raw);
  return {
    visible: UiTypesModule.asBoolean(source.visible),
    dismissible: UiTypesModule.asBoolean(source.dismissible, true),
    mode: UiTypesModule.normalizeHelperMode(source.mode),
    urgency: UiTypesModule.normalizeUrgency(source.urgency),
    rescueCritical: UiTypesModule.asBoolean(source.rescueCritical),
    escalated: UiTypesModule.asBoolean(source.escalated),
    sticky: UiTypesModule.asBoolean(source.sticky),
    unreadCountHint: UiTypesModule.maybeNumber(source.unreadCountHint),
  };
}

// ============================================================================
// MARK: Normalized shell surface aliases
// ============================================================================

export type UnifiedShellSurfaceViewModel = UiTypesModule.ChatUiUnifiedShellViewModel;
export type ChannelTabsSurfaceViewModel = UiTypesModule.ChannelTabsViewModel;
export type ComposerSurfaceViewModel = UiTypesModule.ChatComposerViewModel;
export type MessageFeedSurfaceViewModel = UiTypesModule.MessageFeedViewModel;
export type FeedRowSurfaceViewModel = UiTypesModule.FeedRowModel;
export type MessageCardSurfaceViewModel = UiTypesModule.ChatUiMessageCardViewModel;
export type PresenceSurfaceViewModel = UiTypesModule.PresenceStripViewModel;
export type TypingSurfaceViewModel = UiTypesModule.TypingClusterViewModel;
export type InvasionSurfaceViewModel = UiTypesModule.InvasionBannerViewModel;
export type ThreatSurfaceViewModel = UiTypesModule.ThreatMeterViewModel;
export type RoomHeaderSurfaceViewModel = UiTypesModule.RoomHeaderViewModel;
export type EmptySurfaceViewModel = UiTypesModule.EmptyStateViewModel;
export type TranscriptDrawerSurfaceViewModel = UiTypesModule.ChatUiTranscriptDrawerSurfaceModel;
export type CollapsedPillSurfaceViewModel = UiTypesModule.ChatUiCollapsedPillViewModel;

export type ChannelTabsSurfaceBuilderOptions =
  ChannelTabsSurfaceBuilderModule.BuildChannelTabViewModelsOptions;
export type ChannelTabsSurfaceRecord =
  ChannelTabsSurfaceBuilderModule.ChannelTabRecord;
export type ComposerSurfaceBuilderInput =
  ComposerSurfaceBuilderModule.ComposerSurfaceBuilderInput;
export type ComposerSurfaceChannelMeta =
  ComposerSurfaceBuilderModule.ComposerChannelMeta;
export type MessageFeedSurfaceBuilderOptions =
  MessageFeedSurfaceBuilderModule.BuildMessageFeedSurfaceOptions;
export type MessageFeedSurfaceBuilderResult =
  MessageFeedSurfaceBuilderModule.BuildMessageFeedSurfaceResult;
export type PresenceTypingSurfaceBuilderArgs =
  PresenceTypingSurfaceBuilderModule.BuildPresenceTypingArgs;
export type StatusSurfaceBuilderArgs =
  StatusSurfaceBuilderModule.BuildStatusSurfaceArgs;
export type TranscriptDrawerSurfaceBuilderParams =
  TranscriptDrawerAdapterModule.BuildTranscriptDrawerSurfaceParams;
export type TranscriptDrawerCallbackFactoryParams =
  TranscriptDrawerAdapterModule.CreateTranscriptDrawerCallbacksParams;
export type CollapsedPillSurfaceBuilderOptions =
  CollapsedPillAdapterModule.CollapsedPillAdapterOptions;
export type CollapsedPillThreatOverride =
  CollapsedPillAdapterModule.CollapsedPillAdapterThreatOverride;
export type CollapsedPillInvasionOverride =
  CollapsedPillAdapterModule.CollapsedPillAdapterInvasionOverride;

export const buildChannelTabsSurfaceModel =
  ChannelTabsSurfaceBuilderModule.buildChannelTabViewModels;
export const buildComposerSurfaceModel =
  ComposerSurfaceBuilderModule.buildChatComposerSurfaceModel;
export const buildMessageCardSurfaceModel =
  MessageFeedSurfaceBuilderModule.buildMessageCardViewModelFromLegacy;
export const buildMessageFeedShellSurfaceModel =
  MessageFeedSurfaceBuilderModule.buildMessageFeedSurfaceModel;
export const buildPresenceSurfaceModel =
  PresenceTypingSurfaceBuilderModule.buildPresenceStripViewModel;
export const buildTypingSurfaceModel =
  PresenceTypingSurfaceBuilderModule.buildTypingClusterViewModel;
export const buildStatusThreatSurfaceModel =
  StatusSurfaceBuilderModule.buildThreatMeterViewModel;
export const buildStatusInvasionSurfaceModel =
  StatusSurfaceBuilderModule.buildInvasionBannerViewModel;
export const buildStatusRoomHeaderSurfaceModel =
  StatusSurfaceBuilderModule.buildRoomHeaderViewModel;
export const buildStatusEmptySurfaceModel =
  StatusSurfaceBuilderModule.buildEmptyStateViewModel;
export const buildTranscriptDrawerShellSurfaceModel =
  TranscriptDrawerAdapterModule.buildTranscriptDrawerSurfaceModel;
export const createTranscriptDrawerShellCallbacks =
  TranscriptDrawerAdapterModule.createTranscriptDrawerCallbacks;
export const buildCollapsedPillShellSurfaceModel =
  CollapsedPillAdapterModule.buildCollapsedPillViewModelFromUnifiedChat;

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
  ChannelTabsSurfaceBuilderModule,
  ComposerSurfaceBuilderModule,
  MessageFeedSurfaceBuilderModule,
  PresenceTypingSurfaceBuilderModule,
  StatusSurfaceBuilderModule,
  TranscriptDrawerAdapterModule,
  CollapsedPillAdapterModule,
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

export const CHAT_COMPONENT_VERSION = '2026.03.15-patched' as const;

export const CHAT_COMPONENT_REVISION =
  'pzo.components.chat.barrel.v3.shell-builders-and-adapters' as const;

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
  'ChannelTabsSurfaceBuilder',
  'ComposerSurfaceBuilder',
  'MessageFeedSurfaceBuilder',
  'PresenceTypingSurfaceBuilder',
  'StatusSurfaceBuilder',
  'TranscriptDrawerAdapter',
  'CollapsedPillAdapter',
  'ChatPanel',
  'useChatEngine',
  'chatTypes'
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
  'channelTabsSurfaceBuilder.ts',
  'composerSurfaceBuilder.ts',
  'messageFeedSurfaceBuilder.ts',
  'presenceTypingSurfaceBuilder.ts',
  'statusSurfaceBuilder.ts',
  'transcriptDrawerAdapter.ts',
  'collapsedPillAdapter.ts',
  'ChatPanel.tsx',
  'useChatEngine.ts',
  'chatTypes.ts'
] as const;

export type ChatComponentFileName =
  (typeof CHAT_COMPONENT_FILE_NAMES)[number];

export const CHAT_COMPONENT_CATEGORIES = [
  'SHELL',
  'COMPOSER',
  'FEED',
  'CHANNELS',
  'PRESENCE',
  'STATUS',
  'HELPER',
  'TRANSCRIPT',
  'HOOK',
  'TYPES',
  'BUILDER',
  'ADAPTER',
  'COMPATIBILITY'
] as const;

export type ChatComponentCategory =
  (typeof CHAT_COMPONENT_CATEGORIES)[number];

export const CHAT_COMPONENT_STABILITY = [
  'PRIMARY',
  'MIGRATION_BRIDGE',
  'LEGACY_COMPAT'
] as const;

export type ChatComponentStability =
  (typeof CHAT_COMPONENT_STABILITY)[number];

export const CHAT_COMPONENT_RENDER_LAYERS = [
  'dock',
  'composer',
  'feed',
  'presence',
  'banner',
  'status',
  'drawer',
  'header',
  'hook',
  'types',
  'builder',
  'adapter',
  'compat'
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
  readonly usedByMounts: readonly SharedChat.ChatMountTarget[];
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
 | typeof ChannelTabsSurfaceBuilderModule
 | typeof ComposerSurfaceBuilderModule
 | typeof MessageFeedSurfaceBuilderModule
 | typeof PresenceTypingSurfaceBuilderModule
 | typeof StatusSurfaceBuilderModule
 | typeof TranscriptDrawerAdapterModule
 | typeof CollapsedPillAdapterModule
 | typeof ChatPanelModule
 | typeof UseChatEngineModule
 | typeof ChatTypesModule;

interface ChatComponentModuleDefinition extends ChatComponentModuleDescriptor {
  readonly namespace: ChatComponentModuleNamespace;
  readonly namedExportHints: readonly string[];
  readonly defaultExportPresent: boolean;
}

export interface ChatComponentPackage {
  readonly descriptor: ChatComponentModuleDescriptor;
  readonly namespace: ChatComponentModuleNamespace;
  readonly namedExportHints: readonly string[];
  readonly defaultExportPresent: boolean;
}

const ALL_MOUNTS = SharedChat.CHAT_MOUNT_TARGETS;

const CORE_GAME_MOUNTS = [
  'BATTLE_HUD',
  'CLUB_UI',
  'EMPIRE_GAME_SCREEN',
  'GAME_BOARD',
  'LEAGUE_UI',
  'LOBBY_SCREEN',
  'PHANTOM_GAME_SCREEN',
  'PREDATOR_GAME_SCREEN',
  'SYNDICATE_GAME_SCREEN',
] as const satisfies readonly SharedChat.ChatMountTarget[];

const SUMMARY_MOUNTS = [
  'POST_RUN_SUMMARY',
] as const satisfies readonly SharedChat.ChatMountTarget[];

const TRANSCRIPT_CAPABLE_MOUNTS = [
  ...CORE_GAME_MOUNTS,
  ...SUMMARY_MOUNTS,
] as const satisfies readonly SharedChat.ChatMountTarget[];

function readNamedExport(
  namespace: Record<string, unknown>,
  key: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(namespace, key)
    ? namespace[key]
    : undefined;
}

function mapByKey<V>(
  build: (definition: ChatComponentModuleDefinition) => V,
): Record<ChatComponentModuleKey, V> {
  return Object.freeze(
    Object.fromEntries(
      CHAT_COMPONENT_MODULE_SPEC.map((definition) => [definition.key, build(definition)]),
    ),
  ) as Record<ChatComponentModuleKey, V>;
}

function listModuleKeysByFilter(
  predicate: (definition: ChatComponentModuleDefinition) => boolean,
): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_MODULE_SPEC.filter(predicate).map((definition) => definition.key);
}

// ============================================================================
// MARK: Module spec
// ============================================================================

export const CHAT_COMPONENT_MODULE_SPEC = [
{
  key: 'UnifiedChatDock',
  fileName: 'UnifiedChatDock.tsx',
  importPath: './UnifiedChatDock',
  category: 'SHELL',
  stability: 'PRIMARY',
  renderLayer: 'dock',
  description: 'Primary dock shell that mounts one chat surface across every supported screen without reclaiming engine authority.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: true,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: UnifiedChatDockModule,
  namedExportHints: ['UnifiedChatDock'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(UnifiedChatDockModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatComposer',
  fileName: 'ChatComposer.tsx',
  importPath: './ChatComposer',
  category: 'COMPOSER',
  stability: 'PRIMARY',
  renderLayer: 'composer',
  description: 'Render-only composer shell for drafts, quick inserts, reply previews, diagnostics, proof notices, and send affordances.',
  usedByMounts: CORE_GAME_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatComposerModule,
  namedExportHints: ['ChatComposer'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatComposerModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatMessageFeed',
  fileName: 'ChatMessageFeed.tsx',
  importPath: './ChatMessageFeed',
  category: 'FEED',
  stability: 'PRIMARY',
  renderLayer: 'feed',
  description: 'Grouped feed surface for transcript rows, unread markers, virtualization windows, and feed callbacks.',
  usedByMounts: TRANSCRIPT_CAPABLE_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatMessageFeedModule,
  namedExportHints: ['ChatMessageFeed'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatMessageFeedModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatMessageCard',
  fileName: 'ChatMessageCard.tsx',
  importPath: './ChatMessageCard',
  category: 'FEED',
  stability: 'PRIMARY',
  renderLayer: 'feed',
  description: 'Leaf message-card renderer for author chrome, proof badges, threat rails, attachments, and row actions.',
  usedByMounts: TRANSCRIPT_CAPABLE_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatMessageCardModule,
  namedExportHints: ['ChatMessageCard'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatMessageCardModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatChannelTabs',
  fileName: 'ChatChannelTabs.tsx',
  importPath: './ChatChannelTabs',
  category: 'CHANNELS',
  stability: 'PRIMARY',
  renderLayer: 'dock',
  description: 'Visible channel selector for Global, Syndicate, Deal Room, and future shell-eligible lanes.',
  usedByMounts: CORE_GAME_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatChannelTabsModule,
  namedExportHints: ['ChatChannelTabs'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatChannelTabsModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatPresenceStrip',
  fileName: 'ChatPresenceStrip.tsx',
  importPath: './ChatPresenceStrip',
  category: 'PRESENCE',
  stability: 'PRIMARY',
  renderLayer: 'presence',
  description: 'Presence strip renderer for player, helper, hater, ambient, system, and spectator visibility.',
  usedByMounts: CORE_GAME_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatPresenceStripModule,
  namedExportHints: ['ChatPresenceStrip'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatPresenceStripModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatTypingIndicator',
  fileName: 'ChatTypingIndicator.tsx',
  importPath: './ChatTypingIndicator',
  category: 'PRESENCE',
  stability: 'PRIMARY',
  renderLayer: 'presence',
  description: 'Typing-theater renderer for live clusters, lurk states, read-waits, and weaponized delays.',
  usedByMounts: CORE_GAME_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatTypingIndicatorModule,
  namedExportHints: ['ChatTypingIndicator'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatTypingIndicatorModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatInvasionBanner',
  fileName: 'ChatInvasionBanner.tsx',
  importPath: './ChatInvasionBanner',
  category: 'STATUS',
  stability: 'PRIMARY',
  renderLayer: 'status',
  description: 'Top-level invasion, breach, raid, or suppression banner surface driven by precomputed shell models.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatInvasionBannerModule,
  namedExportHints: ['ChatInvasionBanner'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatInvasionBannerModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatThreatMeter',
  fileName: 'ChatThreatMeter.tsx',
  importPath: './ChatThreatMeter',
  category: 'STATUS',
  stability: 'PRIMARY',
  renderLayer: 'status',
  description: 'Threat posture meter for aggregate pressure, dimension rails, and recommendation output.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatThreatMeterModule,
  namedExportHints: ['ChatThreatMeter'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatThreatMeterModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatHelperPrompt',
  fileName: 'ChatHelperPrompt.tsx',
  importPath: './ChatHelperPrompt',
  category: 'HELPER',
  stability: 'PRIMARY',
  renderLayer: 'banner',
  description: 'Helper prompt shell for rescue, guidance, and mentorship affordances derived upstream.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatHelperPromptModule,
  namedExportHints: ['ChatHelperPrompt', 'ChatHelperPromptProps'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatHelperPromptModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatCollapsedPill',
  fileName: 'ChatCollapsedPill.tsx',
  importPath: './ChatCollapsedPill',
  category: 'SHELL',
  stability: 'PRIMARY',
  renderLayer: 'dock',
  description: 'Collapsed shell surface for unread counts, reopen state, threat pulse, and minimized-but-alive chat presence.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatCollapsedPillModule,
  namedExportHints: ['ChatCollapsedPill'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatCollapsedPillModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatTranscriptDrawer',
  fileName: 'ChatTranscriptDrawer.tsx',
  importPath: './ChatTranscriptDrawer',
  category: 'TRANSCRIPT',
  stability: 'PRIMARY',
  renderLayer: 'drawer',
  description: 'Transcript drawer renderer for grouped history, search, filters, jump callbacks, and replay-adjacent inspection.',
  usedByMounts: TRANSCRIPT_CAPABLE_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatTranscriptDrawerModule,
  namedExportHints: ['ChatTranscriptDrawer'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatTranscriptDrawerModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatRoomHeader',
  fileName: 'ChatRoomHeader.tsx',
  importPath: './ChatRoomHeader',
  category: 'STATUS',
  stability: 'PRIMARY',
  renderLayer: 'header',
  description: 'Header shell for room title, subtitles, metrics, badges, actions, and contextual posture metadata.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatRoomHeaderModule,
  namedExportHints: ['ChatRoomHeader'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatRoomHeaderModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatEmptyState',
  fileName: 'ChatEmptyState.tsx',
  importPath: './ChatEmptyState',
  category: 'STATUS',
  stability: 'PRIMARY',
  renderLayer: 'status',
  description: 'Intentional empty-state renderer for cold open, disconnected, quiet-lane, search-zero, pending transcript, and collapsed scenarios.',
  usedByMounts: TRANSCRIPT_CAPABLE_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChatEmptyStateModule,
  namedExportHints: ['ChatEmptyState'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatEmptyStateModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'useUnifiedChat',
  fileName: 'useUnifiedChat.ts',
  importPath: './useUnifiedChat',
  category: 'HOOK',
  stability: 'PRIMARY',
  renderLayer: 'hook',
  description: 'Primary presentation hook that converts engine/runtime state into render-safe shell models and callbacks.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: true,
  dependsOnSharedContracts: true,
  directExportRisk: 'MEDIUM',
  longTermAuthority: true,
  namespace: UseUnifiedChatModule,
  namedExportHints: ['useUnifiedChat'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(UseUnifiedChatModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'uiTypes',
  fileName: 'uiTypes.ts',
  importPath: './uiTypes',
  category: 'TYPES',
  stability: 'PRIMARY',
  renderLayer: 'types',
  description: 'Canonical presentation-only type surface for the component chat shell.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: true,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: UiTypesModule,
  namedExportHints: ['ChatUiUnifiedShellViewModel', 'buildUnifiedShellViewModel', 'buildCollapsedPillViewModel', 'buildThreatMeterViewModel', 'buildRoomHeaderViewModel', 'buildEmptyStateViewModel'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(UiTypesModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChannelTabsSurfaceBuilder',
  fileName: 'channelTabsSurfaceBuilder.ts',
  importPath: './channelTabsSurfaceBuilder',
  category: 'BUILDER',
  stability: 'PRIMARY',
  renderLayer: 'builder',
  description: 'Shell normalization builder for channel-tab records into canonical tab view models.',
  usedByMounts: CORE_GAME_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ChannelTabsSurfaceBuilderModule,
  namedExportHints: ['buildChannelTabViewModels', 'BuildChannelTabViewModelsOptions', 'ChannelTabRecord'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChannelTabsSurfaceBuilderModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ComposerSurfaceBuilder',
  fileName: 'composerSurfaceBuilder.ts',
  importPath: './composerSurfaceBuilder',
  category: 'BUILDER',
  stability: 'PRIMARY',
  renderLayer: 'builder',
  description: 'Shell normalization builder for composer runtime state into the canonical composer surface model.',
  usedByMounts: CORE_GAME_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: ComposerSurfaceBuilderModule,
  namedExportHints: ['buildChatComposerSurfaceModel', 'ComposerSurfaceBuilderInput'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ComposerSurfaceBuilderModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'MessageFeedSurfaceBuilder',
  fileName: 'messageFeedSurfaceBuilder.ts',
  importPath: './messageFeedSurfaceBuilder',
  category: 'BUILDER',
  stability: 'PRIMARY',
  renderLayer: 'builder',
  description: 'Shell normalization builder for legacy transcript/runtime rows into canonical feed and card view models.',
  usedByMounts: TRANSCRIPT_CAPABLE_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: MessageFeedSurfaceBuilderModule,
  namedExportHints: ['buildMessageCardViewModelFromLegacy', 'buildMessageFeedSurfaceModel', 'BuildMessageFeedSurfaceOptions', 'BuildMessageFeedSurfaceResult'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(MessageFeedSurfaceBuilderModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'PresenceTypingSurfaceBuilder',
  fileName: 'presenceTypingSurfaceBuilder.ts',
  importPath: './presenceTypingSurfaceBuilder',
  category: 'BUILDER',
  stability: 'PRIMARY',
  renderLayer: 'builder',
  description: 'Shell normalization builder for derived presence actors and typing clusters.',
  usedByMounts: CORE_GAME_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: PresenceTypingSurfaceBuilderModule,
  namedExportHints: ['buildPresenceStripViewModel', 'buildTypingClusterViewModel', 'BuildPresenceTypingArgs'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(PresenceTypingSurfaceBuilderModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'StatusSurfaceBuilder',
  fileName: 'statusSurfaceBuilder.ts',
  importPath: './statusSurfaceBuilder',
  category: 'BUILDER',
  stability: 'PRIMARY',
  renderLayer: 'builder',
  description: 'Shell normalization builder for invasion banners, threat meters, room headers, and empty states.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: StatusSurfaceBuilderModule,
  namedExportHints: ['buildThreatMeterViewModel', 'buildInvasionBannerViewModel', 'buildRoomHeaderViewModel', 'buildEmptyStateViewModel', 'BuildStatusSurfaceArgs'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(StatusSurfaceBuilderModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'TranscriptDrawerAdapter',
  fileName: 'transcriptDrawerAdapter.ts',
  importPath: './transcriptDrawerAdapter',
  category: 'ADAPTER',
  stability: 'PRIMARY',
  renderLayer: 'adapter',
  description: 'Transcript-drawer adapter for search/filter surface models and callback factories.',
  usedByMounts: TRANSCRIPT_CAPABLE_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: TranscriptDrawerAdapterModule,
  namedExportHints: ['buildTranscriptDrawerSurfaceModel', 'createTranscriptDrawerCallbacks', 'BuildTranscriptDrawerSurfaceParams', 'CreateTranscriptDrawerCallbacksParams'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(TranscriptDrawerAdapterModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'CollapsedPillAdapter',
  fileName: 'collapsedPillAdapter.ts',
  importPath: './collapsedPillAdapter',
  category: 'ADAPTER',
  stability: 'PRIMARY',
  renderLayer: 'adapter',
  description: 'Collapsed-pill adapter that converts unified shell state into the minimized pill model.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: false,
  dependsOnSharedContracts: true,
  directExportRisk: 'LOW',
  longTermAuthority: true,
  namespace: CollapsedPillAdapterModule,
  namedExportHints: ['buildCollapsedPillViewModelFromUnifiedChat', 'CollapsedPillAdapterOptions'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(CollapsedPillAdapterModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'ChatPanel',
  fileName: 'ChatPanel.tsx',
  importPath: './ChatPanel',
  category: 'COMPATIBILITY',
  stability: 'LEGACY_COMPAT',
  renderLayer: 'compat',
  description: 'Legacy panel wrapper retained for import stability while UnifiedChatDock remains the primary shell.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: true,
  dependsOnSharedContracts: true,
  directExportRisk: 'HIGH',
  longTermAuthority: false,
  namespace: ChatPanelModule,
  namedExportHints: ['ChatPanel'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatPanelModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'useChatEngine',
  fileName: 'useChatEngine.ts',
  importPath: './useChatEngine',
  category: 'COMPATIBILITY',
  stability: 'LEGACY_COMPAT',
  renderLayer: 'compat',
  description: 'Legacy hook bridge preserved for callers not yet migrated to useUnifiedChat or the engine public lane.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: true,
  dependsOnSharedContracts: true,
  directExportRisk: 'HIGH',
  longTermAuthority: false,
  namespace: UseChatEngineModule,
  namedExportHints: ['useChatEngine'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(UseChatEngineModule as Record<string, unknown>, 'default'),
  ),
},
{
  key: 'chatTypes',
  fileName: 'chatTypes.ts',
  importPath: './chatTypes',
  category: 'COMPATIBILITY',
  stability: 'MIGRATION_BRIDGE',
  renderLayer: 'types',
  description: 'Compatibility contract shim that keeps legacy imports alive while canonical truth continues moving into shared/contracts/chat.',
  usedByMounts: ALL_MOUNTS,
  dependsOnEngine: true,
  dependsOnSharedContracts: true,
  directExportRisk: 'HIGH',
  longTermAuthority: false,
  namespace: ChatTypesModule,
  namedExportHints: ['ChatMessage', 'GameChatContext', 'SabotageEvent'] as const,
  defaultExportPresent: Boolean(
    readNamedExport(ChatTypesModule as Record<string, unknown>, 'default'),
  ),
},
] as const satisfies readonly ChatComponentModuleDefinition[];

export const CHAT_COMPONENT_IMPORT_PATHS = mapByKey(
  (definition) => definition.importPath,
);

export const CHAT_COMPONENT_MODULE_DESCRIPTORS = mapByKey<ChatComponentModuleDescriptor>(
  (definition) => ({
    key: definition.key,
    fileName: definition.fileName,
    importPath: definition.importPath,
    category: definition.category,
    stability: definition.stability,
    renderLayer: definition.renderLayer,
    description: definition.description,
    usedByMounts: definition.usedByMounts,
    dependsOnEngine: definition.dependsOnEngine,
    dependsOnSharedContracts: definition.dependsOnSharedContracts,
    directExportRisk: definition.directExportRisk,
    longTermAuthority: definition.longTermAuthority,
  }),
);

export const CHAT_COMPONENT_MODULE_NAMESPACES = mapByKey(
  (definition) => definition.namespace,
);

export const CHAT_COMPONENT_PACKAGES = mapByKey<ChatComponentPackage>(
  (definition) => ({
    descriptor: CHAT_COMPONENT_MODULE_DESCRIPTORS[definition.key],
    namespace: definition.namespace,
    namedExportHints: definition.namedExportHints,
    defaultExportPresent: definition.defaultExportPresent,
  }),
);

// ============================================================================
// MARK: Export groups and lookup helpers
// ============================================================================

export const CHAT_COMPONENT_PRIMARY_MODULES =
  listModuleKeysByFilter((definition) => definition.stability === 'PRIMARY');

export const CHAT_COMPONENT_COMPATIBILITY_MODULES =
  listModuleKeysByFilter((definition) => definition.stability !== 'PRIMARY');

export const CHAT_COMPONENT_BUILDER_MODULES =
  listModuleKeysByFilter((definition) => definition.category === 'BUILDER');

export const CHAT_COMPONENT_ADAPTER_MODULES =
  listModuleKeysByFilter((definition) => definition.category === 'ADAPTER');

export const CHAT_COMPONENT_FEED_SURFACE = [
  'UnifiedChatDock',
  'ChatMessageFeed',
  'ChatMessageCard',
  'ChatTranscriptDrawer',
  'ChatEmptyState',
  'MessageFeedSurfaceBuilder',
  'TranscriptDrawerAdapter',
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
  'ComposerSurfaceBuilder',
  'ChannelTabsSurfaceBuilder',
  'PresenceTypingSurfaceBuilder',
] as const satisfies readonly ChatComponentModuleKey[];

export const CHAT_COMPONENT_STATUS_SURFACE = [
  'ChatInvasionBanner',
  'ChatThreatMeter',
  'ChatRoomHeader',
  'ChatEmptyState',
  'StatusSurfaceBuilder',
] as const satisfies readonly ChatComponentModuleKey[];

export const CHAT_COMPONENT_COLLAPSED_SURFACE = [
  'ChatCollapsedPill',
  'CollapsedPillAdapter',
  'uiTypes',
] as const satisfies readonly ChatComponentModuleKey[];

export const CHAT_COMPONENT_NORMALIZATION_SURFACE = [
  'ChannelTabsSurfaceBuilder',
  'ComposerSurfaceBuilder',
  'MessageFeedSurfaceBuilder',
  'PresenceTypingSurfaceBuilder',
  'StatusSurfaceBuilder',
  'TranscriptDrawerAdapter',
  'CollapsedPillAdapter',
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

export function listBuilderChatComponentModules(): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_BUILDER_MODULES;
}

export function listAdapterChatComponentModules(): readonly ChatComponentModuleKey[] {
  return CHAT_COMPONENT_ADAPTER_MODULES;
}

export function listChatComponentModulesByCategory(
  category: ChatComponentCategory,
): readonly ChatComponentModuleKey[] {
  return listModuleKeysByFilter((definition) => definition.category === category);
}

export function listChatComponentModulesByStability(
  stability: ChatComponentStability,
): readonly ChatComponentModuleKey[] {
  return listModuleKeysByFilter((definition) => definition.stability === stability);
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

export function moduleProvidesDefaultExport(
  key: ChatComponentModuleKey,
): boolean {
  return CHAT_COMPONENT_PACKAGES[key].defaultExportPresent;
}

export function getModulesForMount(
  mountTarget: SharedChat.ChatMountTarget,
): readonly ChatComponentModuleKey[] {
  return listModuleKeysByFilter((definition) =>
    definition.usedByMounts.includes(mountTarget),
  );
}

export function getPrimaryModulesForMount(
  mountTarget: SharedChat.ChatMountTarget,
): readonly ChatComponentModuleKey[] {
  return getModulesForMount(mountTarget).filter(moduleIsPrimary);
}

export function getCompatibilityModulesForMount(
  mountTarget: SharedChat.ChatMountTarget,
): readonly ChatComponentModuleKey[] {
  return getModulesForMount(mountTarget).filter(moduleIsCompatibilityOnly);
}

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
  CHAT_COMPONENT_MODULE_SPEC.map<ChatComponentManifestEntry>((definition) => ({
    key: definition.key,
    fileName: definition.fileName,
    importPath: definition.importPath,
    category: definition.category,
    stability: definition.stability,
    longTermAuthority: definition.longTermAuthority,
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
  'Shell normalization builders and adapters stay in the component lane because they shape presentation contracts, not engine truth.',
  'Mount registration must use shared contract mount constants, never ad-hoc strings.',
  'Helper prompt convenience aliases in this barrel must defer to uiTypes builders.',
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
  shellNormalizationBuildersPresent: true,
  transcriptDrawerAdapterPresent: true,
  collapsedPillAdapterPresent: true,
  chatTypesIsCompatibilityShim: true,
  useChatEngineIsCompatibilityBridge: true,
  ChatPanelIsCompatibilityBridge: true,
  helperPromptAliasSurfacePresent: true,
  mountRegistryNormalizedToSharedContracts: true,
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
    builders: CHAT_COMPONENT_BUILDER_MODULES,
    adapters: CHAT_COMPONENT_ADAPTER_MODULES,
    normalization: CHAT_COMPONENT_NORMALIZATION_SURFACE,
    feed: CHAT_COMPONENT_FEED_SURFACE,
    interaction: CHAT_COMPONENT_INTERACTION_SURFACE,
    status: CHAT_COMPONENT_STATUS_SURFACE,
    collapsed: CHAT_COMPONENT_COLLAPSED_SURFACE,
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
    listBuilderChatComponentModules,
    listAdapterChatComponentModules,
    listChatComponentModulesByCategory,
    listChatComponentModulesByStability,
    moduleIsPrimary,
    moduleIsCompatibilityOnly,
    moduleOwnsLongTermAuthority,
    moduleProvidesDefaultExport,
    getModulesForMount,
    getPrimaryModulesForMount,
    getCompatibilityModulesForMount,
    buildHelperPromptActionViewModel,
    buildHelperPromptBadgeViewModel,
    buildHelperPromptChannelViewModel,
    buildHelperPromptCopyViewModel,
    buildHelperPromptEvidenceViewModel,
    buildHelperPromptMetricViewModel,
    buildHelperPromptPresentationViewModel,
    buildHelperPromptStateViewModel,
    buildChannelTabsSurfaceModel,
    buildComposerSurfaceModel,
    buildMessageCardSurfaceModel,
    buildMessageFeedShellSurfaceModel,
    buildPresenceSurfaceModel,
    buildTypingSurfaceModel,
    buildStatusThreatSurfaceModel,
    buildStatusInvasionSurfaceModel,
    buildStatusRoomHeaderSurfaceModel,
    buildStatusEmptySurfaceModel,
    buildTranscriptDrawerShellSurfaceModel,
    createTranscriptDrawerShellCallbacks,
    buildCollapsedPillShellSurfaceModel,
  }),
});
