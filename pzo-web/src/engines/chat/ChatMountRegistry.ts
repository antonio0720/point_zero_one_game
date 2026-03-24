/**
 * ============================================================================
 * POINT ZERO ONE — UNIFIED CHAT ENGINE MOUNT REGISTRY
 * FILE: pzo-web/src/engines/chat/ChatMountRegistry.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical mount policy for the frontend chat engine.
 *
 * This file owns exactly one responsibility:
 * decide where the unified chat dock, banners, and auxiliary mirrors are
 * allowed to appear across the current PZO frontend surface map.
 *
 * It does NOT own:
 * - transcript state
 * - socket state
 * - event translation
 * - NPC logic
 * - moderation
 * - learning
 *
 * Why this file exists
 * --------------------
 * The repo already has multiple concrete mount surfaces that should be able to
 * host one unified chat experience instead of carrying custom per-screen chat
 * brains. The registry creates a single authoritative answer to:
 *
 * - which screens may host the primary dock
 * - which overlays receive auxiliary chat banners
 * - which channels are available by mode / surface
 * - whether the dock should default collapsed / expanded
 * - whether the composer, presence, threat, helper, and transcript affordances
 *   are enabled on a given mount
 *
 * Design rules
 * ------------
 * 1. One canonical registry, many mount presets.
 * 2. Primary chat ownership belongs to a single active mount at a time.
 * 3. Auxiliary surfaces may mirror alerts without becoming chat brains.
 * 4. Mode policy constrains channels more strongly than surface policy.
 * 5. Runtime registration is ephemeral; presets are canonical.
 * 6. This file remains self-contained so it can land before the rest of the
 *    new chat engine stack is fully extracted.
 */

import type { RunMode } from '../core/types';
import type { ChatMountTarget } from './types';

/**
 * Channels supported by the unified chat system.
 *
 * SPECTATOR is included here because battle / PvP surfaces need room for
 * future observer lanes even if the current thin UI shell has not yet exposed
 * them in the legacy chatTypes file.
 */
export type ChatChannel =
  | 'GLOBAL'
  | 'SYNDICATE'
  | 'DEAL_ROOM'
  | 'DM'
  | 'SPECTATOR';

/**
 * Surface ids intentionally mirror concrete PZO component / experience names.
 *
 * Primary targets are the major live play screens.
 * Auxiliary targets are nearby experiential surfaces that should receive chat
 * banners, legend cards, helper prompts, or threat escalations without owning
 * the dock itself.
 */
export type ChatMountSurfaceId =
  | 'LOBBY_SCREEN'
  | 'EMPIRE_GAME_SCREEN'
  | 'PREDATOR_GAME_SCREEN'
  | 'SYNDICATE_GAME_SCREEN'
  | 'PHANTOM_GAME_SCREEN'
  | 'BATTLE_HUD'
  | 'GAME_BOARD'
  | 'CLUB_UI'
  | 'LEAGUE_UI'
  | 'POST_RUN_SUMMARY'
  | 'COUNTERPLAY_MODAL'
  | 'EMPIRE_BLEED_BANNER'
  | 'MOMENT_FLASH'
  | 'PROOF_CARD'
  | 'PROOF_CARD_V2'
  | 'RESCUE_WINDOW_BANNER'
  | 'SABOTAGE_IMPACT_PANEL'
  | 'THREAT_RADAR_PANEL';

export type ChatSurfaceKind =
  | 'SCREEN'
  | 'HUD'
  | 'PANEL'
  | 'MODAL'
  | 'BANNER'
  | 'CARD'
  | 'FLASH';

export type ChatMountIntent =
  | 'PRIMARY_DOCK'
  | 'SECONDARY_DOCK'
  | 'HUD_STRIP'
  | 'ALERT_BANNER'
  | 'DRAWER_MIRROR'
  | 'REPLAY_CARD';

export type ChatDockAnchor =
  | 'TOP_LEFT'
  | 'TOP_CENTER'
  | 'TOP_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'BOTTOM_RIGHT'
  | 'INLINE'
  | 'FLOATING';

export type ChatVisibilityPolicy =
  | 'ALWAYS'
  | 'WHEN_FOCUSED'
  | 'WHEN_EXPANDED'
  | 'WHEN_CRITICAL'
  | 'HIDDEN_UNTIL_SIGNAL';

export interface ChatMountDimensions {
  minWidthPx: number;
  maxWidthPx: number;
  minHeightPx: number;
  maxHeightPx: number;
}

export interface ChatMountFeatureFlags {
  allowComposer: boolean;
  allowTranscriptDrawer: boolean;
  allowThreatMeter: boolean;
  allowInvasionBanner: boolean;
  allowPresenceStrip: boolean;
  allowTypingIndicator: boolean;
  allowHelperPrompt: boolean;
  allowNotificationPill: boolean;
  allowCollapsedPill: boolean;
  allowQuickReactions: boolean;
  allowLegendCards: boolean;
  allowTelemetryBadges: boolean;
}

