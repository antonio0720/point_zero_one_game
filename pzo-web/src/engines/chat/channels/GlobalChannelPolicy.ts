/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT ENGINE
 * FILE: pzo-web/src/engines/chat/channels/GlobalChannelPolicy.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical frontend policy authority for the GLOBAL chat lane.
 *
 * This file is intentionally deep because GLOBAL is not a cosmetic tab in Point
 * Zero One. It is the public emotional theater of the run: the place where the
 * world notices pressure spikes, hater escalations, helper interventions,
 * sovereignty momentum, collapse risk, and the player's own authored persona.
 *
 * Repo-grounded doctrine preserved here
 * -------------------------------------
 * 1) The donor channel router in frontend/apps/web/components/chat makes GLOBAL
 *    available in every run mode and allows player messages, bot injection,
 *    NPC injection, system events, and helper tips there.
 * 2) The donor mode registry maps the four frontend run modes as:
 *    - solo -> Empire
 *    - asymmetric-pvp -> Predator
 *    - co-op -> Syndicate
 *    - ghost -> Phantom
 * 3) The existing component estate exposes major mount surfaces such as:
 *    BattleHUD, GameBoard, LobbyScreen, EmpireGameScreen, PredatorGameScreen,
 *    SyndicateGameScreen, PhantomGameScreen, ClubUI, and LeagueUI.
 *
 * This policy preserves those truths while upgrading GLOBAL from a simple
 * message bucket into a deterministic policy surface that can be consumed by:
 * - ChatChannelPolicy.ts
 * - ChatInvasionDirector.ts
 * - ChatNpcDirector.ts
 * - adapters/ModeAdapter.ts
 * - adapters/BattleEngineAdapter.ts
 * - adapters/RunStoreAdapter.ts
 * - adapters/MechanicsBridgeAdapter.ts
 *
 * Design goals
 * ------------
 * - Keep GLOBAL always available, but not always equally loud.
 * - Allow the channel to feel theatrical without becoming unreadable.
 * - Protect the lane from spam storms during battle / cascade / sabotage events.
 * - Preserve repo-specific mode identity and mount-surface identity.
 * - Make helper / hater / system / crowd visibility deterministic.
 * - Produce structured decisions that other engine files can consume directly.
 *
 * Important boundary
 * ------------------
 * This file is self-contained on purpose so it can stand on its own inside the
 * new canonical engine lane while the broader shared contract layer is still
 * being assembled. Once /shared/contracts/chat is fully live, the narrow type
 * aliases in this file can be replaced with shared imports without rewriting
 * the actual policy logic.
 */

// ============================================================================
// Core scalar aliases
// ============================================================================

export type GlobalRunMode = 'solo' | 'asymmetric-pvp' | 'co-op' | 'ghost';

export type GlobalModeFamily =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM';

export type GlobalChannelId = 'GLOBAL';

export type GlobalMountSurface =
  | 'BATTLE_HUD'
  | 'GAME_BOARD'
  | 'LOBBY_SCREEN'
  | 'EMPIRE_SCREEN'
  | 'PREDATOR_SCREEN'
  | 'SYNDICATE_SCREEN'
  | 'PHANTOM_SCREEN'
  | 'CLUB_UI'
  | 'LEAGUE_UI'
  | 'COUNTERPLAY_MODAL'
  | 'EMPIRE_BLEED_BANNER'
  | 'MOMENT_FLASH'
  | 'PROOF_CARD'
  | 'PROOF_CARD_V2'
  | 'RESCUE_WINDOW_BANNER'
  | 'SABOTAGE_IMPACT_PANEL'
  | 'THREAT_RADAR_PANEL'
  | 'UNKNOWN';

export type GlobalSpeakerClass =
  | 'PLAYER'
  | 'SYSTEM'
  | 'HATER'
  | 'HELPER'
  | 'NPC'
  | 'CROWD'
  | 'MODERATOR'
  | 'SPECTRAL_WITNESS';

export type GlobalMessageKind =
  | 'PLAYER'
  | 'PLAYER_RESPONSE'
  | 'SYSTEM'
  | 'MARKET_ALERT'
  | 'ACHIEVEMENT'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'DEAL_RECAP'
  | 'HELPER_TIP'
  | 'RUN_NOTICE'
  | 'RUN_OUTCOME'
  | 'INVASION'
  | 'COUNTER_INTEL'
  | 'REPUTATION_WITNESS'
  | 'MODE_WITNESS'
  | 'CROWD_SWELL'
  | 'PRESSURE_WITNESS';

export type GlobalPressureTier =
  | 'CALM'
  | 'BUILDING'
  | 'ELEVATED'
  | 'HIGH'
  | 'CRITICAL';

export type GlobalTickTier =
  | 'SOVEREIGN'
  | 'STABLE'
  | 'COMPRESSED'
  | 'CRISIS'
  | 'COLLAPSE_IMMINENT';

export type GlobalSeverity =
  | 'TRACE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'EXTREME';

export type GlobalAudienceHeatBand =
  | 'COLD'
  | 'WARM'
  | 'HOT'
  | 'FEVER'
  | 'PANIC';

export type GlobalInjectDecision = 'ALLOW' | 'DEFER' | 'SUPPRESS' | 'REROUTE';

export type GlobalVisibilityBand =
  | 'MUTED'
  | 'STANDARD'
  | 'FEATURED'
  | 'SPOTLIGHT'
  | 'LEGEND';

export type GlobalNotificationHint =
  | 'NONE'
  | 'BADGE'
  | 'INLINE'
  | 'BANNER'
  | 'SOUND'
  | 'BROWSER';

export type GlobalCrowdMood =
  | 'NEUTRAL'
  | 'CURIOUS'
  | 'AMPLIFYING'
  | 'MOCKING'
  | 'REVERENT'
  | 'PREDATORY'
  | 'PANICKED';

// ============================================================================
// Source-facing event contracts
// ============================================================================

export interface GlobalActorRef {
  id: string;
  displayName: string;
  speakerClass: GlobalSpeakerClass;
  isLocalPlayer?: boolean;
  teamId?: string | null;
  factionId?: string | null;
  botId?: string | null;
  helperId?: string | null;
  npcId?: string | null;
}

export interface GlobalMessageEnvelope {
  id: string;
  kind: GlobalMessageKind;
  channel: GlobalChannelId;
  body: string;
  ts: number;
  actor: GlobalActorRef;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  proofHash?: string | null;
  immutable?: boolean;
  runId?: string | null;
  seed?: string | number | null;
  metadata?: Record<string, unknown>;
}

export interface GlobalGameplayState {
  runId: string | null;
  runMode: GlobalRunMode;
  modeFamily: GlobalModeFamily;
  seed: string | number | null;
  tick: number;
  totalTicks?: number | null;
  roundNumber?: number | null;
  totalRounds?: number | null;
  cash?: number | null;
  netWorth?: number | null;
  income?: number | null;
  expenses?: number | null;
  haterHeat?: number | null;
  activeThreatCardCount?: number | null;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  localScore?: number | null;
  opponentScore?: number | null;
  freezeTicks?: number | null;
  regime?: string | null;
}

export interface GlobalSurfaceContext {
  activeSurface: GlobalMountSurface;
  visibleSurfaces: GlobalMountSurface[];
  chatDockOpen: boolean;
  chatFocused: boolean;
  tabActive: boolean;
  drawerOpen?: boolean;
  collapsed?: boolean;
}

export interface GlobalAudienceState {
  heat: number;
  heatBand: GlobalAudienceHeatBand;
  crowdMood: GlobalCrowdMood;
  spectators: number;
  swarmLikelihood: number;
  ridiculeLikelihood: number;
  reverenceLikelihood: number;
}

export interface GlobalRateState {
  now: number;
  trailing10sCount: number;
  trailing30sCount: number;
  trailing60sCount: number;
  trailing5mCount: number;
  sameActorTrailing30sCount: number;
  sameKindTrailing30sCount: number;
  sameBodyFingerprintTrailing60sCount: number;
  lastInjectAtByActor: Record<string, number>;
  lastInjectAtByKind: Record<string, number>;
}

