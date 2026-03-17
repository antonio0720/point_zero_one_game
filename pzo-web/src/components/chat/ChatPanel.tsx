/**
 * ============================================================================
 * POINT ZERO ONE — LEGACY CHAT PANEL (UNIFIED DOCK COMPATIBILITY WRAPPER)
 * FILE: pzo-web/src/components/chat/ChatPanel.tsx
 * ============================================================================
 *
 * Purpose
 * -------
 * Preserve the historical `ChatPanel` import path used across the current PZO
 * component estate, while relocating real UI ownership to UnifiedChatDock.
 *
 * This file is intentionally a compatibility wrapper. It is not the new chat
 * brain, and it is not a second panel implementation. It exists so current
 * mount surfaces can keep importing:
 *
 *   pzo-web/src/components/chat/ChatPanel.tsx
 *
 * while the canonical render shell becomes:
 *
 *   pzo-web/src/components/chat/UnifiedChatDock.tsx
 *
 * and the canonical frontend runtime remains:
 *
 *   pzo-web/src/engines/chat
 *
 * Architectural doctrine
 * ----------------------
 * - shared/contracts/chat            => canonical shared contract truth
 * - pzo-web/src/engines/chat         => frontend authority / responsiveness
 * - pzo-web/src/components/chat      => render shell + compatibility shims
 * - backend/src/game/engine/chat     => authoritative durable truth
 * - pzo-server/src/chat              => wire / room / fanout / gateway
 *
 * This file therefore does the following jobs only:
 * - preserve the old ChatPanel public prop shape
 * - infer mount targets / presets from current game context when not provided
 * - provide migration-safe defaults for the unified dock
 * - keep current screens from needing immediate import churn
 * - expose manifest / descriptor / helper metadata for tooling and audits
 *
 * This file explicitly does NOT:
 * - render a second competing chat UI implementation
 * - own transport or socket state
 * - own transcript truth
 * - own engine policy or learning logic
 * - import battle / pressure / zero engine contracts directly
 *
 * Compatibility note
 * ------------------
 * The current repo still contains legacy imports into ChatPanel from screens and
 * mounts. Replacing those imports everywhere right now would create needless
 * churn. This wrapper absorbs that compatibility burden while the rest of the
 * chat lane is consolidated.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

import React, {
  memo,
  useMemo,
  type CSSProperties,
  type ReactElement,
} from 'react';

import * as ChatEnginePublic from '../../engines/chat';
import {
  CHAT_TYPES_RUNTIME_BUNDLE,
  SharedChat,
  type ChatChannel,
  type ChatPanelProps as LegacyChatPanelProps,
  type GameChatContext,
  type SabotageEvent,
} from './chatTypes';
import * as UnifiedChatDockModule from './UnifiedChatDock';

export type { SabotageEvent };

// ============================================================================
// MARK: Stable dock component resolution
// ============================================================================

const UnifiedChatDockComponent = ((UnifiedChatDockModule as Record<string, unknown>)
  .default ??
  (UnifiedChatDockModule as Record<string, unknown>).UnifiedChatDock) as React.ComponentType<Record<string, unknown>>;

// ============================================================================
// MARK: Public compatibility surface
// ============================================================================

export const CHAT_PANEL_FILE_PATH =
  'pzo-web/src/components/chat/ChatPanel.tsx' as const;

export const CHAT_PANEL_VERSION = '2026.03.17' as const;

export const CHAT_PANEL_REVISION =
  'pzo.components.chat.ChatPanel.compat-wrapper.v2' as const;

export const CHAT_PANEL_MIGRATION_FLAGS = Object.freeze({
  isCompatibilityWrapper: true,
  preservesLegacyImportPath: true,
  preservesLegacyPropShape: true,
  ownsRuntimeLogic: false,
  rendersUnifiedDock: true,
  safeForCurrentMounts: true,
  requiresScreenImportChurnNow: false,
  preservesComponentLaneOnly: true,
});

export const CHAT_PANEL_RUNTIME_LAWS = Object.freeze([
  'ChatPanel is a wrapper over UnifiedChatDock, not a second authoritative panel.',
  'Legacy props remain stable so current screens do not need immediate import churn.',
  'Mount inference may happen here because current screens still pass minimal game context only.',
  'Runtime truth, sockets, moderation, replay, and persistent learning do not belong here.',
  'No direct battle, pressure, zero, or other engine-domain imports are permitted in this file.',
  'All structural chat law remains anchored on shared/contracts/chat and the frontend engine barrel.',
  'This file may absorb prop-shape drift, but it may not become a second chat brain.',
] as const);

export const CHAT_PANEL_RUNTIME_BUNDLE = Object.freeze({
  filePath: CHAT_PANEL_FILE_PATH,
  version: CHAT_PANEL_VERSION,
  revision: CHAT_PANEL_REVISION,
  migration: CHAT_PANEL_MIGRATION_FLAGS,
  laws: CHAT_PANEL_RUNTIME_LAWS,
  inheritedChatTypesBundle: CHAT_TYPES_RUNTIME_BUNDLE,
  engineSurface: ChatEnginePublic,
});

// ============================================================================
// MARK: Optional compatibility extensions
// ============================================================================

export interface ChatPanelCompatibilityOverrides {
  readonly mountTarget?: string;
  readonly mountPreset?: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly defaultTab?: ChatChannel;
  readonly startCollapsed?: boolean;
  readonly enableThreatMeter?: boolean;
  readonly enableTranscriptDrawer?: boolean;
  readonly enableHelperPrompt?: boolean;
  readonly enableRoomMeta?: boolean;
  readonly enableLawFooter?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export interface ChatPanelProps extends LegacyChatPanelProps {
  readonly mountTarget?: string;
  readonly mountPreset?: string;
  readonly title?: string;
  readonly subtitle?: string;
  readonly defaultTab?: ChatChannel;
  readonly startCollapsed?: boolean;
  readonly enableThreatMeter?: boolean;
  readonly enableTranscriptDrawer?: boolean;
  readonly enableHelperPrompt?: boolean;
  readonly enableRoomMeta?: boolean;
  readonly enableLawFooter?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
}

// ============================================================================
// MARK: Local compatibility descriptors
// ============================================================================

const DEFAULT_TITLES = Object.freeze({
  GLOBAL: 'PZO CHAT',
  SYNDICATE: 'SYNDICATE CHAT',
  DEAL_ROOM: 'DEAL ROOM',
});

const MODE_SCOPE_TO_MOUNT = Object.freeze<Record<string, string>>({
  LOBBY: 'LOBBY_SCREEN',
  GLOBAL: 'GAME_BOARD',
  CLUB: 'CLUB_UI',
  LEAGUE: 'LEAGUE_UI',
  EMPIRE: 'EMPIRE_GAME_SCREEN',
  PHANTOM: 'PHANTOM_GAME_SCREEN',
  PREDATOR: 'PREDATOR_GAME_SCREEN',
  SYNDICATE: 'SYNDICATE_GAME_SCREEN',
  DEAL_ROOM: 'COUNTERPLAY_MODAL',
  WAR_ROOM: 'COUNTERPLAY_MODAL',
  BATTLE: 'BATTLE_HUD',
});

const TARGET_TO_PRESET = Object.freeze<Record<string, string>>({
  BATTLE_HUD: 'BATTLE_HUD',
  CLUB_UI: 'CLUB_UI',
  EMPIRE_GAME_SCREEN: 'EMPIRE_GAME_SCREEN',
  GAME_BOARD: 'GAME_BOARD',
  LEAGUE_UI: 'LEAGUE_UI',
  LOBBY_SCREEN: 'LOBBY_SCREEN',
  PHANTOM_GAME_SCREEN: 'PHANTOM_GAME_SCREEN',
  PREDATOR_GAME_SCREEN: 'PREDATOR_GAME_SCREEN',
  SYNDICATE_GAME_SCREEN: 'SYNDICATE_GAME_SCREEN',
  COUNTERPLAY_MODAL: 'COUNTERPLAY_MODAL',
  EMPIRE_BLEED_BANNER: 'EMPIRE_BLEED_BANNER',
  MOMENT_FLASH: 'MOMENT_FLASH',
  PROOF_CARD: 'PROOF_CARD',
  PROOF_CARD_V2: 'PROOF_CARD_V2',
  RESCUE_WINDOW_BANNER: 'RESCUE_WINDOW_BANNER',
  SABOTAGE_IMPACT_PANEL: 'SABOTAGE_IMPACT_PANEL',
  THREAT_RADAR_PANEL: 'THREAT_RADAR_PANEL',
});

const MOUNT_TITLES = Object.freeze<Record<string, string>>({
  BATTLE_HUD: 'Battle Chat',
  CLUB_UI: 'Club Chat',
  EMPIRE_GAME_SCREEN: 'Empire Chat',
  GAME_BOARD: 'PZO CHAT',
  LEAGUE_UI: 'League Chat',
  LOBBY_SCREEN: 'Lobby Chat',
  PHANTOM_GAME_SCREEN: 'Phantom Chat',
  PREDATOR_GAME_SCREEN: 'Predator Chat',
  SYNDICATE_GAME_SCREEN: 'Syndicate Chat',
  COUNTERPLAY_MODAL: 'Deal Room',
  EMPIRE_BLEED_BANNER: 'Bleed Feed',
  MOMENT_FLASH: 'Moment Feed',
  PROOF_CARD: 'Proof Feed',
  PROOF_CARD_V2: 'Proof Feed',
  RESCUE_WINDOW_BANNER: 'Rescue Feed',
  SABOTAGE_IMPACT_PANEL: 'Sabotage Feed',
  THREAT_RADAR_PANEL: 'Threat Radar',
});

const PRESET_DEFAULT_TAB = Object.freeze<Record<string, ChatChannel>>({
  BATTLE_HUD: 'GLOBAL',
  CLUB_UI: 'GLOBAL',
  EMPIRE_GAME_SCREEN: 'SYNDICATE',
  GAME_BOARD: 'GLOBAL',
  LEAGUE_UI: 'GLOBAL',
  LOBBY_SCREEN: 'GLOBAL',
  PHANTOM_GAME_SCREEN: 'GLOBAL',
  PREDATOR_GAME_SCREEN: 'GLOBAL',
  SYNDICATE_GAME_SCREEN: 'SYNDICATE',
  COUNTERPLAY_MODAL: 'DEAL_ROOM',
  EMPIRE_BLEED_BANNER: 'GLOBAL',
  MOMENT_FLASH: 'GLOBAL',
  PROOF_CARD: 'GLOBAL',
  PROOF_CARD_V2: 'GLOBAL',
  RESCUE_WINDOW_BANNER: 'GLOBAL',
  SABOTAGE_IMPACT_PANEL: 'GLOBAL',
  THREAT_RADAR_PANEL: 'GLOBAL',
});

const PRESET_FEATURE_DEFAULTS = Object.freeze({
  threatMeterByPreset: Object.freeze<Record<string, boolean>>({
    BATTLE_HUD: true,
    CLUB_UI: false,
    EMPIRE_GAME_SCREEN: true,
    GAME_BOARD: true,
    LEAGUE_UI: false,
    LOBBY_SCREEN: false,
    PHANTOM_GAME_SCREEN: true,
    PREDATOR_GAME_SCREEN: true,
    SYNDICATE_GAME_SCREEN: true,
    COUNTERPLAY_MODAL: true,
    EMPIRE_BLEED_BANNER: true,
    MOMENT_FLASH: false,
    PROOF_CARD: false,
    PROOF_CARD_V2: false,
    RESCUE_WINDOW_BANNER: false,
    SABOTAGE_IMPACT_PANEL: true,
    THREAT_RADAR_PANEL: true,
  }),
  transcriptByPreset: Object.freeze<Record<string, boolean>>({
    BATTLE_HUD: true,
    CLUB_UI: true,
    EMPIRE_GAME_SCREEN: true,
    GAME_BOARD: true,
    LEAGUE_UI: true,
    LOBBY_SCREEN: true,
    PHANTOM_GAME_SCREEN: true,
    PREDATOR_GAME_SCREEN: true,
    SYNDICATE_GAME_SCREEN: true,
    COUNTERPLAY_MODAL: false,
    EMPIRE_BLEED_BANNER: false,
    MOMENT_FLASH: false,
    PROOF_CARD: true,
    PROOF_CARD_V2: true,
    RESCUE_WINDOW_BANNER: false,
    SABOTAGE_IMPACT_PANEL: true,
    THREAT_RADAR_PANEL: false,
  }),
  helperByPreset: Object.freeze<Record<string, boolean>>({
    BATTLE_HUD: true,
    CLUB_UI: true,
    EMPIRE_GAME_SCREEN: true,
    GAME_BOARD: true,
    LEAGUE_UI: true,
    LOBBY_SCREEN: true,
    PHANTOM_GAME_SCREEN: true,
    PREDATOR_GAME_SCREEN: true,
    SYNDICATE_GAME_SCREEN: true,
    COUNTERPLAY_MODAL: true,
    EMPIRE_BLEED_BANNER: true,
    MOMENT_FLASH: false,
    PROOF_CARD: false,
    PROOF_CARD_V2: false,
    RESCUE_WINDOW_BANNER: true,
    SABOTAGE_IMPACT_PANEL: true,
    THREAT_RADAR_PANEL: false,
  }),
  roomMetaByPreset: Object.freeze<Record<string, boolean>>({
    BATTLE_HUD: true,
    CLUB_UI: true,
    EMPIRE_GAME_SCREEN: true,
    GAME_BOARD: true,
    LEAGUE_UI: true,
    LOBBY_SCREEN: true,
    PHANTOM_GAME_SCREEN: true,
    PREDATOR_GAME_SCREEN: true,
    SYNDICATE_GAME_SCREEN: true,
    COUNTERPLAY_MODAL: true,
    EMPIRE_BLEED_BANNER: false,
    MOMENT_FLASH: false,
    PROOF_CARD: false,
    PROOF_CARD_V2: false,
    RESCUE_WINDOW_BANNER: false,
    SABOTAGE_IMPACT_PANEL: false,
    THREAT_RADAR_PANEL: false,
  }),
  lawFooterByPreset: Object.freeze<Record<string, boolean>>({
    BATTLE_HUD: false,
    CLUB_UI: false,
    EMPIRE_GAME_SCREEN: false,
    GAME_BOARD: false,
    LEAGUE_UI: false,
    LOBBY_SCREEN: false,
    PHANTOM_GAME_SCREEN: false,
    PREDATOR_GAME_SCREEN: false,
    SYNDICATE_GAME_SCREEN: false,
    COUNTERPLAY_MODAL: false,
    EMPIRE_BLEED_BANNER: false,
    MOMENT_FLASH: false,
    PROOF_CARD: false,
    PROOF_CARD_V2: false,
    RESCUE_WINDOW_BANNER: false,
    SABOTAGE_IMPACT_PANEL: false,
    THREAT_RADAR_PANEL: false,
  }),
});

// ============================================================================
// MARK: Engine barrel bridge helpers
// ============================================================================

function readNamedExport(
  namespace: Record<string, unknown>,
  key: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(namespace, key)
    ? namespace[key]
    : undefined;
}

const maybeResolveChatMountTarget = readNamedExport(
  ChatEnginePublic as unknown as Record<string, unknown>,
  'resolveChatMountTarget',
) as ((value: unknown) => string | undefined) | undefined;

const maybeResolveChatMountPreset = readNamedExport(
  ChatEnginePublic as unknown as Record<string, unknown>,
  'resolveChatMountPreset',
) as ((value: unknown) => string | undefined) | undefined;

const maybeEngineManifest = readNamedExport(
  ChatEnginePublic as unknown as Record<string, unknown>,
  'CHAT_ENGINE_PUBLIC_MANIFEST',
);

const maybeEngineRuntimeLaws = readNamedExport(
  ChatEnginePublic as unknown as Record<string, unknown>,
  'CHAT_ENGINE_RUNTIME_LAWS',
);

// ============================================================================
// MARK: Derivation helpers
// ============================================================================

function safeUpper(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function normalizeVisibleTab(
  value: string | null | undefined,
  fallback: ChatChannel,
): ChatChannel {
  const normalized = safeUpper(value);

  if (
    normalized === 'GLOBAL'
    || normalized === 'SYNDICATE'
    || normalized === 'DEAL_ROOM'
  ) {
    return normalized as ChatChannel;
  }

  if (normalized === 'DEALROOM') {
    return 'DEAL_ROOM';
  }

  return fallback;
}

function inferModeScopeKey(ctx: GameChatContext): string | undefined {
  return safeUpper(
    typeof ctx.modeScope === 'string'
      ? ctx.modeScope
      : ctx.run?.modeScope ?? ctx.run?.currentMode ?? ctx.regime,
  );
}

function inferTargetFromContext(ctx: GameChatContext): string {
  const explicitMountTarget =
    typeof ctx.mountTarget === 'string' && ctx.mountTarget.trim().length > 0
      ? safeUpper(ctx.mountTarget)
      : undefined;

  if (explicitMountTarget) {
    return explicitMountTarget;
  }

  const runMountTarget =
    typeof ctx.run?.mountTarget === 'string' && ctx.run.mountTarget.trim().length > 0
      ? safeUpper(ctx.run.mountTarget)
      : undefined;

  if (runMountTarget) {
    return runMountTarget;
  }

  const scopeKey = inferModeScopeKey(ctx);
  if (scopeKey && MODE_SCOPE_TO_MOUNT[scopeKey]) {
    return MODE_SCOPE_TO_MOUNT[scopeKey];
  }

  if (safeUpper(ctx.runOutcome) === 'SOVEREIGNTY') {
    return 'COUNTERPLAY_MODAL';
  }

  if ((ctx.haterHeat ?? 0) >= 0.78) {
    return 'BATTLE_HUD';
  }

  return 'GAME_BOARD';
}

function resolveMountTargetCompat(
  requestedTarget: string | undefined,
  ctx: GameChatContext,
): string {
  const preferred = requestedTarget?.trim()
    ? safeUpper(requestedTarget)
    : inferTargetFromContext(ctx);

  const resolvedFromEngine = maybeResolveChatMountTarget?.(preferred);
  if (typeof resolvedFromEngine === 'string' && resolvedFromEngine.trim()) {
    return resolvedFromEngine;
  }

  return TARGET_TO_PRESET[preferred] ? preferred : 'GAME_BOARD';
}

function resolveMountPresetCompat(
  requestedPreset: string | undefined,
  target: string,
): string {
  const preferred = requestedPreset?.trim()
    ? safeUpper(requestedPreset)
    : TARGET_TO_PRESET[target] ?? 'GAME_BOARD';

  const resolvedFromEngine = maybeResolveChatMountPreset?.(preferred);
  if (typeof resolvedFromEngine === 'string' && resolvedFromEngine.trim()) {
    return resolvedFromEngine;
  }

  return TARGET_TO_PRESET[preferred] ? preferred : TARGET_TO_PRESET[target] ?? 'GAME_BOARD';
}

function inferDefaultTab(
  ctx: GameChatContext,
  preset: string,
  requestedDefaultTab?: ChatChannel,
): ChatChannel {
  if (requestedDefaultTab) {
    return normalizeVisibleTab(requestedDefaultTab, PRESET_DEFAULT_TAB[preset] ?? 'GLOBAL');
  }

  if (ctx.activeChannel) {
    return normalizeVisibleTab(ctx.activeChannel, PRESET_DEFAULT_TAB[preset] ?? 'GLOBAL');
  }

  if (safeUpper(ctx.runOutcome) === 'SOVEREIGNTY') {
    return 'DEAL_ROOM';
  }

  if ((ctx.haterHeat ?? 0) >= 0.68) {
    return 'SYNDICATE';
  }

  return PRESET_DEFAULT_TAB[preset] ?? 'GLOBAL';
}

function inferTitle(
  ctx: GameChatContext,
  preset: string,
  defaultTab: ChatChannel,
  requestedTitle?: string,
): string {
  if (requestedTitle?.trim()) {
    return requestedTitle.trim();
  }

  if (preset === 'COUNTERPLAY_MODAL') {
    return 'Deal Room';
  }

  if (preset === 'BATTLE_HUD' && (ctx.haterHeat ?? 0) >= 0.7) {
    return 'Threat Channel';
  }

  return MOUNT_TITLES[preset] ?? DEFAULT_TITLES[defaultTab];
}

function inferSubtitle(
  ctx: GameChatContext,
  preset: string,
  defaultTab: ChatChannel,
  requestedSubtitle?: string,
): string {
  if (requestedSubtitle?.trim()) {
    return requestedSubtitle.trim();
  }

  const roomId = ctx.roomId ? `room ${ctx.roomId}` : undefined;
  const regime = ctx.regime ? `regime ${ctx.regime}` : undefined;
  const pressure = ctx.pressureTier ? `pressure ${ctx.pressureTier}` : undefined;
  const tick = typeof ctx.tick === 'number' ? `tick ${ctx.tick}` : undefined;
  const connection = ctx.connectionState ? `conn ${ctx.connectionState}` : undefined;
  const fragments = [roomId, regime, pressure, tick, connection].filter(Boolean);

  if (preset === 'COUNTERPLAY_MODAL') {
    return 'Negotiation lane with transcript integrity preserved.';
  }

  if (preset === 'BATTLE_HUD') {
    return fragments.length > 0
      ? fragments.join(' · ')
      : 'Combat-adjacent social pressure and helper rescue lane.';
  }

  if (defaultTab === 'SYNDICATE') {
    return fragments.length > 0
      ? fragments.join(' · ')
      : 'Trust-weighted tactical lane.';
  }

  if (defaultTab === 'DEAL_ROOM') {
    return fragments.length > 0
      ? fragments.join(' · ')
      : 'Predatory negotiation lane.';
  }

  return fragments.length > 0
    ? fragments.join(' · ')
    : 'Unified chat shell mounted through the compatibility lane.';
}

function inferFeatureFlag(
  requested: boolean | undefined,
  defaults: Record<string, boolean>,
  preset: string,
): boolean {
  if (typeof requested === 'boolean') {
    return requested;
  }

  return defaults[preset] ?? false;
}

function inferCollapsedStart(
  requested: boolean | undefined,
  preset: string,
): boolean {
  if (typeof requested === 'boolean') {
    return requested;
  }

  return preset === 'MOMENT_FLASH' || preset === 'EMPIRE_BLEED_BANNER';
}

function normalizeClassName(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeStyle(style?: CSSProperties): CSSProperties | undefined {
  if (!style) return undefined;
  return { ...style };
}

// ============================================================================
// MARK: Public derived shape
// ============================================================================

export interface ChatPanelForwardedProps extends ChatPanelProps {
  readonly resolvedMountTarget: string;
  readonly resolvedMountPreset: string;
  readonly resolvedTitle: string;
  readonly resolvedSubtitle: string;
  readonly resolvedDefaultTab: ChatChannel;
  readonly resolvedStartCollapsed: boolean;
  readonly resolvedThreatMeter: boolean;
  readonly resolvedTranscriptDrawer: boolean;
  readonly resolvedHelperPrompt: boolean;
  readonly resolvedRoomMeta: boolean;
  readonly resolvedLawFooter: boolean;
  readonly normalizedClassName?: string;
  readonly normalizedStyle?: CSSProperties;
}

export function deriveChatPanelForwardProps(
  props: ChatPanelProps,
): ChatPanelForwardedProps {
  const ctx = props.gameCtx;
  const resolvedMountTarget = resolveMountTargetCompat(props.mountTarget, ctx);
  const resolvedMountPreset = resolveMountPresetCompat(
    props.mountPreset,
    resolvedMountTarget,
  );
  const resolvedDefaultTab = inferDefaultTab(
    ctx,
    resolvedMountPreset,
    props.defaultTab,
  );
  const resolvedTitle = inferTitle(
    ctx,
    resolvedMountPreset,
    resolvedDefaultTab,
    props.title,
  );
  const resolvedSubtitle = inferSubtitle(
    ctx,
    resolvedMountPreset,
    resolvedDefaultTab,
    props.subtitle,
  );

  return {
    ...props,
    resolvedMountTarget,
    resolvedMountPreset,
    resolvedTitle,
    resolvedSubtitle,
    resolvedDefaultTab,
    resolvedStartCollapsed: inferCollapsedStart(
      props.startCollapsed,
      resolvedMountPreset,
    ),
    resolvedThreatMeter: inferFeatureFlag(
      props.enableThreatMeter,
      PRESET_FEATURE_DEFAULTS.threatMeterByPreset,
      resolvedMountPreset,
    ),
    resolvedTranscriptDrawer: inferFeatureFlag(
      props.enableTranscriptDrawer,
      PRESET_FEATURE_DEFAULTS.transcriptByPreset,
      resolvedMountPreset,
    ),
    resolvedHelperPrompt: inferFeatureFlag(
      props.enableHelperPrompt,
      PRESET_FEATURE_DEFAULTS.helperByPreset,
      resolvedMountPreset,
    ),
    resolvedRoomMeta: inferFeatureFlag(
      props.enableRoomMeta,
      PRESET_FEATURE_DEFAULTS.roomMetaByPreset,
      resolvedMountPreset,
    ),
    resolvedLawFooter: inferFeatureFlag(
      props.enableLawFooter,
      PRESET_FEATURE_DEFAULTS.lawFooterByPreset,
      resolvedMountPreset,
    ),
    normalizedClassName: normalizeClassName(props.className),
    normalizedStyle: normalizeStyle(props.style),
  };
}

// ============================================================================
// MARK: Fallback shell
// ============================================================================

const FALLBACK_STYLE: CSSProperties = Object.freeze({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 16,
  borderRadius: 16,
  background: 'rgba(12,16,28,0.92)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#F5F7FF',
  fontFamily: 'Inter, system-ui, sans-serif',
  boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
  maxWidth: 420,
} as const);

function FallbackPanel({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): ReactElement {
  return (
    <div style={FALLBACK_STYLE}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
        {subtitle}
      </div>
      <div
        style={{
          color: 'rgba(255,255,255,0.60)',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        UnifiedChatDock is unavailable at runtime. The compatibility wrapper is
        still preserving the legacy ChatPanel import path.
      </div>
    </div>
  );
}

// ============================================================================
// MARK: Panel component
// ============================================================================

export const ChatPanel = memo(function ChatPanel(
  props: ChatPanelProps,
): ReactElement {
  const forwarded = useMemo(() => deriveChatPanelForwardProps(props), [props]);

  const dockProps = useMemo(
    () => ({
      gameCtx: forwarded.gameCtx,
      onSabotage: forwarded.onSabotage,
      accessToken: forwarded.accessToken,
      mountTarget: forwarded.resolvedMountTarget,
      mountPreset: forwarded.resolvedMountPreset,
      title: forwarded.resolvedTitle,
      subtitle: forwarded.resolvedSubtitle,
      defaultTab: forwarded.resolvedDefaultTab,
      startCollapsed: forwarded.resolvedStartCollapsed,
      enableThreatMeter: forwarded.resolvedThreatMeter,
      enableTranscriptDrawer: forwarded.resolvedTranscriptDrawer,
      enableHelperPrompt: forwarded.resolvedHelperPrompt,
      enableRoomMeta: forwarded.resolvedRoomMeta,
      enableLawFooter: forwarded.resolvedLawFooter,
      className: forwarded.normalizedClassName,
      style: forwarded.normalizedStyle,
    }),
    [forwarded],
  );

  if (!UnifiedChatDockComponent) {
    return (
      <FallbackPanel
        title={forwarded.resolvedTitle}
        subtitle={forwarded.resolvedSubtitle}
      />
    );
  }

  return <UnifiedChatDockComponent {...dockProps} />;
});

export default ChatPanel;

// ============================================================================
// MARK: Public manifests, descriptors, and tooling helpers
// ============================================================================

export const CHAT_PANEL_AUTHORITIES = Object.freeze({
  sharedContractsRoot:
    SharedChat.ChatChannels.CHAT_CHANNEL_CONTRACT?.authorities
      ?.sharedContractsRoot ?? '/shared/contracts/chat',
  frontendEngineRoot:
    SharedChat.ChatChannels.CHAT_CHANNEL_CONTRACT?.authorities
      ?.frontendEngineRoot ?? '/pzo-web/src/engines/chat',
  frontendUiRoot: '/pzo-web/src/components/chat',
  backendEngineRoot:
    SharedChat.ChatChannels.CHAT_CHANNEL_CONTRACT?.authorities
      ?.backendEngineRoot ?? '/backend/src/game/engine/chat',
  serverTransportRoot:
    SharedChat.ChatChannels.CHAT_CHANNEL_CONTRACT?.authorities
      ?.serverTransportRoot ?? '/pzo-server/src/chat',
});

export const CHAT_PANEL_COMPONENT_DESCRIPTOR = Object.freeze({
  name: 'ChatPanel',
  filePath: CHAT_PANEL_FILE_PATH,
  version: CHAT_PANEL_VERSION,
  revision: CHAT_PANEL_REVISION,
  migration: CHAT_PANEL_MIGRATION_FLAGS,
  authorities: CHAT_PANEL_AUTHORITIES,
  inheritedChatTypesBundle: CHAT_TYPES_RUNTIME_BUNDLE,
  engineManifest: maybeEngineManifest,
  engineRuntimeLaws: maybeEngineRuntimeLaws,
  wrapperTarget: 'UnifiedChatDock',
  wrapperKind: 'legacy-import-compatibility',
  preservesProps: [
    'gameCtx',
    'onSabotage',
    'accessToken',
  ] as const,
  optionalCompatibilityOverrides: [
    'mountTarget',
    'mountPreset',
    'title',
    'subtitle',
    'defaultTab',
    'startCollapsed',
    'enableThreatMeter',
    'enableTranscriptDrawer',
    'enableHelperPrompt',
    'enableRoomMeta',
    'enableLawFooter',
    'className',
    'style',
  ] as const,
});

export const CHAT_PANEL_PUBLIC_MANIFEST = Object.freeze({
  filePath: CHAT_PANEL_FILE_PATH,
  version: CHAT_PANEL_VERSION,
  revision: CHAT_PANEL_REVISION,
  migration: CHAT_PANEL_MIGRATION_FLAGS,
  laws: CHAT_PANEL_RUNTIME_LAWS,
  descriptor: CHAT_PANEL_COMPONENT_DESCRIPTOR,
  runtimeBundle: CHAT_PANEL_RUNTIME_BUNDLE,
  mountTitles: MOUNT_TITLES,
  presetDefaults: {
    tabs: PRESET_DEFAULT_TAB,
    features: PRESET_FEATURE_DEFAULTS,
  },
});

export function getChatPanelMountTitle(mountTarget: string): string {
  const normalized = safeUpper(mountTarget);
  return MOUNT_TITLES[normalized] ?? 'PZO CHAT';
}

export function getChatPanelMountPreset(target: string): string {
  const normalized = safeUpper(target);
  return TARGET_TO_PRESET[normalized] ?? 'GAME_BOARD';
}

export function getChatPanelFeatureDefaults(preset: string): {
  readonly threatMeter: boolean;
  readonly transcriptDrawer: boolean;
  readonly helperPrompt: boolean;
  readonly roomMeta: boolean;
  readonly lawFooter: boolean;
} {
  const normalized = safeUpper(preset);
  return {
    threatMeter:
      PRESET_FEATURE_DEFAULTS.threatMeterByPreset[normalized] ?? false,
    transcriptDrawer:
      PRESET_FEATURE_DEFAULTS.transcriptByPreset[normalized] ?? false,
    helperPrompt: PRESET_FEATURE_DEFAULTS.helperByPreset[normalized] ?? false,
    roomMeta: PRESET_FEATURE_DEFAULTS.roomMetaByPreset[normalized] ?? false,
    lawFooter: PRESET_FEATURE_DEFAULTS.lawFooterByPreset[normalized] ?? false,
  };
}