export interface ChatMountPreset {
  /** Unique preset id — defaults to the surface id when omitted. */
  id: string;
  surfaceId: ChatMountSurfaceId;
  surfaceKind: ChatSurfaceKind;
  intent: ChatMountIntent;
  /** Lower numbers lose to higher priority when multiple surfaces compete. */
  priority: number;
  /** Allowed modes for this surface. Empty means all modes. */
  modes: RunMode[];
  /** Default anchor for the rendered shell. */
  anchor: ChatDockAnchor;
  /** Mode-agnostic channels allowed by this surface. */
  allowedChannels: ChatChannel[];
  /** Collapsed by default? */
  collapsedByDefault: boolean;
  /** Hidden until a significant signal fires? */
  visibilityPolicy: ChatVisibilityPolicy;
  /** Whether the mount can own the primary chat focus. */
  canOwnPrimaryFocus: boolean;
  /** Whether the surface should mirror critical alerts even while not primary. */
  mirrorsCriticalAlerts: boolean;
  /** Whether the preset may exist alongside another primary host. */
  supportsConcurrentMirrors: boolean;
  /** Baseline dimensions used by the render shell. */
  dimensions: ChatMountDimensions;
  /** Z-index hint for the component shell. */
  zIndex: number;
  /** Route / scene labels for upstream routers. */
  sceneTags: string[];
  /** Feature set allowed on the surface. */
  features: ChatMountFeatureFlags;
}

export interface ChatMountRuntimeRegistration {
  surfaceId: ChatMountSurfaceId;
  mode: RunMode;
  widthPx?: number;
  heightPx?: number;
  isVisible?: boolean;
  isFocused?: boolean;
  collapsed?: boolean;
  containerId?: string;
  sceneTag?: string;
}

export interface ChatMountRuntimeState extends ChatMountRuntimeRegistration {
  registrationId: string;
  mountedAtMs: number;
  updatedAtMs: number;
}

export interface ChatMountResolutionInput {
  mode: RunMode;
  preferredSurfaceId?: ChatMountSurfaceId | null;
  activeSceneTag?: string | null;
  criticalOnly?: boolean;
  requirePrimaryFocusOwner?: boolean;
}

export interface ChatMountResolution {
  preset: ChatMountPreset;
  runtime: ChatMountRuntimeState | null;
  allowedChannels: ChatChannel[];
  collapsed: boolean;
  ownsPrimaryFocus: boolean;
}

export interface ChatRenderPlan {
  mountId: string;
  surfaceId: ChatMountSurfaceId;
  anchor: ChatDockAnchor;
  zIndex: number;
  widthPx: number;
  heightPx: number;
  collapsed: boolean;
  allowedChannels: ChatChannel[];
  sceneTags: string[];
  visibilityPolicy: ChatVisibilityPolicy;
  features: ChatMountFeatureFlags;
  ownsPrimaryFocus: boolean;
  mirrorsCriticalAlerts: boolean;
}

export interface ChatRuntimeSnapshot {
  activePrimarySurfaceId: ChatMountSurfaceId | null;
  registrations: ChatMountRuntimeState[];
}

export type ChatMountRegistryListener = (snapshot: ChatRuntimeSnapshot) => void;

const ALL_MODES: readonly RunMode[] = Object.freeze([
  'solo',
  'asymmetric-pvp',
  'co-op',
  'ghost',
]);

const DEFAULT_CHANNELS_BY_MODE: Readonly<Record<RunMode, readonly ChatChannel[]>> =
  Object.freeze({
    solo: ['GLOBAL', 'DEAL_ROOM', 'DM'],
    'asymmetric-pvp': ['GLOBAL', 'DEAL_ROOM', 'DM', 'SPECTATOR'],
    'co-op': ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DM'],
    ghost: ['GLOBAL', 'DEAL_ROOM', 'DM'],
  });

const DEFAULT_FEATURES: Readonly<ChatMountFeatureFlags> = Object.freeze({
  allowComposer: true,
  allowTranscriptDrawer: true,
  allowThreatMeter: true,
  allowInvasionBanner: true,
  allowPresenceStrip: true,
  allowTypingIndicator: true,
  allowHelperPrompt: true,
  allowNotificationPill: true,
  allowCollapsedPill: true,
  allowQuickReactions: true,
  allowLegendCards: true,
  allowTelemetryBadges: true,
});

const HUD_FEATURES: Readonly<ChatMountFeatureFlags> = Object.freeze({
  ...DEFAULT_FEATURES,
  allowTranscriptDrawer: false,
  allowComposer: false,
  allowPresenceStrip: false,
  allowTypingIndicator: false,
  allowQuickReactions: false,
});