export interface GlobalChannelHealth {
  degradedTransport: boolean;
  moderationLock: boolean;
  readOnlyWindow: boolean;
  replaySyncInProgress: boolean;
  localBackpressure: boolean;
}

export interface GlobalPolicyInput {
  message: GlobalMessageEnvelope;
  gameplay: GlobalGameplayState;
  surface: GlobalSurfaceContext;
  audience: GlobalAudienceState;
  rate: GlobalRateState;
  health: GlobalChannelHealth;
}

// ============================================================================
// Rich output contracts
// ============================================================================

export interface GlobalPolicyReason {
  code: string;
  detail: string;
  weight: number;
}

export interface GlobalInjectResult {
  decision: GlobalInjectDecision;
  visibility: GlobalVisibilityBand;
  notification: GlobalNotificationHint;
  shouldPersistInTranscript: boolean;
  shouldFeatureInFeed: boolean;
  shouldAnimateBanner: boolean;
  shouldEscalateAudienceHeat: boolean;
  shouldMirrorToInvasionDirector: boolean;
  shouldMirrorToNpcDirector: boolean;
  shouldMirrorToTelemetry: boolean;
  shouldRequestHelperFollowup: boolean;
  shouldRequestCrowdFollowup: boolean;
  shouldOpenCollapsedPill: boolean;
  score: number;
  reasons: GlobalPolicyReason[];
  deferForMs?: number;
  rerouteChannel?: string;
}

export interface GlobalComposerCapability {
  canCompose: boolean;
  canReplyToSystem: boolean;
  canPingCrowd: boolean;
  canCounterTaunt: boolean;
  canDropProofClaim: boolean;
  maxBodyLength: number;
  reasons: GlobalPolicyReason[];
}

export interface GlobalFeatureLayout {
  maxVisibleMessages: number;
  shouldShowPresenceStrip: boolean;
  shouldShowThreatMeter: boolean;
  shouldShowInvasionBanner: boolean;
  shouldShowHelperPrompt: boolean;
  shouldShowTranscriptDrawerShortcut: boolean;
  shouldShowProofSummary: boolean;
  shouldUseDenseFeed: boolean;
  shouldUseStackedCards: boolean;
}

export interface GlobalRecommendation {
  id: string;
  priority: number;
  title: string;
  detail: string;
  kind:
    | 'HELPER_WINDOW'
    | 'MUTE_CROWD'
    | 'ESCALATE_COUNTERPLAY'
    | 'OPEN_CHAT'
    | 'COLLAPSE_WITNESS'
    | 'COMEBACK_WITNESS'
    | 'PIN_SYSTEM_NOTICE'
    | 'RATE_LIMIT_ENFORCE'
    | 'DEFER_CROWD_REACTION';
}

export interface GlobalChannelSnapshot {
  channel: GlobalChannelId;
  runMode: GlobalRunMode;
  modeFamily: GlobalModeFamily;
  audienceHeatBand: GlobalAudienceHeatBand;
  crowdMood: GlobalCrowdMood;
  compose: GlobalComposerCapability;
  layout: GlobalFeatureLayout;
  recommendations: GlobalRecommendation[];
}

// ============================================================================
// Repo-grounded canonical constants
// ============================================================================

/**
 * The donor router marks GLOBAL as available in every current frontend run mode.
 */
export const GLOBAL_AVAILABLE_MODES: readonly GlobalRunMode[] = [
  'solo',
  'asymmetric-pvp',
  'co-op',
  'ghost',
] as const;

/**
 * The donor mode registry maps these four run modes to the public mode families.
 */
export const GLOBAL_MODE_FAMILY_MAP: Readonly<Record<GlobalRunMode, GlobalModeFamily>> = {
  solo: 'EMPIRE',
  'asymmetric-pvp': 'PREDATOR',
  'co-op': 'SYNDICATE',
  ghost: 'PHANTOM',
};

/**
 * Donor router truth:
 * GLOBAL allows player, bot, NPC, system, and helper traffic.
 */
export const GLOBAL_ALLOW_MATRIX = {
  allowPlayerMessages: true,
  allowBotInjection: true,
  allowNPCInjection: true,
  allowSystemEvents: true,
  allowHelperTips: true,
  isImmutable: false,
  requiresProofHash: false,
  maxVisibleMessages: 200,
} as const;

export const GLOBAL_SUPPORTED_MOUNT_SURFACES: readonly GlobalMountSurface[] = [
  'BATTLE_HUD',
  'GAME_BOARD',
  'LOBBY_SCREEN',
  'EMPIRE_SCREEN',
  'PREDATOR_SCREEN',
  'SYNDICATE_SCREEN',
  'PHANTOM_SCREEN',
  'CLUB_UI',
  'LEAGUE_UI',
  'COUNTERPLAY_MODAL',
  'EMPIRE_BLEED_BANNER',
  'MOMENT_FLASH',
  'PROOF_CARD',
  'PROOF_CARD_V2',
  'RESCUE_WINDOW_BANNER',
  'SABOTAGE_IMPACT_PANEL',
  'THREAT_RADAR_PANEL',
  'UNKNOWN',
] as const;

export const GLOBAL_PLAYER_MESSAGE_KINDS: readonly GlobalMessageKind[] = [
  'PLAYER',
  'PLAYER_RESPONSE',
] as const;

export const GLOBAL_SYSTEM_MESSAGE_KINDS: readonly GlobalMessageKind[] = [
  'SYSTEM',
  'MARKET_ALERT',
  'ACHIEVEMENT',
  'RUN_NOTICE',
  'RUN_OUTCOME',
  'COUNTER_INTEL',
  'MODE_WITNESS',
  'PRESSURE_WITNESS',
] as const;

export const GLOBAL_HATER_MESSAGE_KINDS: readonly GlobalMessageKind[] = [
  'BOT_TAUNT',
  'BOT_ATTACK',
  'INVASION',
] as const;

export const GLOBAL_SUPPORT_MESSAGE_KINDS: readonly GlobalMessageKind[] = [
  'HELPER_TIP',
  'REPUTATION_WITNESS',
  'CROWD_SWELL',
  'SHIELD_EVENT',
  'CASCADE_ALERT',
] as const;

// ============================================================================
// Surface profiles
// ============================================================================

export interface GlobalSurfaceProfile {
  id: GlobalMountSurface;
  label: string;
  density: 'SPARSE' | 'STANDARD' | 'DENSE';
  userAttention: number;
  acceptsSpotlight: boolean;
  shouldPreferBanner: boolean;
  shouldPreferFeed: boolean;
  shouldPreferCollapsedPill: boolean;
  shouldFeatureThreatMeter: boolean;
  shouldFeatureHelperPrompt: boolean;
  allowedVisibilityBands: readonly GlobalVisibilityBand[];
}