const BANNER_FEATURES: Readonly<ChatMountFeatureFlags> = Object.freeze({
  ...DEFAULT_FEATURES,
  allowComposer: false,
  allowTranscriptDrawer: false,
  allowPresenceStrip: false,
  allowTypingIndicator: false,
  allowQuickReactions: false,
  allowCollapsedPill: false,
  allowLegendCards: false,
});

const CARD_FEATURES: Readonly<ChatMountFeatureFlags> = Object.freeze({
  ...DEFAULT_FEATURES,
  allowComposer: false,
  allowPresenceStrip: false,
  allowTypingIndicator: false,
  allowQuickReactions: false,
  allowHelperPrompt: false,
});

function cloneFeatureFlags(flags: ChatMountFeatureFlags): ChatMountFeatureFlags {
  return { ...flags };
}

function normalizeChannels(channels: readonly ChatChannel[]): ChatChannel[] {
  return [...new Set(channels)].sort();
}

function normalizeModes(modes: readonly RunMode[]): RunMode[] {
  if (modes.length === 0) {
    return [...ALL_MODES];
  }

  return [...new Set(modes)].sort();
}

function intersectChannels(
  left: readonly ChatChannel[],
  right: readonly ChatChannel[],
): ChatChannel[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function deepFreezePreset(input: ChatMountPreset): ChatMountPreset {
  const normalized: ChatMountPreset = {
    ...input,
    allowedChannels: normalizeChannels(input.allowedChannels),
    modes: normalizeModes(input.modes),
    sceneTags: [...new Set(input.sceneTags)],
    dimensions: { ...input.dimensions },
    features: cloneFeatureFlags(input.features),
  };

  Object.freeze(normalized.allowedChannels);
  Object.freeze(normalized.modes);
  Object.freeze(normalized.sceneTags);
  Object.freeze(normalized.dimensions);
  Object.freeze(normalized.features);
  return Object.freeze(normalized);
}

function createPreset(input: Omit<ChatMountPreset, 'id'> & { id?: string }): ChatMountPreset {
  return deepFreezePreset({
    ...input,
    id: input.id ?? input.surfaceId,
  });
}

const DEFAULT_PRESETS: readonly ChatMountPreset[] = Object.freeze([
  createPreset({
    surfaceId: 'LOBBY_SCREEN',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 80,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'DM'],
    collapsedByDefault: false,
    visibilityPolicy: 'ALWAYS',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 340, maxWidthPx: 460, minHeightPx: 360, maxHeightPx: 680 },
    zIndex: 50,
    sceneTags: ['lobby', 'pre-run', 'matchmaking'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'EMPIRE_GAME_SCREEN',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 100,
    modes: ['solo'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'DM'],
    collapsedByDefault: true,
    visibilityPolicy: 'WHEN_EXPANDED',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 340, maxWidthPx: 500, minHeightPx: 320, maxHeightPx: 660 },
    zIndex: 70,
    sceneTags: ['run', 'empire', 'solo'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'PREDATOR_GAME_SCREEN',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 100,
    modes: ['asymmetric-pvp'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'DM', 'SPECTATOR'],
    collapsedByDefault: true,
    visibilityPolicy: 'WHEN_EXPANDED',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 360, maxWidthPx: 520, minHeightPx: 320, maxHeightPx: 680 },
    zIndex: 70,
    sceneTags: ['run', 'predator', 'pvp'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'SYNDICATE_GAME_SCREEN',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 100,
    modes: ['co-op'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM', 'DM'],
    collapsedByDefault: false,
    visibilityPolicy: 'ALWAYS',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 360, maxWidthPx: 520, minHeightPx: 320, maxHeightPx: 680 },
    zIndex: 70,
    sceneTags: ['run', 'syndicate', 'coop'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'PHANTOM_GAME_SCREEN',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 100,
    modes: ['ghost'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'DM'],
    collapsedByDefault: true,
    visibilityPolicy: 'WHEN_EXPANDED',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 340, maxWidthPx: 480, minHeightPx: 320, maxHeightPx: 640 },
    zIndex: 70,
    sceneTags: ['run', 'ghost', 'phantom'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'BATTLE_HUD',
    surfaceKind: 'HUD',
    intent: 'SECONDARY_DOCK',
    priority: 95,
    modes: ['asymmetric-pvp', 'co-op'],
    anchor: 'TOP_RIGHT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE', 'SPECTATOR'],
    collapsedByDefault: true,
    visibilityPolicy: 'WHEN_CRITICAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 280, maxWidthPx: 360, minHeightPx: 120, maxHeightPx: 280 },
    zIndex: 90,
    sceneTags: ['battle', 'hud', 'combat'],
    features: HUD_FEATURES,
  }),
  createPreset({
    surfaceId: 'GAME_BOARD',
    surfaceKind: 'PANEL',
    intent: 'SECONDARY_DOCK',
    priority: 60,
    modes: ['solo', 'ghost'],
    anchor: 'BOTTOM_LEFT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM'],
    collapsedByDefault: true,
    visibilityPolicy: 'HIDDEN_UNTIL_SIGNAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 260, maxWidthPx: 340, minHeightPx: 100, maxHeightPx: 240 },
    zIndex: 55,
    sceneTags: ['board', 'economy', 'run'],
    features: HUD_FEATURES,
  }),
  createPreset({
    surfaceId: 'CLUB_UI',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 75,
    modes: ['co-op', 'asymmetric-pvp'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'SYNDICATE', 'DM'],
    collapsedByDefault: false,
    visibilityPolicy: 'ALWAYS',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 340, maxWidthPx: 460, minHeightPx: 320, maxHeightPx: 620 },
    zIndex: 65,
    sceneTags: ['club', 'social'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'LEAGUE_UI',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 75,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'DM', 'SPECTATOR'],
    collapsedByDefault: false,
    visibilityPolicy: 'ALWAYS',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 340, maxWidthPx: 460, minHeightPx: 320, maxHeightPx: 620 },
    zIndex: 65,
    sceneTags: ['league', 'social', 'meta'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'POST_RUN_SUMMARY',
    surfaceKind: 'SCREEN',
    intent: 'PRIMARY_DOCK',
    priority: 74,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'BOTTOM_RIGHT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'DM'],
    collapsedByDefault: false,
    visibilityPolicy: 'ALWAYS',
    canOwnPrimaryFocus: true,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 340, maxWidthPx: 460, minHeightPx: 320, maxHeightPx: 620 },
    zIndex: 64,
    sceneTags: ['post-run', 'summary', 'results'],
    features: DEFAULT_FEATURES,
  }),
  createPreset({
    surfaceId: 'COUNTERPLAY_MODAL',
    surfaceKind: 'MODAL',
    intent: 'ALERT_BANNER',
    priority: 130,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'TOP_CENTER',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE'],
    collapsedByDefault: false,
    visibilityPolicy: 'WHEN_CRITICAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 320, maxWidthPx: 720, minHeightPx: 72, maxHeightPx: 180 },
    zIndex: 140,
    sceneTags: ['counterplay', 'modal', 'response-window'],
    features: BANNER_FEATURES,
  }),
  createPreset({
    surfaceId: 'EMPIRE_BLEED_BANNER',
    surfaceKind: 'BANNER',
    intent: 'ALERT_BANNER',
    priority: 120,
    modes: ['solo'],
    anchor: 'TOP_CENTER',
    allowedChannels: ['GLOBAL'],
    collapsedByDefault: false,
    visibilityPolicy: 'WHEN_CRITICAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 300, maxWidthPx: 700, minHeightPx: 56, maxHeightPx: 140 },
    zIndex: 130,
    sceneTags: ['bleed', 'empire', 'warning'],
    features: BANNER_FEATURES,
  }),
  createPreset({
    surfaceId: 'MOMENT_FLASH',
    surfaceKind: 'FLASH',
    intent: 'ALERT_BANNER',
    priority: 110,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'TOP_CENTER',
    allowedChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    collapsedByDefault: false,
    visibilityPolicy: 'WHEN_CRITICAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 280, maxWidthPx: 620, minHeightPx: 56, maxHeightPx: 120 },
    zIndex: 120,
    sceneTags: ['moment', 'flash', 'event'],
    features: BANNER_FEATURES,
  }),
  createPreset({
    surfaceId: 'PROOF_CARD',
    surfaceKind: 'CARD',
    intent: 'REPLAY_CARD',
    priority: 85,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'INLINE',
    allowedChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    collapsedByDefault: false,
    visibilityPolicy: 'HIDDEN_UNTIL_SIGNAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: false,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 260, maxWidthPx: 400, minHeightPx: 120, maxHeightPx: 240 },
    zIndex: 60,
    sceneTags: ['proof', 'artifact', 'legend'],
    features: CARD_FEATURES,
  }),
  createPreset({
    surfaceId: 'PROOF_CARD_V2',
    surfaceKind: 'CARD',
    intent: 'REPLAY_CARD',
    priority: 90,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'INLINE',
    allowedChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    collapsedByDefault: false,
    visibilityPolicy: 'HIDDEN_UNTIL_SIGNAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: false,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 280, maxWidthPx: 440, minHeightPx: 140, maxHeightPx: 280 },
    zIndex: 62,
    sceneTags: ['proof', 'artifact', 'legend', 'v2'],
    features: CARD_FEATURES,
  }),
  createPreset({
    surfaceId: 'RESCUE_WINDOW_BANNER',
    surfaceKind: 'BANNER',
    intent: 'ALERT_BANNER',
    priority: 150,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'TOP_CENTER',
    allowedChannels: ['GLOBAL', 'SYNDICATE', 'DEAL_ROOM'],
    collapsedByDefault: false,
    visibilityPolicy: 'WHEN_CRITICAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 300, maxWidthPx: 760, minHeightPx: 56, maxHeightPx: 140 },
    zIndex: 150,
    sceneTags: ['rescue', 'banner', 'critical'],
    features: BANNER_FEATURES,
  }),
  createPreset({
    surfaceId: 'SABOTAGE_IMPACT_PANEL',
    surfaceKind: 'PANEL',
    intent: 'HUD_STRIP',
    priority: 115,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'TOP_RIGHT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE'],
    collapsedByDefault: false,
    visibilityPolicy: 'WHEN_CRITICAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 260, maxWidthPx: 380, minHeightPx: 72, maxHeightPx: 200 },
    zIndex: 115,
    sceneTags: ['sabotage', 'threat', 'impact'],
    features: HUD_FEATURES,
  }),
  createPreset({
    surfaceId: 'THREAT_RADAR_PANEL',
    surfaceKind: 'PANEL',
    intent: 'HUD_STRIP',
    priority: 112,
    modes: ['solo', 'asymmetric-pvp', 'co-op', 'ghost'],
    anchor: 'TOP_LEFT',
    allowedChannels: ['GLOBAL', 'DEAL_ROOM', 'SYNDICATE', 'SPECTATOR'],
    collapsedByDefault: false,
    visibilityPolicy: 'WHEN_CRITICAL',
    canOwnPrimaryFocus: false,
    mirrorsCriticalAlerts: true,
    supportsConcurrentMirrors: true,
    dimensions: { minWidthPx: 260, maxWidthPx: 380, minHeightPx: 72, maxHeightPx: 200 },
    zIndex: 112,
    sceneTags: ['threat', 'radar', 'intel'],
    features: HUD_FEATURES,
  }),
]);

function now(): number {
  return Date.now();
}

function nextRegistrationId(sequence: number): string {
  return `chat_mount_${sequence}`;
}

/**
 * ChatMountRegistry
 * -----------------
 *
 * Presets are canonical and immutable.
 * Runtime registrations are ephemeral and reflect what is actually mounted.
 */
export class ChatMountRegistry {
  private readonly presetBySurfaceId = new Map<ChatMountSurfaceId, ChatMountPreset>();
  private readonly runtimeByRegistrationId = new Map<string, ChatMountRuntimeState>();
  private readonly listeners = new Set<ChatMountRegistryListener>();
  private registrationSequence = 0;
  private activePrimarySurfaceId: ChatMountSurfaceId | null = null;

  public constructor(seedPresets: readonly ChatMountPreset[] = DEFAULT_PRESETS) {
    for (const preset of seedPresets) {
      this.presetBySurfaceId.set(preset.surfaceId, preset);
    }
  }

  public subscribe(listener: ChatMountRegistryListener): () => void {
    this.listeners.add(listener);
    listener(this.getRuntimeSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public hasPreset(surfaceId: ChatMountSurfaceId): boolean {
    return this.presetBySurfaceId.has(surfaceId);
  }

  public getPreset(surfaceId: ChatMountSurfaceId): ChatMountPreset {
    const preset = this.presetBySurfaceId.get(surfaceId);
    if (!preset) {
      throw new Error(`[ChatMountRegistry] missing preset for surface ${surfaceId}`);
    }
    return preset;
  }

  public listPresets(): ChatMountPreset[] {
    return [...this.presetBySurfaceId.values()].sort((a, b) => b.priority - a.priority);
  }

  public listPresetsForMode(mode: RunMode): ChatMountPreset[] {
    return this.listPresets().filter((preset) => preset.modes.includes(mode));
  }

  public replacePreset(preset: ChatMountPreset): void {
    this.presetBySurfaceId.set(preset.surfaceId, deepFreezePreset(preset));
    this.emit();
  }

  public removePreset(surfaceId: ChatMountSurfaceId): void {
    this.presetBySurfaceId.delete(surfaceId);

    for (const [registrationId, runtime] of this.runtimeByRegistrationId.entries()) {
      if (runtime.surfaceId === surfaceId) {
        this.runtimeByRegistrationId.delete(registrationId);
      }
    }

    if (this.activePrimarySurfaceId === surfaceId) {
      this.activePrimarySurfaceId = null;
    }

    this.emit();
  }

  public registerMount(input: ChatMountRuntimeRegistration): string {
    const preset = this.getPreset(input.surfaceId);
    if (!preset.modes.includes(input.mode)) {
      throw new Error(
        `[ChatMountRegistry] surface ${input.surfaceId} does not support mode ${input.mode}`,
      );
    }

    const registrationId = nextRegistrationId(++this.registrationSequence);
    const timestamp = now();
    const runtime: ChatMountRuntimeState = {
      registrationId,
      mountedAtMs: timestamp,
      updatedAtMs: timestamp,
      ...(input.widthPx !== undefined ? { widthPx: input.widthPx } : {}),
      ...(input.heightPx !== undefined ? { heightPx: input.heightPx } : {}),
      isVisible: input.isVisible ?? true,
      isFocused: input.isFocused ?? false,
      ...(input.collapsed !== undefined ? { collapsed: input.collapsed } : {}),
      ...(input.containerId !== undefined ? { containerId: input.containerId } : {}),
      ...(input.sceneTag !== undefined ? { sceneTag: input.sceneTag } : {}),
      surfaceId: input.surfaceId,
      mode: input.mode,
    };

    this.runtimeByRegistrationId.set(registrationId, runtime);

    if (preset.canOwnPrimaryFocus && runtime.isVisible) {
      this.promoteSurfaceIfHigherPriority(runtime.surfaceId);
    }

    this.emit();
    return registrationId;
  }

  public updateMount(
    registrationId: string,
    patch: Partial<Omit<ChatMountRuntimeState, 'registrationId' | 'mountedAtMs'>>,
  ): void {
    const current = this.runtimeByRegistrationId.get(registrationId);
    if (!current) {
      return;
    }

    const nextState: ChatMountRuntimeState = {
      ...current,
      ...patch,
      updatedAtMs: now(),
    };

    const preset = this.getPreset(nextState.surfaceId);
    if (!preset.modes.includes(nextState.mode)) {
      throw new Error(
        `[ChatMountRegistry] updated runtime mode ${nextState.mode} is invalid for ${nextState.surfaceId}`,
      );
    }

    this.runtimeByRegistrationId.set(registrationId, nextState);

    if (preset.canOwnPrimaryFocus && nextState.isVisible) {
      this.promoteSurfaceIfHigherPriority(nextState.surfaceId);
    }

    if (this.activePrimarySurfaceId === nextState.surfaceId && nextState.isVisible === false) {
      this.activePrimarySurfaceId = this.resolveFallbackPrimarySurface(nextState.mode);
    }

    this.emit();
  }

  public unregisterMount(registrationId: string): void {
    const runtime = this.runtimeByRegistrationId.get(registrationId);
    if (!runtime) {
      return;
    }

    this.runtimeByRegistrationId.delete(registrationId);

    if (this.activePrimarySurfaceId === runtime.surfaceId) {
      this.activePrimarySurfaceId = this.resolveFallbackPrimarySurface(runtime.mode);
    }

    this.emit();
  }

  public setActivePrimarySurface(surfaceId: ChatMountSurfaceId | null): void {
    if (surfaceId === null) {
      this.activePrimarySurfaceId = null;
      this.emit();
      return;
    }

    const preset = this.getPreset(surfaceId);
    if (!preset.canOwnPrimaryFocus) {
      throw new Error(
        `[ChatMountRegistry] surface ${surfaceId} cannot own primary chat focus`,
      );
    }

    this.activePrimarySurfaceId = surfaceId;
    this.emit();
  }

  public getActivePrimarySurfaceId(): ChatMountSurfaceId | null {
    return this.activePrimarySurfaceId;
  }

  public listRuntimeRegistrations(): ChatMountRuntimeState[] {
    return [...this.runtimeByRegistrationId.values()].sort(
      (a, b) => a.mountedAtMs - b.mountedAtMs,
    );
  }

  public listRuntimeRegistrationsForSurface(
    surfaceId: ChatMountSurfaceId,
  ): ChatMountRuntimeState[] {
    return this.listRuntimeRegistrations().filter(
      (runtime) => runtime.surfaceId === surfaceId,
    );
  }

  public listRuntimeRegistrationsForMode(mode: RunMode): ChatMountRuntimeState[] {
    return this.listRuntimeRegistrations().filter((runtime) => runtime.mode === mode);
  }

  public resolve(input: ChatMountResolutionInput): ChatMountResolution {
    const modePresets = this.listPresetsForMode(input.mode);
    const primaryPresets = modePresets.filter((preset) => preset.canOwnPrimaryFocus);

    const preferredSurfaceId = input.preferredSurfaceId ?? this.activePrimarySurfaceId;
    const preferredPreset = preferredSurfaceId
      ? modePresets.find((preset) => preset.surfaceId === preferredSurfaceId)
      : undefined;

    let chosenPreset: ChatMountPreset | undefined;

    if (preferredPreset) {
      chosenPreset = preferredPreset;
    } else if (input.activeSceneTag) {
      chosenPreset = primaryPresets.find((preset) =>
        preset.sceneTags.includes(input.activeSceneTag as string),
      );
    }

    if (!chosenPreset) {
      chosenPreset = primaryPresets[0] ?? modePresets[0];
    }

    if (!chosenPreset) {
      throw new Error(`[ChatMountRegistry] no chat mount preset available for mode ${input.mode}`);
    }

    const runtime = this.pickBestRuntimeForPreset(chosenPreset, input.mode, input.activeSceneTag);
    const allowedChannels = this.resolveAllowedChannels(chosenPreset, input.mode);
    const collapsed = runtime?.collapsed ?? chosenPreset.collapsedByDefault;
    const ownsPrimaryFocus = this.resolveOwnership(chosenPreset, runtime, input);

    return {
      preset: chosenPreset,
      runtime,
      allowedChannels,
      collapsed,
      ownsPrimaryFocus,
    };
  }

  public buildRenderPlan(input: ChatMountResolutionInput): ChatRenderPlan {
    const resolution = this.resolve(input);
    const runtimeWidth = resolution.runtime?.widthPx;
    const runtimeHeight = resolution.runtime?.heightPx;

    return {
      mountId: resolution.runtime?.registrationId ?? resolution.preset.id,
      surfaceId: resolution.preset.surfaceId,
      anchor: resolution.preset.anchor,
      zIndex: resolution.preset.zIndex,
      widthPx: this.clampDimension(
        runtimeWidth,
        resolution.preset.dimensions.minWidthPx,
        resolution.preset.dimensions.maxWidthPx,
      ),
      heightPx: this.clampDimension(
        runtimeHeight,
        resolution.preset.dimensions.minHeightPx,
        resolution.preset.dimensions.maxHeightPx,
      ),
      collapsed: resolution.collapsed,
      allowedChannels: resolution.allowedChannels,
      sceneTags: [...resolution.preset.sceneTags],
      visibilityPolicy: resolution.preset.visibilityPolicy,
      features: cloneFeatureFlags(resolution.preset.features),
      ownsPrimaryFocus: resolution.ownsPrimaryFocus,
      mirrorsCriticalAlerts: resolution.preset.mirrorsCriticalAlerts,
    };
  }

  public selectAuxiliarySurfaces(mode: RunMode, criticalOnly = false): ChatMountPreset[] {
    return this.listPresetsForMode(mode).filter((preset) => {
      if (preset.intent === 'PRIMARY_DOCK' || preset.intent === 'SECONDARY_DOCK') {
        return false;
      }

      if (criticalOnly && !preset.mirrorsCriticalAlerts) {
        return false;
      }

      return true;
    });
  }

  public getRuntimeSnapshot(): ChatRuntimeSnapshot {
    return {
      activePrimarySurfaceId: this.activePrimarySurfaceId,
      registrations: this.listRuntimeRegistrations(),
    };
  }

  private resolveOwnership(
    preset: ChatMountPreset,
    runtime: ChatMountRuntimeState | null,
    input: ChatMountResolutionInput,
  ): boolean {
    if (!preset.canOwnPrimaryFocus) {
      return false;
    }

    if (input.requirePrimaryFocusOwner && runtime && runtime.isVisible === false) {
      return false;
    }

    if (this.activePrimarySurfaceId) {
      return this.activePrimarySurfaceId === preset.surfaceId;
    }

    if (!runtime) {
      return true;
    }

    return runtime.isVisible !== false;
  }

  private resolveAllowedChannels(
    preset: ChatMountPreset,
    mode: RunMode,
  ): ChatChannel[] {
    return intersectChannels(preset.allowedChannels, DEFAULT_CHANNELS_BY_MODE[mode]);
  }

  private pickBestRuntimeForPreset(
    preset: ChatMountPreset,
    mode: RunMode,
    activeSceneTag?: string | null,
  ): ChatMountRuntimeState | null {
    const runtimes = this.listRuntimeRegistrations().filter((runtime) => {
      if (runtime.surfaceId !== preset.surfaceId) {
        return false;
      }

      if (runtime.mode !== mode) {
        return false;
      }

      if (activeSceneTag && runtime.sceneTag && runtime.sceneTag !== activeSceneTag) {
        return false;
      }

      return true;
    });

    if (runtimes.length === 0) {
      return null;
    }

    return runtimes.sort((a, b) => {
      const focusScore = Number(Boolean(b.isFocused)) - Number(Boolean(a.isFocused));
      if (focusScore !== 0) {
        return focusScore;
      }

      const visibleScore = Number(Boolean(b.isVisible)) - Number(Boolean(a.isVisible));
      if (visibleScore !== 0) {
        return visibleScore;
      }

      return b.updatedAtMs - a.updatedAtMs;
    })[0] ?? null;
  }

  private clampDimension(
    value: number | undefined,
    min: number,
    max: number,
  ): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return max;
    }
    return Math.max(min, Math.min(max, value));
  }