export const GLOBAL_SURFACE_PROFILES: Readonly<Record<GlobalMountSurface, GlobalSurfaceProfile>> = {
  BATTLE_HUD: {
    id: 'BATTLE_HUD',
    label: 'Battle HUD',
    density: 'SPARSE',
    userAttention: 0.95,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: false,
    shouldPreferCollapsedPill: true,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED', 'SPOTLIGHT', 'LEGEND'],
  },
  GAME_BOARD: {
    id: 'GAME_BOARD',
    label: 'Game Board',
    density: 'STANDARD',
    userAttention: 0.82,
    acceptsSpotlight: true,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  LOBBY_SCREEN: {
    id: 'LOBBY_SCREEN',
    label: 'Lobby Screen',
    density: 'DENSE',
    userAttention: 0.55,
    acceptsSpotlight: false,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED'],
  },
  EMPIRE_SCREEN: {
    id: 'EMPIRE_SCREEN',
    label: 'Empire Screen',
    density: 'STANDARD',
    userAttention: 0.7,
    acceptsSpotlight: true,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  PREDATOR_SCREEN: {
    id: 'PREDATOR_SCREEN',
    label: 'Predator Screen',
    density: 'STANDARD',
    userAttention: 0.86,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED', 'SPOTLIGHT', 'LEGEND'],
  },
  SYNDICATE_SCREEN: {
    id: 'SYNDICATE_SCREEN',
    label: 'Syndicate Screen',
    density: 'STANDARD',
    userAttention: 0.8,
    acceptsSpotlight: true,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  PHANTOM_SCREEN: {
    id: 'PHANTOM_SCREEN',
    label: 'Phantom Screen',
    density: 'STANDARD',
    userAttention: 0.76,
    acceptsSpotlight: true,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  CLUB_UI: {
    id: 'CLUB_UI',
    label: 'Club UI',
    density: 'DENSE',
    userAttention: 0.48,
    acceptsSpotlight: false,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED'],
  },
  LEAGUE_UI: {
    id: 'LEAGUE_UI',
    label: 'League UI',
    density: 'DENSE',
    userAttention: 0.45,
    acceptsSpotlight: false,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED'],
  },
  COUNTERPLAY_MODAL: {
    id: 'COUNTERPLAY_MODAL',
    label: 'Counterplay Modal',
    density: 'SPARSE',
    userAttention: 0.92,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: false,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['STANDARD', 'FEATURED', 'SPOTLIGHT', 'LEGEND'],
  },
  EMPIRE_BLEED_BANNER: {
    id: 'EMPIRE_BLEED_BANNER',
    label: 'Empire Bleed Banner',
    density: 'SPARSE',
    userAttention: 0.88,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: false,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  MOMENT_FLASH: {
    id: 'MOMENT_FLASH',
    label: 'Moment Flash',
    density: 'SPARSE',
    userAttention: 0.9,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: false,
    shouldPreferCollapsedPill: true,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['FEATURED', 'SPOTLIGHT', 'LEGEND'],
  },
  PROOF_CARD: {
    id: 'PROOF_CARD',
    label: 'Proof Card',
    density: 'SPARSE',
    userAttention: 0.74,
    acceptsSpotlight: false,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['STANDARD', 'FEATURED'],
  },
  PROOF_CARD_V2: {
    id: 'PROOF_CARD_V2',
    label: 'Proof Card V2',
    density: 'SPARSE',
    userAttention: 0.76,
    acceptsSpotlight: false,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['STANDARD', 'FEATURED'],
  },
  RESCUE_WINDOW_BANNER: {
    id: 'RESCUE_WINDOW_BANNER',
    label: 'Rescue Window Banner',
    density: 'SPARSE',
    userAttention: 0.91,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: false,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  SABOTAGE_IMPACT_PANEL: {
    id: 'SABOTAGE_IMPACT_PANEL',
    label: 'Sabotage Impact Panel',
    density: 'SPARSE',
    userAttention: 0.89,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: false,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: true,
    allowedVisibilityBands: ['STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  THREAT_RADAR_PANEL: {
    id: 'THREAT_RADAR_PANEL',
    label: 'Threat Radar Panel',
    density: 'SPARSE',
    userAttention: 0.87,
    acceptsSpotlight: true,
    shouldPreferBanner: true,
    shouldPreferFeed: false,
    shouldPreferCollapsedPill: true,
    shouldFeatureThreatMeter: true,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['STANDARD', 'FEATURED', 'SPOTLIGHT'],
  },
  UNKNOWN: {
    id: 'UNKNOWN',
    label: 'Unknown Surface',
    density: 'STANDARD',
    userAttention: 0.6,
    acceptsSpotlight: false,
    shouldPreferBanner: false,
    shouldPreferFeed: true,
    shouldPreferCollapsedPill: false,
    shouldFeatureThreatMeter: false,
    shouldFeatureHelperPrompt: false,
    allowedVisibilityBands: ['MUTED', 'STANDARD', 'FEATURED'],
  },
} as const;

// ============================================================================
// Mode profiles
// ============================================================================

export interface GlobalModeProfile {
  runMode: GlobalRunMode;
  modeFamily: GlobalModeFamily;
  label: string;
  publicTheaterBias: number;
  helperVisibilityBias: number;
  haterVisibilityBias: number;
  crowdAmplificationBias: number;
  collapseWitnessBias: number;
  comebackWitnessBias: number;
  allowSpectralWitness: boolean;
  shouldPreferSystemFraming: boolean;
}

export const GLOBAL_MODE_PROFILES: Readonly<Record<GlobalRunMode, GlobalModeProfile>> = {
  solo: {
    runMode: 'solo',
    modeFamily: 'EMPIRE',
    label: 'Empire Solo',
    publicTheaterBias: 0.72,
    helperVisibilityBias: 0.74,
    haterVisibilityBias: 0.69,
    crowdAmplificationBias: 0.62,
    collapseWitnessBias: 0.82,
    comebackWitnessBias: 0.78,
    allowSpectralWitness: false,
    shouldPreferSystemFraming: true,
  },
  'asymmetric-pvp': {
    runMode: 'asymmetric-pvp',
    modeFamily: 'PREDATOR',
    label: 'Predator Asymmetric PvP',
    publicTheaterBias: 0.91,
    helperVisibilityBias: 0.58,
    haterVisibilityBias: 0.92,
    crowdAmplificationBias: 0.93,
    collapseWitnessBias: 0.88,
    comebackWitnessBias: 0.9,
    allowSpectralWitness: false,
    shouldPreferSystemFraming: false,
  },
  'co-op': {
    runMode: 'co-op',
    modeFamily: 'SYNDICATE',
    label: 'Syndicate Co-op',
    publicTheaterBias: 0.66,
    helperVisibilityBias: 0.77,
    haterVisibilityBias: 0.63,
    crowdAmplificationBias: 0.52,
    collapseWitnessBias: 0.75,
    comebackWitnessBias: 0.8,
    allowSpectralWitness: false,
    shouldPreferSystemFraming: true,
  },
  ghost: {
    runMode: 'ghost',
    modeFamily: 'PHANTOM',
    label: 'Phantom Ghost',
    publicTheaterBias: 0.64,
    helperVisibilityBias: 0.43,
    haterVisibilityBias: 0.58,
    crowdAmplificationBias: 0.49,
    collapseWitnessBias: 0.68,
    comebackWitnessBias: 0.72,
    allowSpectralWitness: true,
    shouldPreferSystemFraming: false,
  },
} as const;

// ============================================================================
// Pressure and audience helpers
// ============================================================================

export function coercePressureTier(
  pressureTier: GlobalPressureTier | null | undefined,
  haterHeat: number | null | undefined,
  threatCount: number | null | undefined,
): GlobalPressureTier {
  if (pressureTier) return pressureTier;
  const heat = clamp01((haterHeat ?? 0) / 100);
  const threat = clamp01((threatCount ?? 0) / 6);
  const composite = (heat * 0.7) + (threat * 0.3);
  if (composite >= 0.85) return 'CRITICAL';
  if (composite >= 0.65) return 'HIGH';
  if (composite >= 0.4) return 'ELEVATED';
  if (composite >= 0.18) return 'BUILDING';
  return 'CALM';
}

export function deriveAudienceHeatBand(heat: number): GlobalAudienceHeatBand {
  if (heat >= 0.92) return 'PANIC';
  if (heat >= 0.78) return 'FEVER';
  if (heat >= 0.56) return 'HOT';
  if (heat >= 0.28) return 'WARM';
  return 'COLD';
}

export function deriveCrowdMood(args: {
  heatBand: GlobalAudienceHeatBand;
  modeFamily: GlobalModeFamily;
  pressureTier: GlobalPressureTier;
  localScore?: number | null;
  opponentScore?: number | null;
  isOutcomeMoment?: boolean;
  isCollapseMoment?: boolean;
  isComebackMoment?: boolean;
}): GlobalCrowdMood {
  const {
    heatBand,
    modeFamily,
    pressureTier,
    localScore,
    opponentScore,
    isOutcomeMoment,
    isCollapseMoment,
    isComebackMoment,
  } = args;

  if (isCollapseMoment) return pressureTier === 'CRITICAL' ? 'PANICKED' : 'MOCKING';
  if (isComebackMoment) return 'AMPLIFYING';
  if (isOutcomeMoment && pressureTier === 'CRITICAL') return 'REVERENT';

  const duelDelta = (localScore ?? 0) - (opponentScore ?? 0);

  if (modeFamily === 'PREDATOR') {
    if (heatBand === 'PANIC' || heatBand === 'FEVER') return 'PREDATORY';
    if (duelDelta < 0) return 'MOCKING';
    if (duelDelta > 0) return 'AMPLIFYING';
  }

  if (modeFamily === 'SYNDICATE') {
    if (heatBand === 'HOT' || heatBand === 'FEVER') return 'CURIOUS';
    return 'NEUTRAL';
  }

  if (modeFamily === 'PHANTOM') {
    if (pressureTier === 'CRITICAL') return 'CURIOUS';
    return 'NEUTRAL';
  }

  if (heatBand === 'PANIC') return 'PANICKED';
  if (heatBand === 'FEVER') return 'AMPLIFYING';
  if (pressureTier === 'HIGH' || pressureTier === 'CRITICAL') return 'CURIOUS';
  return 'NEUTRAL';
}

// ============================================================================
// Small utility layer
// ============================================================================

export function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function hashBody(body: string): string {
  let hash = 0;
  for (let i = 0; i < body.length; i += 1) {
    hash = ((hash << 5) - hash) + body.charCodeAt(i);
    hash |= 0;
  }
  return `g_${Math.abs(hash).toString(36)}`;
}

export function actorCooldownKey(actor: GlobalActorRef): string {
  return `${actor.speakerClass}:${actor.id}`;
}

export function nowOr(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function isPlayerKind(kind: GlobalMessageKind): boolean {
  return (GLOBAL_PLAYER_MESSAGE_KINDS as readonly string[]).includes(kind);
}

export function isSystemKind(kind: GlobalMessageKind): boolean {
  return (GLOBAL_SYSTEM_MESSAGE_KINDS as readonly string[]).includes(kind);
}

export function isHaterKind(kind: GlobalMessageKind): boolean {
  return (GLOBAL_HATER_MESSAGE_KINDS as readonly string[]).includes(kind);
}

export function isSupportKind(kind: GlobalMessageKind): boolean {
  return (GLOBAL_SUPPORT_MESSAGE_KINDS as readonly string[]).includes(kind);
}

export function surfaceProfile(surface: GlobalMountSurface): GlobalSurfaceProfile {
  return GLOBAL_SURFACE_PROFILES[surface] ?? GLOBAL_SURFACE_PROFILES.UNKNOWN;
}

export function modeProfile(mode: GlobalRunMode): GlobalModeProfile {
  return GLOBAL_MODE_PROFILES[mode];
}

// ============================================================================
// Scoring: intake base values
// ============================================================================

export function baseMessageWeight(message: GlobalMessageEnvelope): number {
  switch (message.kind) {
    case 'RUN_OUTCOME':
      return 0.98;
    case 'INVASION':
      return 0.95;
    case 'BOT_ATTACK':
      return 0.9;
    case 'CASCADE_ALERT':
      return 0.88;
    case 'SHIELD_EVENT':
      return 0.82;
    case 'MARKET_ALERT':
      return 0.78;
    case 'COUNTER_INTEL':
      return 0.74;
    case 'BOT_TAUNT':
      return 0.7;
    case 'HELPER_TIP':
      return 0.64;
    case 'PRESSURE_WITNESS':
      return 0.66;
    case 'MODE_WITNESS':
      return 0.58;
    case 'CROWD_SWELL':
      return 0.54;
    case 'REPUTATION_WITNESS':
      return 0.56;
    case 'ACHIEVEMENT':
      return 0.6;
    case 'SYSTEM':
      return 0.5;
    case 'RUN_NOTICE':
      return 0.52;
    case 'PLAYER_RESPONSE':
      return 0.48;
    case 'PLAYER':
      return 0.42;
    case 'DEAL_RECAP':
      return 0.28;
    default:
      return 0.45;
  }
}

export function pressureWeight(pressureTier: GlobalPressureTier): number {
  switch (pressureTier) {
    case 'CRITICAL':
      return 0.24;
    case 'HIGH':
      return 0.16;
    case 'ELEVATED':
      return 0.09;
    case 'BUILDING':
      return 0.04;
    case 'CALM':
    default:
      return 0;
  }
}

export function tickWeight(tickTier: GlobalTickTier | null | undefined): number {
  switch (tickTier) {
    case 'COLLAPSE_IMMINENT':
      return 0.18;
    case 'CRISIS':
      return 0.12;
    case 'COMPRESSED':
      return 0.06;
    case 'STABLE':
      return 0.02;
    case 'SOVEREIGN':
      return 0.04;
    default:
      return 0;
  }
}

export function actorWeight(actor: GlobalActorRef): number {
  switch (actor.speakerClass) {
    case 'SYSTEM':
      return 0.12;
    case 'HATER':
      return 0.14;
    case 'HELPER':
      return 0.1;
    case 'NPC':
      return 0.06;
    case 'CROWD':
      return 0.03;
    case 'MODERATOR':
      return 0.08;
    case 'SPECTRAL_WITNESS':
      return 0.07;
    case 'PLAYER':
    default:
      return actor.isLocalPlayer ? 0.05 : 0.04;
  }
}

export function crowdWeight(audience: GlobalAudienceState): number {
  return (
    (clamp01(audience.heat) * 0.12) +
    (clamp01(audience.swarmLikelihood) * 0.06) +
    (clamp01(audience.ridiculeLikelihood) * 0.04) +
    (clamp01(audience.reverenceLikelihood) * 0.04)
  );
}

export function modeWeight(modeProfileValue: GlobalModeProfile, message: GlobalMessageEnvelope): number {
  if (isHaterKind(message.kind)) return modeProfileValue.haterVisibilityBias * 0.08;
  if (message.kind === 'HELPER_TIP') return modeProfileValue.helperVisibilityBias * 0.06;
  if (message.kind === 'RUN_OUTCOME' || message.kind === 'CROWD_SWELL') {
    return modeProfileValue.publicTheaterBias * 0.07;
  }
  return modeProfileValue.publicTheaterBias * 0.04;
}

export function surfaceWeight(profile: GlobalSurfaceProfile, message: GlobalMessageEnvelope): number {
  let value = profile.userAttention * 0.05;
  if (profile.acceptsSpotlight && (message.kind === 'INVASION' || message.kind === 'RUN_OUTCOME')) {
    value += 0.05;
  }
  if (!profile.shouldPreferFeed && isSupportKind(message.kind)) {
    value -= 0.03;
  }
  return value;
}

// ============================================================================
// Rate and suppression policy
// ============================================================================

export interface GlobalRatePolicy {
  maxPer10s: number;
  maxPer30s: number;
  maxPer60s: number;
  sameActorCooldownMs: number;
  sameKindCooldownMs: number;
  duplicateBodyCooldownMs: number;
  localBackpressurePenalty: number;
}

export const DEFAULT_GLOBAL_RATE_POLICY: Readonly<GlobalRatePolicy> = {
  maxPer10s: 8,
  maxPer30s: 18,
  maxPer60s: 34,
  sameActorCooldownMs: 1100,
  sameKindCooldownMs: 700,
  duplicateBodyCooldownMs: 5000,
  localBackpressurePenalty: 0.16,
};

export function evaluateRatePenalty(
  input: GlobalPolicyInput,
  ratePolicy: GlobalRatePolicy = DEFAULT_GLOBAL_RATE_POLICY,
): { penalty: number; reasons: GlobalPolicyReason[] } {
  const reasons: GlobalPolicyReason[] = [];
  let penalty = 0;

  if (input.rate.trailing10sCount >= ratePolicy.maxPer10s) {
    penalty += 0.16;
    reasons.push({ code: 'RATE_10S', detail: '10-second channel budget saturated.', weight: 0.16 });
  }

  if (input.rate.trailing30sCount >= ratePolicy.maxPer30s) {
    penalty += 0.12;
    reasons.push({ code: 'RATE_30S', detail: '30-second channel budget saturated.', weight: 0.12 });
  }

  if (input.rate.trailing60sCount >= ratePolicy.maxPer60s) {
    penalty += 0.1;
    reasons.push({ code: 'RATE_60S', detail: '60-second channel budget saturated.', weight: 0.1 });
  }

  const actorKey = actorCooldownKey(input.message.actor);
  const lastActorAt = input.rate.lastInjectAtByActor[actorKey];
  if (typeof lastActorAt === 'number' && (input.rate.now - lastActorAt) < ratePolicy.sameActorCooldownMs) {
    penalty += 0.13;
    reasons.push({ code: 'ACTOR_COOLDOWN', detail: 'Actor cooldown still active.', weight: 0.13 });
  }

  const lastKindAt = input.rate.lastInjectAtByKind[input.message.kind];
  if (typeof lastKindAt === 'number' && (input.rate.now - lastKindAt) < ratePolicy.sameKindCooldownMs) {
    penalty += 0.08;
    reasons.push({ code: 'KIND_COOLDOWN', detail: 'Message kind cooldown still active.', weight: 0.08 });
  }

  if (input.rate.sameBodyFingerprintTrailing60sCount > 0) {
    penalty += 0.18;
    reasons.push({ code: 'DUP_BODY', detail: 'Duplicate body fingerprint seen inside cooldown window.', weight: 0.18 });
  }

  if (input.health.localBackpressure) {
    penalty += ratePolicy.localBackpressurePenalty;
    reasons.push({ code: 'LOCAL_BACKPRESSURE', detail: 'Local channel backpressure is active.', weight: ratePolicy.localBackpressurePenalty });
  }

  return { penalty, reasons };
}

// ============================================================================
// Composer policy
// ============================================================================

export function evaluateGlobalComposerCapability(
  gameplay: GlobalGameplayState,
  health: GlobalChannelHealth,
): GlobalComposerCapability {
  const reasons: GlobalPolicyReason[] = [];

  if (health.moderationLock) {
    reasons.push({ code: 'MOD_LOCK', detail: 'Moderation lock forces read-only behavior.', weight: 1 });
    return {
      canCompose: false,
      canReplyToSystem: false,
      canPingCrowd: false,
      canCounterTaunt: false,
      canDropProofClaim: false,
      maxBodyLength: 0,
      reasons,
    };
  }

  if (health.readOnlyWindow) {
    reasons.push({ code: 'READ_ONLY_WINDOW', detail: 'Temporary read-only channel window is active.', weight: 0.8 });
    return {
      canCompose: false,
      canReplyToSystem: false,
      canPingCrowd: false,
      canCounterTaunt: false,
      canDropProofClaim: false,
      maxBodyLength: 0,
      reasons,
    };
  }

  const pressure = coercePressureTier(gameplay.pressureTier, gameplay.haterHeat, gameplay.activeThreatCardCount);
  const maxBodyLength = pressure === 'CRITICAL' ? 220 : pressure === 'HIGH' ? 320 : 480;

  reasons.push({ code: 'GLOBAL_OPEN', detail: 'GLOBAL remains player-writable in all canonical run modes.', weight: 0.4 });

  return {
    canCompose: true,
    canReplyToSystem: true,
    canPingCrowd: gameplay.runMode !== 'ghost',
    canCounterTaunt: pressure !== 'CALM',
    canDropProofClaim: pressure === 'HIGH' || pressure === 'CRITICAL',
    maxBodyLength,
    reasons,
  };
}

// ============================================================================
// Layout policy
// ============================================================================

export function evaluateGlobalLayout(
  surface: GlobalSurfaceContext,
  gameplay: GlobalGameplayState,
  audience: GlobalAudienceState,
): GlobalFeatureLayout {
  const profile = surfaceProfile(surface.activeSurface);
  const pressure = coercePressureTier(gameplay.pressureTier, gameplay.haterHeat, gameplay.activeThreatCardCount);
  const hot = audience.heatBand === 'HOT' || audience.heatBand === 'FEVER' || audience.heatBand === 'PANIC';

  return {
    maxVisibleMessages: GLOBAL_ALLOW_MATRIX.maxVisibleMessages,
    shouldShowPresenceStrip: profile.density !== 'SPARSE',
    shouldShowThreatMeter: profile.shouldFeatureThreatMeter || pressure === 'HIGH' || pressure === 'CRITICAL',
    shouldShowInvasionBanner: profile.shouldPreferBanner && hot,
    shouldShowHelperPrompt: profile.shouldFeatureHelperPrompt && pressure !== 'CALM',
    shouldShowTranscriptDrawerShortcut: surface.chatDockOpen,
    shouldShowProofSummary: false,
    shouldUseDenseFeed: profile.density === 'DENSE',
    shouldUseStackedCards: profile.density === 'SPARSE',
  };
}

// ============================================================================
// Visibility mapping
// ============================================================================

export function visibilityFromScore(
  score: number,
  profile: GlobalSurfaceProfile,
): GlobalVisibilityBand {
  if (score >= 0.96 && profile.allowedVisibilityBands.includes('LEGEND')) return 'LEGEND';
  if (score >= 0.82 && profile.allowedVisibilityBands.includes('SPOTLIGHT')) return 'SPOTLIGHT';
  if (score >= 0.62 && profile.allowedVisibilityBands.includes('FEATURED')) return 'FEATURED';
  if (score >= 0.34 && profile.allowedVisibilityBands.includes('STANDARD')) return 'STANDARD';
  return 'MUTED';
}

export function notificationFromDecision(args: {
  result: GlobalInjectDecision;
  visibility: GlobalVisibilityBand;
  surface: GlobalSurfaceProfile;
  input: GlobalPolicyInput;
}): GlobalNotificationHint {
  const { result, visibility, surface, input } = args;
  if (result !== 'ALLOW') return 'NONE';
  if (!input.surface.tabActive) {
    if (visibility === 'LEGEND' || visibility === 'SPOTLIGHT') return 'BROWSER';
    if (visibility === 'FEATURED') return 'BADGE';
    return 'NONE';
  }
  if (!input.surface.chatDockOpen) {
    if (surface.shouldPreferCollapsedPill && (visibility === 'FEATURED' || visibility === 'SPOTLIGHT')) return 'BANNER';
    return visibility === 'STANDARD' ? 'BADGE' : 'INLINE';
  }
  if (visibility === 'LEGEND') return 'SOUND';
  if (visibility === 'SPOTLIGHT') return 'BANNER';
  if (visibility === 'FEATURED') return 'INLINE';
  return 'NONE';
}

// ============================================================================
// Recommendation engine
// ============================================================================

export function buildGlobalRecommendations(input: GlobalPolicyInput): GlobalRecommendation[] {
  const pressure = coercePressureTier(input.gameplay.pressureTier, input.gameplay.haterHeat, input.gameplay.activeThreatCardCount);
  const recommendations: GlobalRecommendation[] = [];

  if (!input.surface.chatDockOpen && pressure !== 'CALM') {
    recommendations.push({
      id: 'open_chat_pressure',
      priority: 92,
      title: 'Open GLOBAL feed',
      detail: 'Pressure is no longer calm. Let the player see public witness and counterplay cues.',
      kind: 'OPEN_CHAT',
    });
  }

  if (pressure === 'CRITICAL') {
    recommendations.push({
      id: 'collapse_witness',
      priority: 98,
      title: 'Force collapse witness',
      detail: 'Critical pressure demands at least one public witness event in GLOBAL.',
      kind: 'COLLAPSE_WITNESS',
    });
  }

  if (input.audience.heatBand === 'PANIC' || input.audience.heatBand === 'FEVER') {
    recommendations.push({
      id: 'defer_crowd',
      priority: 87,
      title: 'Defer low-value crowd noise',
      detail: 'Audience heat is high enough that weak crowd reactions should defer to preserve readability.',
      kind: 'DEFER_CROWD_REACTION',
    });
  }

  if (input.health.localBackpressure) {
    recommendations.push({
      id: 'rate_enforce',
      priority: 96,
      title: 'Enforce tighter rate budget',
      detail: 'Local backpressure is active. Enforce stricter suppression for duplicate and low-value GLOBAL chatter.',
      kind: 'RATE_LIMIT_ENFORCE',
    });
  }

  if (pressure === 'HIGH' || pressure === 'CRITICAL') {
    recommendations.push({
      id: 'helper_window',
      priority: 84,
      title: 'Prepare helper follow-up',
      detail: 'High pressure means helper timing matters. Reserve a response slot after major hater/system beats.',
      kind: 'HELPER_WINDOW',
    });
  }

  if (input.message.kind === 'BOT_ATTACK' || input.message.kind === 'INVASION') {
    recommendations.push({
      id: 'counterplay_escalate',
      priority: 95,
      title: 'Escalate counterplay framing',
      detail: 'Attack-class events should open a counterplay window rather than reading like ambient taunt noise.',
      kind: 'ESCALATE_COUNTERPLAY',
    });
  }

  return recommendations.sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// Core evaluator
// ============================================================================

export function evaluateGlobalInjectResult(input: GlobalPolicyInput): GlobalInjectResult {
  const reasons: GlobalPolicyReason[] = [];

  if (input.message.channel !== 'GLOBAL') {
    return {
      decision: 'REROUTE',
      visibility: 'MUTED',
      notification: 'NONE',
      shouldPersistInTranscript: false,
      shouldFeatureInFeed: false,
      shouldAnimateBanner: false,
      shouldEscalateAudienceHeat: false,
      shouldMirrorToInvasionDirector: false,
      shouldMirrorToNpcDirector: false,
      shouldMirrorToTelemetry: false,
      shouldRequestHelperFollowup: false,
      shouldRequestCrowdFollowup: false,
      shouldOpenCollapsedPill: false,
      score: 0,
      reasons: [{ code: 'WRONG_CHANNEL', detail: 'Message does not target GLOBAL.', weight: 1 }],
      rerouteChannel: 'GLOBAL',
    };
  }

  if (!GLOBAL_AVAILABLE_MODES.includes(input.gameplay.runMode)) {
    return {
      decision: 'SUPPRESS',
      visibility: 'MUTED',
      notification: 'NONE',
      shouldPersistInTranscript: false,
      shouldFeatureInFeed: false,
      shouldAnimateBanner: false,
      shouldEscalateAudienceHeat: false,
      shouldMirrorToInvasionDirector: false,
      shouldMirrorToNpcDirector: false,
      shouldMirrorToTelemetry: false,
      shouldRequestHelperFollowup: false,
      shouldRequestCrowdFollowup: false,
      shouldOpenCollapsedPill: false,
      score: 0,
      reasons: [{ code: 'MODE_BLOCK', detail: 'GLOBAL is unavailable in this mode.', weight: 1 }],
    };
  }

  if (input.health.moderationLock && isPlayerKind(input.message.kind)) {
    return {
      decision: 'SUPPRESS',
      visibility: 'MUTED',
      notification: 'NONE',
      shouldPersistInTranscript: false,
      shouldFeatureInFeed: false,
      shouldAnimateBanner: false,
      shouldEscalateAudienceHeat: false,
      shouldMirrorToInvasionDirector: false,
      shouldMirrorToNpcDirector: false,
      shouldMirrorToTelemetry: true,
      shouldRequestHelperFollowup: false,
      shouldRequestCrowdFollowup: false,
      shouldOpenCollapsedPill: false,
      score: 0,
      reasons: [{ code: 'MOD_LOCK_PLAYER', detail: 'Moderation lock suppresses player traffic.', weight: 1 }],
    };
  }

  const mode = modeProfile(input.gameplay.runMode);
  const surface = surfaceProfile(input.surface.activeSurface);
  const pressure = coercePressureTier(
    input.gameplay.pressureTier,
    input.gameplay.haterHeat,
    input.gameplay.activeThreatCardCount,
  );

  let score = baseMessageWeight(input.message);
  const baseReasonStart = score;
  reasons.push({ code: 'BASE_KIND', detail: `Base kind weight applied for ${input.message.kind}.`, weight: baseReasonStart });

  const pWeight = pressureWeight(pressure);
  score += pWeight;
  if (pWeight > 0) reasons.push({ code: 'PRESSURE', detail: `Pressure tier ${pressure} amplified message importance.`, weight: pWeight });

  const tWeight = tickWeight(input.message.tickTier ?? input.gameplay.tickTier ?? null);
  score += tWeight;
  if (tWeight > 0) reasons.push({ code: 'TICK', detail: 'Tick-tier urgency increased visibility.', weight: tWeight });

  const aWeight = actorWeight(input.message.actor);
  score += aWeight;
  reasons.push({ code: 'ACTOR', detail: `Speaker class ${input.message.actor.speakerClass} adjusted visibility.`, weight: aWeight });

  const cWeight = crowdWeight(input.audience);
  score += cWeight;
  if (cWeight > 0) reasons.push({ code: 'AUDIENCE', detail: 'Audience heat changed public-stage value.', weight: cWeight });

  const mWeight = modeWeight(mode, input.message);
  score += mWeight;
  reasons.push({ code: 'MODE', detail: `Mode profile ${mode.label} influenced routing weight.`, weight: mWeight });

  const sWeight = surfaceWeight(surface, input.message);
  score += sWeight;
  reasons.push({ code: 'SURFACE', detail: `Surface ${surface.label} influenced display intensity.`, weight: sWeight });

  if (input.health.replaySyncInProgress && isSupportKind(input.message.kind)) {
    score -= 0.08;
    reasons.push({ code: 'REPLAY_SYNC', detail: 'Replay sync de-prioritized support chatter.', weight: -0.08 });
  }

  if (input.health.degradedTransport && isPlayerKind(input.message.kind)) {
    score -= 0.06;
    reasons.push({ code: 'DEGRADED_TX', detail: 'Degraded transport slightly reduced player-message emphasis.', weight: -0.06 });
  }

  if (input.message.kind === 'CROWD_SWELL' && pressure === 'CALM') {
    score -= 0.11;
    reasons.push({ code: 'CALM_CROWD', detail: 'Calm-state crowd swell is reduced to avoid noise.', weight: -0.11 });
  }

  if (input.message.kind === 'HELPER_TIP' && input.surface.chatFocused) {
    score += 0.03;
    reasons.push({ code: 'FOCUSED_HELPER', detail: 'Focused dock slightly boosts helper timing quality.', weight: 0.03 });
  }

  if (input.message.kind === 'BOT_ATTACK' || input.message.kind === 'INVASION') {
    score += 0.08;
    reasons.push({ code: 'ATTACK_CLASS', detail: 'Attack-class events deserve more public witness weight.', weight: 0.08 });
  }

  if (input.message.kind === 'RUN_OUTCOME') {
    score += mode.comebackWitnessBias * 0.03;
    reasons.push({ code: 'OUTCOME_MOMENT', detail: 'Run outcome is a canonical public witness moment.', weight: mode.comebackWitnessBias * 0.03 });
  }

  const { penalty, reasons: penaltyReasons } = evaluateRatePenalty(input);
  score -= penalty;
  reasons.push(...penaltyReasons.map((reason) => ({ ...reason, weight: -Math.abs(reason.weight) })));

  score = clamp01(score);

  const visibility = visibilityFromScore(score, surface);

  let decision: GlobalInjectDecision = 'ALLOW';
  let deferForMs: number | undefined;

  if (score < 0.16) {
    decision = 'SUPPRESS';
    reasons.push({ code: 'LOW_SCORE_SUPPRESS', detail: 'Composite score too weak for GLOBAL.', weight: -1 });
  } else if (score < 0.31 && (input.audience.heatBand === 'FEVER' || input.audience.heatBand === 'PANIC')) {
    decision = 'DEFER';
    deferForMs = 1500;
    reasons.push({ code: 'HEAT_DEFER', detail: 'Weak message deferred because GLOBAL heat is already saturated.', weight: -0.6 });
  }

  const notification = notificationFromDecision({
    result: decision,
    visibility,
    surface,
    input,
  });

  const shouldMirrorToInvasionDirector =
    decision === 'ALLOW' &&
    (input.message.kind === 'BOT_ATTACK' || input.message.kind === 'INVASION' || (pressure === 'CRITICAL' && isHaterKind(input.message.kind)));

  const shouldMirrorToNpcDirector =
    decision === 'ALLOW' &&
    (input.message.kind === 'HELPER_TIP' || isHaterKind(input.message.kind) || input.message.kind === 'REPUTATION_WITNESS');

  const shouldRequestHelperFollowup =
    decision === 'ALLOW' &&
    (pressure === 'HIGH' || pressure === 'CRITICAL') &&
    (input.message.kind === 'BOT_ATTACK' || input.message.kind === 'INVASION' || input.message.kind === 'CASCADE_ALERT');

  const shouldRequestCrowdFollowup =
    decision === 'ALLOW' &&
    visibility !== 'MUTED' &&
    (input.message.kind === 'RUN_OUTCOME' || input.message.kind === 'ACHIEVEMENT' || input.message.kind === 'BOT_TAUNT') &&
    input.audience.swarmLikelihood >= 0.55;

  return {
    decision,
    visibility,
    notification,
    shouldPersistInTranscript: decision !== 'SUPPRESS',
    shouldFeatureInFeed: decision === 'ALLOW' && visibility !== 'MUTED',
    shouldAnimateBanner: decision === 'ALLOW' && (visibility === 'SPOTLIGHT' || visibility === 'LEGEND' || surface.shouldPreferBanner),
    shouldEscalateAudienceHeat: decision === 'ALLOW' && (isHaterKind(input.message.kind) || input.message.kind === 'RUN_OUTCOME' || input.message.kind === 'CROWD_SWELL'),
    shouldMirrorToInvasionDirector,
    shouldMirrorToNpcDirector,
    shouldMirrorToTelemetry: true,
    shouldRequestHelperFollowup,
    shouldRequestCrowdFollowup,
    shouldOpenCollapsedPill: decision === 'ALLOW' && !input.surface.chatDockOpen && (visibility === 'FEATURED' || visibility === 'SPOTLIGHT' || visibility === 'LEGEND'),
    score,
    reasons,
    deferForMs,
  };
}

// ============================================================================
// Snapshot builder
// ============================================================================

export function buildGlobalChannelSnapshot(input: Omit<GlobalPolicyInput, 'message' | 'rate' | 'health'> & {
  rate?: Partial<GlobalRateState>;
  health?: Partial<GlobalChannelHealth>;
}): GlobalChannelSnapshot {
  const normalizedRate: GlobalRateState = {
    now: nowOr(input.rate?.now, Date.now()),
    trailing10sCount: input.rate?.trailing10sCount ?? 0,
    trailing30sCount: input.rate?.trailing30sCount ?? 0,
    trailing60sCount: input.rate?.trailing60sCount ?? 0,
    trailing5mCount: input.rate?.trailing5mCount ?? 0,
    sameActorTrailing30sCount: input.rate?.sameActorTrailing30sCount ?? 0,
    sameKindTrailing30sCount: input.rate?.sameKindTrailing30sCount ?? 0,
    sameBodyFingerprintTrailing60sCount: input.rate?.sameBodyFingerprintTrailing60sCount ?? 0,
    lastInjectAtByActor: input.rate?.lastInjectAtByActor ?? {},
    lastInjectAtByKind: input.rate?.lastInjectAtByKind ?? {},
  };

  const normalizedHealth: GlobalChannelHealth = {
    degradedTransport: input.health?.degradedTransport ?? false,
    moderationLock: input.health?.moderationLock ?? false,
    readOnlyWindow: input.health?.readOnlyWindow ?? false,
    replaySyncInProgress: input.health?.replaySyncInProgress ?? false,
    localBackpressure: input.health?.localBackpressure ?? false,
  };

  const syntheticMessage: GlobalMessageEnvelope = {
    id: 'snapshot_probe',
    channel: 'GLOBAL',
    kind: 'SYSTEM',
    body: 'snapshot',
    ts: normalizedRate.now,
    actor: {
      id: 'system',
      displayName: 'System',
      speakerClass: 'SYSTEM',
    },
    runId: input.gameplay.runId,
    seed: input.gameplay.seed,
    pressureTier: input.gameplay.pressureTier ?? undefined,
    tickTier: input.gameplay.tickTier ?? undefined,
  };

  const compose = evaluateGlobalComposerCapability(input.gameplay, normalizedHealth);
  const layout = evaluateGlobalLayout(input.surface, input.gameplay, input.audience);
  const recommendations = buildGlobalRecommendations({
    message: syntheticMessage,
    gameplay: input.gameplay,
    surface: input.surface,
    audience: input.audience,
    rate: normalizedRate,
    health: normalizedHealth,
  });

  return {
    channel: 'GLOBAL',
    runMode: input.gameplay.runMode,
    modeFamily: input.gameplay.modeFamily,
    audienceHeatBand: input.audience.heatBand,
    crowdMood: input.audience.crowdMood,
    compose,
    layout,
    recommendations,
  };
}

// ============================================================================
// Class wrapper for canonical usage
// ============================================================================

export interface GlobalChannelPolicyOptions {
  ratePolicy?: GlobalRatePolicy;
}

export class GlobalChannelPolicy {
  private readonly ratePolicy: GlobalRatePolicy;

  public constructor(options: GlobalChannelPolicyOptions = {}) {
    this.ratePolicy = options.ratePolicy ?? DEFAULT_GLOBAL_RATE_POLICY;
  }

  public getChannelId(): GlobalChannelId {
    return 'GLOBAL';
  }

  public getAvailableModes(): readonly GlobalRunMode[] {
    return GLOBAL_AVAILABLE_MODES;
  }

  public getModeFamily(mode: GlobalRunMode): GlobalModeFamily {
    return GLOBAL_MODE_FAMILY_MAP[mode];
  }

  public getSurfaceProfile(surface: GlobalMountSurface): GlobalSurfaceProfile {
    return surfaceProfile(surface);
  }

  public getModeProfile(mode: GlobalRunMode): GlobalModeProfile {
    return modeProfile(mode);
  }

  public getLayout(surface: GlobalSurfaceContext, gameplay: GlobalGameplayState, audience: GlobalAudienceState): GlobalFeatureLayout {
    return evaluateGlobalLayout(surface, gameplay, audience);
  }

  public getComposerCapability(gameplay: GlobalGameplayState, health: GlobalChannelHealth): GlobalComposerCapability {
    return evaluateGlobalComposerCapability(gameplay, health);
  }

  public evaluate(input: GlobalPolicyInput): GlobalInjectResult {
    return evaluateGlobalInjectResult({
      ...input,
      rate: input.rate,
      health: input.health,
    });
  }

  public buildSnapshot(input: Omit<GlobalPolicyInput, 'message' | 'rate' | 'health'> & {
    rate?: Partial<GlobalRateState>;
    health?: Partial<GlobalChannelHealth>;
  }): GlobalChannelSnapshot {
    return buildGlobalChannelSnapshot(input);
  }

  public normalizeGameplay(args: Partial<GlobalGameplayState> & { runMode: GlobalRunMode }): GlobalGameplayState {
    return {
      runId: args.runId ?? null,
      runMode: args.runMode,
      modeFamily: args.modeFamily ?? this.getModeFamily(args.runMode),
      seed: args.seed ?? null,
      tick: args.tick ?? 0,
      totalTicks: args.totalTicks ?? null,
      roundNumber: args.roundNumber ?? null,
      totalRounds: args.totalRounds ?? null,
      cash: args.cash ?? null,
      netWorth: args.netWorth ?? null,
      income: args.income ?? null,
      expenses: args.expenses ?? null,
      haterHeat: args.haterHeat ?? null,
      activeThreatCardCount: args.activeThreatCardCount ?? null,
      pressureTier: args.pressureTier ?? null,
      tickTier: args.tickTier ?? null,
      localScore: args.localScore ?? null,
      opponentScore: args.opponentScore ?? null,
      freezeTicks: args.freezeTicks ?? null,
      regime: args.regime ?? null,
    };
  }

  public normalizeAudience(args: Partial<GlobalAudienceState>): GlobalAudienceState {
    const heat = clamp01(args.heat ?? 0);
    const heatBand = args.heatBand ?? deriveAudienceHeatBand(heat);
    return {
      heat,
      heatBand,
      crowdMood: args.crowdMood ?? 'NEUTRAL',
      spectators: args.spectators ?? 0,
      swarmLikelihood: clamp01(args.swarmLikelihood ?? heat * 0.9),
      ridiculeLikelihood: clamp01(args.ridiculeLikelihood ?? heat * 0.4),
      reverenceLikelihood: clamp01(args.reverenceLikelihood ?? heat * 0.3),
    };
  }

  public normalizeSurface(args: Partial<GlobalSurfaceContext>): GlobalSurfaceContext {
    return {
      activeSurface: args.activeSurface ?? 'UNKNOWN',
      visibleSurfaces: args.visibleSurfaces ?? [args.activeSurface ?? 'UNKNOWN'],
      chatDockOpen: args.chatDockOpen ?? false,
      chatFocused: args.chatFocused ?? false,
      tabActive: args.tabActive ?? true,
      drawerOpen: args.drawerOpen ?? false,
      collapsed: args.collapsed ?? false,
    };
  }

  public normalizeRate(args: Partial<GlobalRateState>): GlobalRateState {
    return {
      now: args.now ?? Date.now(),
      trailing10sCount: args.trailing10sCount ?? 0,
      trailing30sCount: args.trailing30sCount ?? 0,
      trailing60sCount: args.trailing60sCount ?? 0,
      trailing5mCount: args.trailing5mCount ?? 0,
      sameActorTrailing30sCount: args.sameActorTrailing30sCount ?? 0,
      sameKindTrailing30sCount: args.sameKindTrailing30sCount ?? 0,
      sameBodyFingerprintTrailing60sCount: args.sameBodyFingerprintTrailing60sCount ?? 0,
      lastInjectAtByActor: args.lastInjectAtByActor ?? {},
      lastInjectAtByKind: args.lastInjectAtByKind ?? {},
    };
  }

  public normalizeHealth(args: Partial<GlobalChannelHealth>): GlobalChannelHealth {
    return {
      degradedTransport: args.degradedTransport ?? false,
      moderationLock: args.moderationLock ?? false,
      readOnlyWindow: args.readOnlyWindow ?? false,
      replaySyncInProgress: args.replaySyncInProgress ?? false,
      localBackpressure: args.localBackpressure ?? false,
    };
  }

  public createInput(args: {
    message: GlobalMessageEnvelope;
    gameplay: Partial<GlobalGameplayState> & { runMode: GlobalRunMode };
    surface?: Partial<GlobalSurfaceContext>;
    audience?: Partial<GlobalAudienceState>;
    rate?: Partial<GlobalRateState>;
    health?: Partial<GlobalChannelHealth>;
  }): GlobalPolicyInput {
    const gameplay = this.normalizeGameplay(args.gameplay);
    const audience = this.normalizeAudience({
      ...(args.audience ?? {}),
      crowdMood: args.audience?.crowdMood ?? deriveCrowdMood({
        heatBand: args.audience?.heatBand ?? deriveAudienceHeatBand(args.audience?.heat ?? 0),
        modeFamily: gameplay.modeFamily,
        pressureTier: coercePressureTier(gameplay.pressureTier, gameplay.haterHeat, gameplay.activeThreatCardCount),
        localScore: gameplay.localScore,
        opponentScore: gameplay.opponentScore,
        isOutcomeMoment: args.message.kind === 'RUN_OUTCOME',
        isCollapseMoment: gameplay.pressureTier === 'CRITICAL' && (args.message.kind === 'CASCADE_ALERT' || args.message.kind === 'BOT_ATTACK'),
        isComebackMoment: args.message.kind === 'ACHIEVEMENT' && (gameplay.localScore ?? 0) > (gameplay.opponentScore ?? 0),
      }),
    });

    return {
      message: args.message,
      gameplay,
      surface: this.normalizeSurface(args.surface ?? {}),
      audience,
      rate: this.normalizeRate(args.rate ?? {}),
      health: this.normalizeHealth(args.health ?? {}),
    };
  }

  public explain(result: GlobalInjectResult): string {
    return result.reasons
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .map((reason) => `${reason.code}: ${reason.detail}`)
      .join(' | ');
  }
}

export const globalChannelPolicy = new GlobalChannelPolicy();

// ============================================================================
// Narrow convenience helpers for other engine files
// ============================================================================

export function createGlobalPlayerMessage(args: {
  id: string;
  body: string;
  ts: number;
  actorId: string;
  actorName: string;
  isLocalPlayer?: boolean;
  runId?: string | null;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  metadata?: Record<string, unknown>;
}): GlobalMessageEnvelope {
  return {
    id: args.id,
    channel: 'GLOBAL',
    kind: 'PLAYER',
    body: args.body,
    ts: args.ts,
    actor: {
      id: args.actorId,
      displayName: args.actorName,
      speakerClass: 'PLAYER',
      isLocalPlayer: args.isLocalPlayer ?? true,
    },
    runId: args.runId ?? null,
    pressureTier: args.pressureTier ?? undefined,
    tickTier: args.tickTier ?? undefined,
    metadata: args.metadata,
  };
}

export function createGlobalSystemMessage(args: {
  id: string;
  body: string;
  ts: number;
  kind?: Extract<GlobalMessageKind, 'SYSTEM' | 'MARKET_ALERT' | 'RUN_NOTICE' | 'RUN_OUTCOME' | 'COUNTER_INTEL' | 'MODE_WITNESS' | 'PRESSURE_WITNESS' | 'ACHIEVEMENT'>;
  runId?: string | null;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  metadata?: Record<string, unknown>;
}): GlobalMessageEnvelope {
  return {
    id: args.id,
    channel: 'GLOBAL',
    kind: args.kind ?? 'SYSTEM',
    body: args.body,
    ts: args.ts,
    actor: {
      id: 'system',
      displayName: 'System',
      speakerClass: 'SYSTEM',
    },
    runId: args.runId ?? null,
    pressureTier: args.pressureTier ?? undefined,
    tickTier: args.tickTier ?? undefined,
    metadata: args.metadata,
  };
}

export function createGlobalHaterMessage(args: {
  id: string;
  body: string;
  ts: number;
  actorId: string;
  actorName: string;
  botId?: string | null;
  kind?: Extract<GlobalMessageKind, 'BOT_TAUNT' | 'BOT_ATTACK' | 'INVASION'>;
  runId?: string | null;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  metadata?: Record<string, unknown>;
}): GlobalMessageEnvelope {
  return {
    id: args.id,
    channel: 'GLOBAL',
    kind: args.kind ?? 'BOT_TAUNT',
    body: args.body,
    ts: args.ts,
    actor: {
      id: args.actorId,
      displayName: args.actorName,
      speakerClass: 'HATER',
      botId: args.botId ?? null,
    },
    runId: args.runId ?? null,
    pressureTier: args.pressureTier ?? undefined,
    tickTier: args.tickTier ?? undefined,
    metadata: args.metadata,
  };
}

export function createGlobalHelperMessage(args: {
  id: string;
  body: string;
  ts: number;
  actorId: string;
  actorName: string;
  helperId?: string | null;
  runId?: string | null;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  metadata?: Record<string, unknown>;
}): GlobalMessageEnvelope {
  return {
    id: args.id,
    channel: 'GLOBAL',
    kind: 'HELPER_TIP',
    body: args.body,
    ts: args.ts,
    actor: {
      id: args.actorId,
      displayName: args.actorName,
      speakerClass: 'HELPER',
      helperId: args.helperId ?? null,
    },
    runId: args.runId ?? null,
    pressureTier: args.pressureTier ?? undefined,
    tickTier: args.tickTier ?? undefined,
    metadata: args.metadata,
  };
}

// ============================================================================
// End of file
// ============================================================================