  private promoteSurfaceIfHigherPriority(surfaceId: ChatMountSurfaceId): void {
    const candidate = this.getPreset(surfaceId);
    if (!candidate.canOwnPrimaryFocus) {
      return;
    }

    if (!this.activePrimarySurfaceId) {
      this.activePrimarySurfaceId = surfaceId;
      return;
    }

    const current = this.getPreset(this.activePrimarySurfaceId);
    if (candidate.priority >= current.priority) {
      this.activePrimarySurfaceId = surfaceId;
    }
  }

  private resolveFallbackPrimarySurface(mode: RunMode): ChatMountSurfaceId | null {
    const visiblePrimaryRuntime = this.listRuntimeRegistrationsForMode(mode)
      .filter((runtime) => {
        const preset = this.getPreset(runtime.surfaceId);
        return preset.canOwnPrimaryFocus && runtime.isVisible !== false;
      })
      .sort((a, b) => {
        const ap = this.getPreset(a.surfaceId).priority;
        const bp = this.getPreset(b.surfaceId).priority;
        return bp - ap;
      })[0];

    if (visiblePrimaryRuntime) {
      return visiblePrimaryRuntime.surfaceId;
    }

    const preset = this.listPresetsForMode(mode).find((entry) => entry.canOwnPrimaryFocus);
    return preset?.surfaceId ?? null;
  }

  private emit(): void {
    const snapshot = this.getRuntimeSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export function chatMountTargetToSurfaceId(
  mountTarget: ChatMountTarget,
): ChatMountSurfaceId {
  switch (mountTarget) {
    case 'BATTLE_HUD':
      return 'BATTLE_HUD';
    case 'CLUB_UI':
      return 'CLUB_UI';
    case 'EMPIRE_GAME_SCREEN':
      return 'EMPIRE_GAME_SCREEN';
    case 'GAME_BOARD':
      return 'GAME_BOARD';
    case 'LEAGUE_UI':
      return 'LEAGUE_UI';
    case 'LOBBY_SCREEN':
      return 'LOBBY_SCREEN';
    case 'PHANTOM_GAME_SCREEN':
      return 'PHANTOM_GAME_SCREEN';
    case 'PREDATOR_GAME_SCREEN':
      return 'PREDATOR_GAME_SCREEN';
    case 'SYNDICATE_GAME_SCREEN':
      return 'SYNDICATE_GAME_SCREEN';
    case 'POST_RUN_SUMMARY':
      return 'POST_RUN_SUMMARY';
    default:
      return 'LOBBY_SCREEN';
  }
}

export function resolveChatRegistryMode(
  mode: RunMode | string,
): RunMode {
  switch (mode) {
    case 'solo':
    case 'asymmetric-pvp':
    case 'co-op':
    case 'ghost':
      return mode;
    case 'empire':
      return 'solo';
    case 'predator':
    case 'pvp':
      return 'asymmetric-pvp';
    case 'syndicate':
    case 'coop':
      return 'co-op';
    case 'phantom':
      return 'ghost';
    default:
      return 'solo';
  }
}

export function buildChatMountRuntimeRegistration(input: {
  mountTarget: ChatMountTarget;
  mode: RunMode | string;
  widthPx?: number;
  heightPx?: number;
  isVisible?: boolean;
  isFocused?: boolean;
  collapsed?: boolean;
  containerId?: string;
  sceneTag?: string;
}): ChatMountRuntimeRegistration {
  return {
    surfaceId: chatMountTargetToSurfaceId(input.mountTarget),
    mode: resolveChatRegistryMode(input.mode),
    ...(input.widthPx !== undefined ? { widthPx: input.widthPx } : {}),
    ...(input.heightPx !== undefined ? { heightPx: input.heightPx } : {}),
    ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
    ...(input.isFocused !== undefined ? { isFocused: input.isFocused } : {}),
    ...(input.collapsed !== undefined ? { collapsed: input.collapsed } : {}),
    ...(input.containerId !== undefined ? { containerId: input.containerId } : {}),
    ...(input.sceneTag !== undefined ? { sceneTag: input.sceneTag } : {}),
  };
}

/**
 * Canonical singleton for the frontend chat engine.
 *
 * Import this instead of creating ad hoc registries in components.
 */
export const chatMountRegistry = new ChatMountRegistry();

/**
 * Lightweight helper for callers that only need a render plan.
 */
export function resolveChatRenderPlan(
  input: ChatMountResolutionInput,
): ChatRenderPlan {
  return chatMountRegistry.buildRenderPlan(input);
}

/**
 * Returns the best primary surface for a mode even if nothing is mounted yet.
 */
export function getDefaultChatSurfaceForMode(
  mode: RunMode,
): ChatMountSurfaceId {
  return (
    chatMountRegistry.listPresetsForMode(mode).find((preset) => preset.canOwnPrimaryFocus)
      ?.surfaceId ?? 'LOBBY_SCREEN'
  );
}
