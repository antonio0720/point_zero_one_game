/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT LOBBY CHANNEL POLICY
 * FILE: backend/src/game/engine/chat/channels/LobbyChannelPolicy.ts
 * VERSION: 2026.03.20
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend policy authority for the LOBBY chat lane.
 *
 * Backend-truth question
 * ----------------------
 *   "Given a candidate LOBBY-channel chat action, what is the authoritative
 *    backend decision about admission, visibility, countdown legality,
 *    ready-state shaping, helper/hater eligibility, spectator exposure,
 *    transcript handling, replay relevance, and fanout posture?"
 *
 * LOBBY is not a throwaway waiting room. It is the staging theater where the
 * run acquires social posture before the run begins:
 * - players signal readiness or hesitation,
 * - parties form, fracture, invite, and requeue,
 * - helpers may stabilize cold-start confusion,
 * - haters may apply early pressure without owning the room,
 * - countdown compression narrows what is socially legal,
 * - spectators witness but do not inherit full authorship,
 * - and backend law decides what is noise versus what becomes pre-run truth.
 *
 * Repo-grounded doctrine preserved here
 * -------------------------------------
 * - /shared/contracts/chat defines LOBBY as a first-class visible channel.
 * - /backend/src/game/engine/chat/channels already contains specialist policy
 *   files for GLOBAL, DEAL_ROOM, SYNDICATE, and LOBBY.
 * - /pzo-web/src/engines/chat and /pzo-web/src/components/chat establish that
 *   lobby chat is mount-aware and omnipresent, not a disconnected widget.
 * - The uploaded doctrine explicitly positions LOBBY as the staging lane for
 *   matchmaking, ready-check, countdown, helper onboarding, and hater taunts.
 *
 * Design laws
 * -----------
 * - LOBBY is lower-proof than DEAL_ROOM, but it is still backend-authoritative.
 * - Countdown must narrow social legality rather than merely recolor the UI.
 * - Spectators may read more than they may write.
 * - Cold-start help is welcome; helper spam is not.
 * - Early hater pressure is legal only when it reinforces stage mood rather
 *   than collapsing the room into incoherent noise.
 * - The backend must decide what becomes transcript truth, what remains
 *   ephemeral, what is deferred, and what is shadow-routed.
 * - Lobby policy should remain introspectable enough for telemetry, replay,
 *   liveops inspection, and future extraction into shared contracts.
 * ============================================================================
 */

// ============================================================================
// MARK: Narrow scalar aliases
// ============================================================================

export type LobbyChannelId = 'LOBBY';

export type LobbyModeId =
  | 'solo'
  | 'co-op'
  | 'asymmetric-pvp'
  | 'ghost'
  | 'syndicate'
  | 'tournament'
  | 'sandbox'
  | 'unknown';

export type LobbyMountSurface =
  | 'LOBBY_SCREEN'
  | 'GAME_BOARD'
  | 'BATTLE_HUD'
  | 'EMPIRE_SCREEN'
  | 'PREDATOR_SCREEN'
  | 'SYNDICATE_SCREEN'
  | 'PHANTOM_SCREEN'
  | 'CLUB_UI'
  | 'LEAGUE_UI'
  | 'CHAT_DRAWER'
  | 'POST_RUN_SUMMARY'
  | 'UNKNOWN';

export type LobbyActorKind =
  | 'player'
  | 'system'
  | 'helper'
  | 'hater'
  | 'ambient_npc'
  | 'moderator'
  | 'admin'
  | 'service'
  | 'spectator';

export type LobbyRole =
  | 'host'
  | 'member'
  | 'guest'
  | 'spectator'
  | 'moderator'
  | 'observer'
  | 'none';

export type LobbyPhase =
  | 'open'
  | 'matchmaking'
  | 'ready_check'
  | 'countdown'
  | 'launching'
  | 'post_cancel'
  | 'closed'
  | 'spectating';

export type LobbyVisibilityClass =
  | 'room_only'
  | 'room_plus_moderation'
  | 'spectator_read'
  | 'shadow_only'
  | 'no_emit';

export type LobbyMessageKind =
  | 'PLAYER'
  | 'PLAYER_RESPONSE'
  | 'SYSTEM'
  | 'HELPER_TIP'
  | 'BOT_TAUNT'
  | 'NPC_AMBIENT'
  | 'MARKET_ALERT'
  | 'READY_STATE'
  | 'COUNTDOWN'
  | 'MATCH_STATUS'
  | 'ADMIN_NOTICE'
  | 'PARTY_INVITE'
  | 'PARTY_ACCEPT'
  | 'PARTY_REJECT'
  | 'COMMAND'
  | 'CURSOR'
  | 'TYPING'
  | 'PRESENCE';

export type LobbyCommand =
  | '/ready'
  | '/unready'
  | '/start'
  | '/cancel'
  | '/invite'
  | '/leave'
  | '/mute'
  | '/unmute'
  | '/help'
  | '/taunt';

export type LobbyIngressStatus =
  | 'allow'
  | 'allow_shadow'
  | 'reject'
  | 'defer';

export type LobbyRejectionCode =
  | 'MODE_NOT_ALLOWED'
  | 'PHASE_LOCKED'
  | 'ROLE_NOT_ALLOWED'
  | 'ROOM_NOT_JOINED'
  | 'COUNTDOWN_RESTRICTED'
  | 'COUNTDOWN_LOCKED'
  | 'SPECTATOR_READ_ONLY'
  | 'KIND_NOT_ALLOWED'
  | 'COMMAND_NOT_ALLOWED'
  | 'EMPTY_BODY'
  | 'MAX_LENGTH'
  | 'BURST_LIMIT'
  | 'COOLDOWN_ACTIVE'
  | 'HELPER_SUPPRESSED'
  | 'HATER_SUPPRESSED'
  | 'AMBIENT_SUPPRESSED'
  | 'READY_STATE_INVALID'
  | 'QUEUE_STATE_BLOCKED'
  | 'MOUNT_RESTRICTED'
  | 'DUPLICATE_SPAM'
  | 'UNKNOWN';

export type LobbyNotificationHint =
  | 'none'
  | 'badge'
  | 'inline'
  | 'banner'
  | 'countdown_banner'
  | 'party_banner'
  | 'moderation_alert';

export type LobbyTranscriptDisposition =
  | 'append'
  | 'append_low_signal'
  | 'append_shadow_only'
  | 'ephemeral_only'
  | 'drop';

export type LobbyStageMood =
  | 'quiet'
  | 'social'
  | 'tense'
  | 'compressed'
  | 'launch_imminent'
  | 'aftershock'
  | 'spectator_tilt';

export type LobbyAudienceHeatBand =
  | 'cold'
  | 'warming'
  | 'active'
  | 'heated'
  | 'fever';

export type LobbyCountdownUrgency =
  | 'none'
  | 'far'
  | 'approaching'
  | 'near'
  | 'critical'
  | 'handoff';

export type LobbyReadyPressureBand =
  | 'none'
  | 'low'
  | 'elevated'
  | 'high'
  | 'severe';

export type LobbyFanoutClass =
  | 'none'
  | 'room_only'
  | 'room_plus_spectators'
  | 'room_plus_moderation'
  | 'system_only';

export type LobbyShadowLane =
  | 'SYSTEM_SHADOW'
  | 'NPC_SHADOW'
  | 'RIVALRY_SHADOW'
  | 'RESCUE_SHADOW'
  | 'LIVEOPS_SHADOW';

export type LobbyStageDirectiveKind =
  | 'none'
  | 'warm_helper'
  | 'cold_start_helper'
  | 'countdown_tighten'
  | 'requeue_stabilize'
  | 'spectator_mute'
  | 'hater_tease'
  | 'ambient_fill'
  | 'launch_handoff';

export type LobbyCounterplayDisposition =
  | 'none'
  | 'open_window'
  | 'keep_open'
  | 'close_window';

export type LobbyReplayPriority =
  | 'none'
  | 'low'
  | 'standard'
  | 'high';

// ============================================================================
// MARK: Core state contracts
// ============================================================================

export interface LobbyActorProfile {
  actorId: string;
  actorKind: LobbyActorKind;
  teamId?: string;
  trustScore?: number;
  newPlayer?: boolean;
  muted?: boolean;
  shadowMuted?: boolean;
  haterTargeted?: boolean;
  helperEligible?: boolean;
  rescueEligible?: boolean;
  helperFatigueScore?: number;
  queueWaitMs?: number;
  sessionAgeMs?: number;
  joinedFromMatchmaking?: boolean;
  hasSeenLobbyHelp?: boolean;
  canSeeShadow?: boolean;
  moderationWatch?: boolean;
}

export interface LobbyMembership {
  actorId: string;
  role: LobbyRole;
  joinedAtMs: number;
  isReady?: boolean;
  partyId?: string;
  canModerate?: boolean;
  canSeeShadow?: boolean;
  isLeader?: boolean;
  isSpectatorPinned?: boolean;
  readyStateChangedAtMs?: number;
}

export interface LobbyQueueState {
  queueDepth?: number;
  queueWaitMs?: number;
  averageReadyDelayMs?: number;
  requeueCount?: number;
  matchingHealthScore?: number;
  partyFragmentRisk?: number;
}

export interface LobbyCounterplayState {
  counterplayWindowOpen?: boolean;
  counterplayWindowEndsAtMs?: number;
  readyPressureWindowEndsAtMs?: number;
  unresolvedNotReadyCount?: number;
}

export interface LobbySpectatorPolicy {
  allowRead: boolean;
  allowPresence: boolean;
  allowPlayerResponseRead?: boolean;
  allowWriteOverride?: boolean;
  canSeeCountdown?: boolean;
  canSeePartyMessages?: boolean;
}

export interface LobbyChannelState {
  roomId: string;
  modeId: LobbyModeId;
  phase: LobbyPhase;
  roomRevision: number;
  memberships: readonly LobbyMembership[];
  playerCount: number;
  spectatorCount: number;
  allowHaterTaunts: boolean;
  allowHelperTips: boolean;
  allowAmbient: boolean;
  countdownEndsAtMs?: number;
  launchAtMs?: number;
  maxBodyLength: number;
  mountSurface?: LobbyMountSurface;
  stageMoodOverride?: LobbyStageMood;
  audienceHeatScore?: number;
  coldStartLobby?: boolean;
  rescueWindowOpen?: boolean;
  requiresPartyReady?: boolean;
  allowSpectatorWrite?: boolean;
  countdownLockAtMs?: number;
  queue?: LobbyQueueState;
  counterplay?: LobbyCounterplayState;
  spectatorPolicy?: LobbySpectatorPolicy;
}

export interface LobbyMessageDraft {
  channelId: LobbyChannelId;
  actorId: string;
  actorKind: LobbyActorKind;
  role: LobbyRole;
  kind: LobbyMessageKind;
  command?: LobbyCommand;
  roomId: string;
  body: string;
  ts: number;
  metadata?: Readonly<Record<string, unknown>>;
  isEdit?: boolean;
  isDelete?: boolean;
}

export interface LobbyIngressContext {
  actor: LobbyActorProfile;
  room: LobbyChannelState;
  nowMs: number;
  recentSendTimestampsMs: readonly number[];
  recentKinds: readonly LobbyMessageKind[];
}

export interface LobbyRateWindow {
  burstLimit: number;
  burstWindowMs: number;
  sustainedLimit: number;
  sustainedWindowMs: number;
  cooldownMs: number;
}

export interface LobbyStageDirective {
  kind: LobbyStageDirectiveKind;
  reason: string;
  lane: LobbyShadowLane | null;
  shouldQueueNpc: boolean;
}

export interface LobbyFanoutDirective {
  fanoutClass: LobbyFanoutClass;
  includeSpectators: boolean;
  includeModerationLane: boolean;
  includeSenderEcho: boolean;
}

export interface LobbyReplayDirective {
  priority: LobbyReplayPriority;
  shouldReplay: boolean;
  reason: string;
}

export interface LobbyCounterplayDirective {
  disposition: LobbyCounterplayDisposition;
  reason: string;
  windowEndsAtMs?: number;
}

export interface LobbyIngressExplainability {
  stageMood: LobbyStageMood;
  audienceHeatBand: LobbyAudienceHeatBand;
  countdownUrgency: LobbyCountdownUrgency;
  readyPressure: LobbyReadyPressureBand;
  phaseDescription: string;
  appliedMountSurface: LobbyMountSurface;
  appliedBodyLimit: number;
  countdownRemainingMs: number | null;
  missingReadyCount: number;
  helperEligible: boolean;
  haterEligible: boolean;
  ambientEligible: boolean;
  sameKindBurstCount: number;
}

export interface LobbyIngressDecision {
  status: LobbyIngressStatus;
  code?: LobbyRejectionCode;
  reasons: readonly string[];
  visibility: LobbyVisibilityClass;
  rateWindow: LobbyRateWindow;
  shouldPersist: boolean;
  shouldFanout: boolean;
  shouldEmitTelemetry: boolean;
  shouldEmitReplay: boolean;
  normalizedBody: string;
  auditLabels: readonly string[];
  notification: LobbyNotificationHint;
  transcript: LobbyTranscriptDisposition;
  fanout: LobbyFanoutDirective;
  replay: LobbyReplayDirective;
  shadowLane: LobbyShadowLane | null;
  shouldMirrorToShadow: boolean;
  shouldEscalateAudienceHeat: boolean;
  shouldOpenRescueWindow: boolean;
  counterplay: LobbyCounterplayDirective;
  stageDirective: LobbyStageDirective;
  deferForMs?: number;
  explainability: LobbyIngressExplainability;
}

export interface LobbyPolicySnapshot {
  channelId: LobbyChannelId;
  availableInModes: readonly LobbyModeId[];
  phase: LobbyPhase;
  playerCount: number;
  spectatorCount: number;
  allowHaterTaunts: boolean;
  allowHelperTips: boolean;
  allowAmbient: boolean;
  stageMood: LobbyStageMood;
  countdownUrgency: LobbyCountdownUrgency;
  readyPressure: LobbyReadyPressureBand;
  mountSurface: LobbyMountSurface;
}

export interface LobbyFeedGuidance {
  stageMood: LobbyStageMood;
  audienceHeatBand: LobbyAudienceHeatBand;
  countdownUrgency: LobbyCountdownUrgency;
  readyPressure: LobbyReadyPressureBand;
  notificationBias: LobbyNotificationHint;
  defaultFanoutClass: LobbyFanoutClass;
  showThreatMeter: boolean;
  showTranscriptDrawer: boolean;
  showPresenceStrip: boolean;
  density: 'compact' | 'standard' | 'expanded';
}

export interface LobbyCommandRule {
  readonly roles: readonly LobbyRole[];
  readonly allowedPhases: readonly LobbyPhase[];
  readonly description: string;
}

export interface LobbyMountRule {
  readonly allowedPhases: readonly LobbyPhase[];
  readonly defaultFanoutClass: LobbyFanoutClass;
  readonly stageMoodBias: LobbyStageMood;
  readonly density: 'compact' | 'standard' | 'expanded';
  readonly allowComposer: boolean;
  readonly showPresenceStrip: boolean;
  readonly showThreatMeter: boolean;
}

// ============================================================================
// MARK: Constants — base doctrine matrices
// ============================================================================

const LOBBY_CHANNEL_ID: LobbyChannelId = 'LOBBY';

const LOBBY_ALLOWED_MODES = [
  'solo',
  'co-op',
  'asymmetric-pvp',
  'ghost',
  'syndicate',
  'tournament',
  'sandbox',
] satisfies readonly LobbyModeId[];

const LOBBY_ALLOWED_BY_PHASE: Readonly<Record<LobbyPhase, readonly LobbyMessageKind[]>> = {
  open: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'NPC_AMBIENT',
    'MARKET_ALERT',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'CURSOR',
    'TYPING',
    'PRESENCE',
  ],
  matchmaking: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'NPC_AMBIENT',
    'MATCH_STATUS',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  ready_check: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'READY_STATE',
    'MATCH_STATUS',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  countdown: [
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'BOT_TAUNT',
    'COUNTDOWN',
    'READY_STATE',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  launching: [
    'SYSTEM',
    'COUNTDOWN',
    'MATCH_STATUS',
    'PRESENCE',
  ],
  post_cancel: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'HELPER_TIP',
    'NPC_AMBIENT',
    'MATCH_STATUS',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  closed: [
    'SYSTEM',
    'PRESENCE',
  ],
  spectating: [
    'PLAYER_RESPONSE',
    'SYSTEM',
    'BOT_TAUNT',
    'NPC_AMBIENT',
    'MATCH_STATUS',
    'PRESENCE',
  ],
};

const LOBBY_ROLE_MATRIX: Readonly<Record<LobbyRole, readonly LobbyMessageKind[]>> = {
  host: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'SYSTEM',
    'READY_STATE',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  member: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'READY_STATE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  guest: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'READY_STATE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'TYPING',
    'PRESENCE',
  ],
  spectator: [
    'PLAYER_RESPONSE',
    'PRESENCE',
  ],
  moderator: [
    'SYSTEM',
    'ADMIN_NOTICE',
    'COMMAND',
    'PRESENCE',
  ],
  observer: [
    'PLAYER_RESPONSE',
    'PRESENCE',
  ],
  none: [],
};

const LOBBY_ACTOR_MATRIX: Readonly<Record<LobbyActorKind, readonly LobbyMessageKind[]>> = {
  player: [
    'PLAYER',
    'PLAYER_RESPONSE',
    'READY_STATE',
    'PARTY_INVITE',
    'PARTY_ACCEPT',
    'PARTY_REJECT',
    'COMMAND',
    'CURSOR',
    'TYPING',
    'PRESENCE',
  ],
  system: [
    'SYSTEM',
    'COUNTDOWN',
    'MATCH_STATUS',
    'MARKET_ALERT',
    'ADMIN_NOTICE',
    'PRESENCE',
  ],
  helper: [
    'HELPER_TIP',
    'PRESENCE',
  ],
  hater: [
    'BOT_TAUNT',
    'PRESENCE',
  ],
  ambient_npc: [
    'NPC_AMBIENT',
    'PRESENCE',
  ],
  moderator: [
    'SYSTEM',
    'ADMIN_NOTICE',
    'COMMAND',
    'PRESENCE',
  ],
  admin: [
    'SYSTEM',
    'ADMIN_NOTICE',
    'COMMAND',
    'PRESENCE',
  ],
  service: [
    'SYSTEM',
    'MATCH_STATUS',
    'COUNTDOWN',
    'PRESENCE',
  ],
  spectator: [
    'PRESENCE',
  ],
};

const LOBBY_COMMAND_MATRIX: Readonly<Record<LobbyCommand, LobbyCommandRule>> = {
  '/ready': {
    roles: ['host', 'member', 'guest'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown'],
    description: 'Declare readiness before launch handoff completes.',
  },
  '/unready': {
    roles: ['host', 'member', 'guest'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown'],
    description: 'Withdraw readiness before launch lock or post-cancel reset.',
  },
  '/start': {
    roles: ['host'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'post_cancel'],
    description: 'Host-only start authority before launching or closure.',
  },
  '/cancel': {
    roles: ['host', 'moderator'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'launching'],
    description: 'Abort queue, countdown, or launch handoff.',
  },
  '/invite': {
    roles: ['host', 'member'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'post_cancel'],
    description: 'Invite another party member while lobby is socially active.',
  },
  '/leave': {
    roles: ['host', 'member', 'guest', 'spectator', 'moderator', 'observer'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'post_cancel', 'spectating'],
    description: 'Exit the room without mutating launch truth directly.',
  },
  '/mute': {
    roles: ['host', 'moderator'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'post_cancel', 'spectating'],
    description: 'Apply lobby-level social restraint to noisy actors.',
  },
  '/unmute': {
    roles: ['host', 'moderator'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'post_cancel', 'spectating'],
    description: 'Lift lobby-level mute state.',
  },
  '/help': {
    roles: ['host', 'member', 'guest', 'moderator', 'observer'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'post_cancel', 'spectating'],
    description: 'Request helper guidance or system clarification.',
  },
  '/taunt': {
    roles: ['host', 'member', 'guest'],
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'post_cancel'],
    description: 'Open playful or adversarial pressure if room law allows it.',
  },
};

const LOBBY_MOUNT_MATRIX: Readonly<Record<LobbyMountSurface, LobbyMountRule>> = {
  LOBBY_SCREEN: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'launching', 'post_cancel', 'spectating'],
    defaultFanoutClass: 'room_plus_spectators',
    stageMoodBias: 'social',
    density: 'expanded',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: true,
  },
  GAME_BOARD: {
    allowedPhases: ['post_cancel', 'spectating'],
    defaultFanoutClass: 'room_only',
    stageMoodBias: 'aftershock',
    density: 'compact',
    allowComposer: false,
    showPresenceStrip: true,
    showThreatMeter: false,
  },
  BATTLE_HUD: {
    allowedPhases: ['spectating'],
    defaultFanoutClass: 'room_only',
    stageMoodBias: 'spectator_tilt',
    density: 'compact',
    allowComposer: false,
    showPresenceStrip: true,
    showThreatMeter: false,
  },
  EMPIRE_SCREEN: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'post_cancel'],
    defaultFanoutClass: 'room_plus_spectators',
    stageMoodBias: 'social',
    density: 'expanded',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: true,
  },
  PREDATOR_SCREEN: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'post_cancel'],
    defaultFanoutClass: 'room_plus_spectators',
    stageMoodBias: 'tense',
    density: 'standard',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: true,
  },
  SYNDICATE_SCREEN: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'post_cancel'],
    defaultFanoutClass: 'room_plus_spectators',
    stageMoodBias: 'social',
    density: 'expanded',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: true,
  },
  PHANTOM_SCREEN: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'spectating'],
    defaultFanoutClass: 'room_plus_spectators',
    stageMoodBias: 'tense',
    density: 'standard',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: true,
  },
  CLUB_UI: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'post_cancel', 'spectating'],
    defaultFanoutClass: 'room_plus_spectators',
    stageMoodBias: 'social',
    density: 'expanded',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: false,
  },
  LEAGUE_UI: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'spectating'],
    defaultFanoutClass: 'room_plus_spectators',
    stageMoodBias: 'tense',
    density: 'standard',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: true,
  },
  CHAT_DRAWER: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'launching', 'post_cancel', 'closed', 'spectating'],
    defaultFanoutClass: 'room_only',
    stageMoodBias: 'social',
    density: 'standard',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: false,
  },
  POST_RUN_SUMMARY: {
    allowedPhases: ['closed', 'post_cancel', 'spectating'],
    defaultFanoutClass: 'room_only',
    stageMoodBias: 'aftershock',
    density: 'compact',
    allowComposer: false,
    showPresenceStrip: false,
    showThreatMeter: false,
  },
  UNKNOWN: {
    allowedPhases: ['open', 'matchmaking', 'ready_check', 'countdown', 'launching', 'post_cancel', 'closed', 'spectating'],
    defaultFanoutClass: 'room_only',
    stageMoodBias: 'social',
    density: 'standard',
    allowComposer: true,
    showPresenceStrip: true,
    showThreatMeter: false,
  },
};

const LOBBY_RATE_WINDOWS: Readonly<Record<LobbyActorKind, LobbyRateWindow>> = {
  player: { burstLimit: 6, burstWindowMs: 8_000, sustainedLimit: 20, sustainedWindowMs: 60_000, cooldownMs: 800 },
  system: { burstLimit: 12, burstWindowMs: 3_000, sustainedLimit: 60, sustainedWindowMs: 60_000, cooldownMs: 0 },
  helper: { burstLimit: 2, burstWindowMs: 20_000, sustainedLimit: 6, sustainedWindowMs: 120_000, cooldownMs: 15_000 },
  hater: { burstLimit: 2, burstWindowMs: 30_000, sustainedLimit: 4, sustainedWindowMs: 120_000, cooldownMs: 25_000 },
  ambient_npc: { burstLimit: 2, burstWindowMs: 45_000, sustainedLimit: 4, sustainedWindowMs: 180_000, cooldownMs: 30_000 },
  moderator: { burstLimit: 12, burstWindowMs: 3_000, sustainedLimit: 60, sustainedWindowMs: 60_000, cooldownMs: 0 },
  admin: { burstLimit: 12, burstWindowMs: 3_000, sustainedLimit: 60, sustainedWindowMs: 60_000, cooldownMs: 0 },
  service: { burstLimit: 12, burstWindowMs: 3_000, sustainedLimit: 60, sustainedWindowMs: 60_000, cooldownMs: 0 },
  spectator: { burstLimit: 0, burstWindowMs: 10_000, sustainedLimit: 0, sustainedWindowMs: 60_000, cooldownMs: 0 },
};

const LOBBY_PHASE_RATE_MODIFIERS: Readonly<Record<LobbyPhase, number>> = {
  open: 1,
  matchmaking: 1,
  ready_check: 0.9,
  countdown: 0.72,
  launching: 0.55,
  post_cancel: 0.9,
  closed: 0.5,
  spectating: 0.8,
};

const LOBBY_KIND_LABELS: Readonly<Record<LobbyMessageKind, readonly string[]>> = {
  PLAYER: ['player', 'freeform'],
  PLAYER_RESPONSE: ['player', 'response'],
  SYSTEM: ['system'],
  HELPER_TIP: ['helper'],
  BOT_TAUNT: ['hater'],
  NPC_AMBIENT: ['ambient'],
  MARKET_ALERT: ['market'],
  READY_STATE: ['ready'],
  COUNTDOWN: ['countdown'],
  MATCH_STATUS: ['match'],
  ADMIN_NOTICE: ['admin'],
  PARTY_INVITE: ['party'],
  PARTY_ACCEPT: ['party'],
  PARTY_REJECT: ['party'],
  COMMAND: ['command'],
  CURSOR: ['ephemeral'],
  TYPING: ['ephemeral'],
  PRESENCE: ['ephemeral'],
};

const LOBBY_BODY_LIMITS: Readonly<Record<LobbyMessageKind, number>> = {
  PLAYER: 420,
  PLAYER_RESPONSE: 420,
  SYSTEM: 280,
  HELPER_TIP: 220,
  BOT_TAUNT: 220,
  NPC_AMBIENT: 180,
  MARKET_ALERT: 220,
  READY_STATE: 80,
  COUNTDOWN: 80,
  MATCH_STATUS: 180,
  ADMIN_NOTICE: 320,
  PARTY_INVITE: 120,
  PARTY_ACCEPT: 120,
  PARTY_REJECT: 120,
  COMMAND: 180,
  CURSOR: 0,
  TYPING: 0,
  PRESENCE: 0,
};

const LOBBY_NOTIFICATION_HINTS: Readonly<Record<LobbyMessageKind, LobbyNotificationHint>> = {
  PLAYER: 'inline',
  PLAYER_RESPONSE: 'inline',
  SYSTEM: 'inline',
  HELPER_TIP: 'banner',
  BOT_TAUNT: 'inline',
  NPC_AMBIENT: 'none',
  MARKET_ALERT: 'badge',
  READY_STATE: 'badge',
  COUNTDOWN: 'countdown_banner',
  MATCH_STATUS: 'badge',
  ADMIN_NOTICE: 'moderation_alert',
  PARTY_INVITE: 'party_banner',
  PARTY_ACCEPT: 'party_banner',
  PARTY_REJECT: 'party_banner',
  COMMAND: 'none',
  CURSOR: 'none',
  TYPING: 'none',
  PRESENCE: 'none',
};

const LOBBY_TRANSCRIPT_DISPOSITIONS: Readonly<Record<LobbyMessageKind, LobbyTranscriptDisposition>> = {
  PLAYER: 'append',
  PLAYER_RESPONSE: 'append',
  SYSTEM: 'append',
  HELPER_TIP: 'append_low_signal',
  BOT_TAUNT: 'append_low_signal',
  NPC_AMBIENT: 'append_low_signal',
  MARKET_ALERT: 'append',
  READY_STATE: 'append_low_signal',
  COUNTDOWN: 'append_low_signal',
  MATCH_STATUS: 'append_low_signal',
  ADMIN_NOTICE: 'append',
  PARTY_INVITE: 'append',
  PARTY_ACCEPT: 'append',
  PARTY_REJECT: 'append',
  COMMAND: 'append_low_signal',
  CURSOR: 'ephemeral_only',
  TYPING: 'ephemeral_only',
  PRESENCE: 'ephemeral_only',
};

const LOBBY_DEFAULT_SHADOW_LANE_BY_KIND: Readonly<Record<LobbyMessageKind, LobbyShadowLane | null>> = {
  PLAYER: null,
  PLAYER_RESPONSE: null,
  SYSTEM: 'SYSTEM_SHADOW',
  HELPER_TIP: 'RESCUE_SHADOW',
  BOT_TAUNT: 'RIVALRY_SHADOW',
  NPC_AMBIENT: 'NPC_SHADOW',
  MARKET_ALERT: 'LIVEOPS_SHADOW',
  READY_STATE: 'SYSTEM_SHADOW',
  COUNTDOWN: 'SYSTEM_SHADOW',
  MATCH_STATUS: 'SYSTEM_SHADOW',
  ADMIN_NOTICE: 'SYSTEM_SHADOW',
  PARTY_INVITE: 'SYSTEM_SHADOW',
  PARTY_ACCEPT: 'SYSTEM_SHADOW',
  PARTY_REJECT: 'SYSTEM_SHADOW',
  COMMAND: 'SYSTEM_SHADOW',
  CURSOR: null,
  TYPING: null,
  PRESENCE: null,
};

// ============================================================================
// MARK: Utilities
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function countRecent(windowMs: number, nowMs: number, timestamps: readonly number[]): number {
  const floor = nowMs - windowMs;
  let count = 0;
  for (const value of timestamps) {
    if (value >= floor) {
      count += 1;
    }
  }
  return count;
}

function countRecentKinds<TKind extends string>(
  windowMs: number,
  nowMs: number,
  timestamps: readonly number[],
  kinds: readonly TKind[],
  targetKind: TKind,
): number {
  const floor = nowMs - windowMs;
  let count = 0;
  const len = Math.min(timestamps.length, kinds.length);
  for (let i = 0; i < len; i += 1) {
    if (timestamps[i] >= floor && kinds[i] === targetKind) {
      count += 1;
    }
  }
  return count;
}

function getMembership(room: LobbyChannelState, actorId: string): LobbyMembership | undefined {
  return room.memberships.find((membership) => membership.actorId === actorId);
}

function kindAllowedForPhase(phase: LobbyPhase, kind: LobbyMessageKind): boolean {
  return LOBBY_ALLOWED_BY_PHASE[phase].includes(kind);
}

function kindAllowedForRole(role: LobbyRole, kind: LobbyMessageKind): boolean {
  return LOBBY_ROLE_MATRIX[role].includes(kind);
}

function kindAllowedForActor(actorKind: LobbyActorKind, kind: LobbyMessageKind): boolean {
  return LOBBY_ACTOR_MATRIX[actorKind].includes(kind);
}

function isPersistedKind(kind: LobbyMessageKind): boolean {
  return kind !== 'CURSOR' && kind !== 'TYPING' && kind !== 'PRESENCE';
}

function isReplayKind(kind: LobbyMessageKind): boolean {
  return kind !== 'CURSOR' && kind !== 'TYPING' && kind !== 'PRESENCE';
}

function resolveMountSurface(room: LobbyChannelState): LobbyMountSurface {
  return room.mountSurface ?? 'LOBBY_SCREEN';
}

function getMountRule(room: LobbyChannelState): LobbyMountRule {
  return LOBBY_MOUNT_MATRIX[resolveMountSurface(room)] ?? LOBBY_MOUNT_MATRIX.UNKNOWN;
}

function computeCountdownRemainingMs(room: LobbyChannelState, nowMs: number): number | null {
  if (typeof room.countdownEndsAtMs !== 'number') {
    return null;
  }
  return Math.max(0, room.countdownEndsAtMs - nowMs);
}

function computeCountdownUrgency(room: LobbyChannelState, nowMs: number): LobbyCountdownUrgency {
  if (room.phase === 'launching') {
    return 'handoff';
  }
  const remainingMs = computeCountdownRemainingMs(room, nowMs);
  if (remainingMs === null) {
    return room.phase === 'countdown' ? 'approaching' : 'none';
  }
  if (remainingMs <= 2_000) {
    return 'critical';
  }
  if (remainingMs <= 5_000) {
    return 'near';
  }
  if (remainingMs <= 12_000) {
    return 'approaching';
  }
  return 'far';
}

function computeReadyCount(room: LobbyChannelState): number {
  let count = 0;
  for (const membership of room.memberships) {
    if (membership.role === 'host' || membership.role === 'member' || membership.role === 'guest') {
      if (membership.isReady) {
        count += 1;
      }
    }
  }
  return count;
}

function computeExpectedReadyCount(room: LobbyChannelState): number {
  let count = 0;
  for (const membership of room.memberships) {
    if (membership.role === 'host' || membership.role === 'member' || membership.role === 'guest') {
      count += 1;
    }
  }
  if (room.requiresPartyReady && count === 0 && room.playerCount > 0) {
    return room.playerCount;
  }
  return count;
}

function computeMissingReadyCount(room: LobbyChannelState): number {
  return Math.max(0, computeExpectedReadyCount(room) - computeReadyCount(room));
}

function computeReadyPressureBand(room: LobbyChannelState, nowMs: number): LobbyReadyPressureBand {
  const missing = computeMissingReadyCount(room);
  if (missing <= 0) {
    return 'none';
  }
  const urgency = computeCountdownUrgency(room, nowMs);
  if (room.phase === 'countdown' && urgency === 'critical') {
    return 'severe';
  }
  if (room.phase === 'countdown' || room.phase === 'launching') {
    return missing >= 2 ? 'severe' : 'high';
  }
  if (room.phase === 'ready_check') {
    return missing >= 2 ? 'high' : 'elevated';
  }
  return missing >= 2 ? 'elevated' : 'low';
}

function inferAudienceHeatBand(room: LobbyChannelState): LobbyAudienceHeatBand {
  const raw = clamp(room.audienceHeatScore ?? 0, 0, 100);
  if (raw >= 85) {
    return 'fever';
  }
  if (raw >= 65) {
    return 'heated';
  }
  if (raw >= 40) {
    return 'active';
  }
  if (raw >= 15) {
    return 'warming';
  }
  if (room.spectatorCount >= 8) {
    return 'warming';
  }
  return 'cold';
}

function inferStageMood(room: LobbyChannelState, nowMs: number): LobbyStageMood {
  if (room.stageMoodOverride) {
    return room.stageMoodOverride;
  }
  const mountRule = getMountRule(room);
  const heat = inferAudienceHeatBand(room);
  const urgency = computeCountdownUrgency(room, nowMs);
  const readyPressure = computeReadyPressureBand(room, nowMs);
  if (room.phase === 'launching') {
    return 'launch_imminent';
  }
  if (room.phase === 'post_cancel') {
    return 'aftershock';
  }
  if (room.phase === 'spectating') {
    return 'spectator_tilt';
  }
  if (room.phase === 'countdown' || urgency === 'critical' || urgency === 'near') {
    return 'compressed';
  }
  if (heat === 'fever' || heat === 'heated' || readyPressure === 'high' || readyPressure === 'severe') {
    return 'tense';
  }
  return mountRule.stageMoodBias;
}

function getBodyLimit(room: LobbyChannelState, kind: LobbyMessageKind): number {
  return Math.min(room.maxBodyLength, LOBBY_BODY_LIMITS[kind]);
}

function applyPhaseRateWindow(rateWindow: LobbyRateWindow, phase: LobbyPhase): LobbyRateWindow {
  const multiplier = LOBBY_PHASE_RATE_MODIFIERS[phase] ?? 1;
  if (multiplier === 1) {
    return rateWindow;
  }
  return {
    burstLimit: Math.max(0, Math.floor(rateWindow.burstLimit * multiplier)),
    burstWindowMs: rateWindow.burstWindowMs,
    sustainedLimit: Math.max(0, Math.floor(rateWindow.sustainedLimit * multiplier)),
    sustainedWindowMs: rateWindow.sustainedWindowMs,
    cooldownMs: Math.floor(rateWindow.cooldownMs / Math.max(multiplier, 0.35)),
  };
}

function deriveTranscriptDisposition(kind: LobbyMessageKind, visibility: LobbyVisibilityClass): LobbyTranscriptDisposition {
  if (visibility === 'shadow_only') {
    return 'append_shadow_only';
  }
  return LOBBY_TRANSCRIPT_DISPOSITIONS[kind];
}

function deriveNotificationHint(
  kind: LobbyMessageKind,
  stageMood: LobbyStageMood,
  countdownUrgency: LobbyCountdownUrgency,
  readyPressure: LobbyReadyPressureBand,
): LobbyNotificationHint {
  if (kind === 'COUNTDOWN' && countdownUrgency !== 'none') {
    return 'countdown_banner';
  }
  if ((kind === 'READY_STATE' || kind === 'MATCH_STATUS') && readyPressure === 'high') {
    return 'banner';
  }
  if ((kind === 'READY_STATE' || kind === 'MATCH_STATUS') && readyPressure === 'severe') {
    return 'countdown_banner';
  }
  if (kind === 'HELPER_TIP' && (stageMood === 'compressed' || stageMood === 'tense')) {
    return 'banner';
  }
  return LOBBY_NOTIFICATION_HINTS[kind];
}

function deriveShadowLane(
  kind: LobbyMessageKind,
  visibility: LobbyVisibilityClass,
  actorKind: LobbyActorKind,
): LobbyShadowLane | null {
  if (visibility === 'shadow_only') {
    if (actorKind === 'helper') {
      return 'RESCUE_SHADOW';
    }
    if (actorKind === 'hater') {
      return 'RIVALRY_SHADOW';
    }
    if (actorKind === 'ambient_npc') {
      return 'NPC_SHADOW';
    }
    return 'SYSTEM_SHADOW';
  }
  return LOBBY_DEFAULT_SHADOW_LANE_BY_KIND[kind] ?? null;
}

function deriveFanoutDirective(
  visibility: LobbyVisibilityClass,
  room: LobbyChannelState,
  kind: LobbyMessageKind,
): LobbyFanoutDirective {
  const mountRule = getMountRule(room);
  if (visibility === 'shadow_only') {
    return {
      fanoutClass: 'none',
      includeSpectators: false,
      includeModerationLane: true,
      includeSenderEcho: true,
    };
  }
  if (kind === 'CURSOR') {
    return {
      fanoutClass: 'room_only',
      includeSpectators: false,
      includeModerationLane: false,
      includeSenderEcho: true,
    };
  }
  if (kind === 'TYPING' || kind === 'PRESENCE') {
    return {
      fanoutClass: mountRule.defaultFanoutClass === 'room_plus_spectators' ? 'room_plus_spectators' : 'room_only',
      includeSpectators: Boolean(room.spectatorPolicy?.allowRead),
      includeModerationLane: visibility === 'room_plus_moderation',
      includeSenderEcho: true,
    };
  }
  return {
    fanoutClass: visibility === 'room_plus_moderation' ? 'room_plus_moderation' : mountRule.defaultFanoutClass,
    includeSpectators: mountRule.defaultFanoutClass === 'room_plus_spectators' && (room.spectatorPolicy?.allowRead ?? true),
    includeModerationLane: visibility === 'room_plus_moderation',
    includeSenderEcho: true,
  };
}

function deriveReplayDirective(
  kind: LobbyMessageKind,
  phase: LobbyPhase,
  readyPressure: LobbyReadyPressureBand,
  countdownUrgency: LobbyCountdownUrgency,
): LobbyReplayDirective {
  if (!isReplayKind(kind)) {
    return { priority: 'none', shouldReplay: false, reason: 'ephemeral lobby event' };
  }
  if (kind === 'COUNTDOWN' || countdownUrgency === 'critical') {
    return { priority: 'high', shouldReplay: true, reason: 'countdown pressure should survive replay' };
  }
  if (kind === 'PARTY_INVITE' || kind === 'PARTY_ACCEPT' || kind === 'PARTY_REJECT' || kind === 'READY_STATE') {
    return { priority: 'standard', shouldReplay: true, reason: 'party and readiness state matter to lobby narrative' };
  }
  if (kind === 'HELPER_TIP' && readyPressure !== 'none') {
    return { priority: 'standard', shouldReplay: true, reason: 'helper stabilization during readiness pressure is replay-relevant' };
  }
  if (phase === 'post_cancel' && kind === 'MATCH_STATUS') {
    return { priority: 'standard', shouldReplay: true, reason: 'post-cancel requeue state should remain inspectable' };
  }
  return { priority: 'low', shouldReplay: true, reason: 'persisted lobby signal with low replay priority' };
}

function buildStageDirective(
  room: LobbyChannelState,
  actor: LobbyActorProfile,
  kind: LobbyMessageKind,
  status: LobbyIngressStatus,
  readyPressure: LobbyReadyPressureBand,
  countdownUrgency: LobbyCountdownUrgency,
): LobbyStageDirective {
  if (status === 'reject') {
    return {
      kind: 'none',
      reason: 'no stage directive when ingress is rejected',
      lane: null,
      shouldQueueNpc: false,
    };
  }
  if (kind === 'HELPER_TIP' && actor.newPlayer) {
    return {
      kind: 'cold_start_helper',
      reason: 'new player helper intervention should remain stage-aware',
      lane: 'RESCUE_SHADOW',
      shouldQueueNpc: false,
    };
  }
  if (kind === 'HELPER_TIP' && readyPressure !== 'none') {
    return {
      kind: 'warm_helper',
      reason: 'helper intervention stabilizes lobby pressure',
      lane: 'RESCUE_SHADOW',
      shouldQueueNpc: false,
    };
  }
  if (kind === 'BOT_TAUNT' && room.allowHaterTaunts) {
    return {
      kind: 'hater_tease',
      reason: 'hater presence is legal in lobby when policy allows it',
      lane: 'RIVALRY_SHADOW',
      shouldQueueNpc: false,
    };
  }
  if (kind === 'NPC_AMBIENT' && room.allowAmbient) {
    return {
      kind: 'ambient_fill',
      reason: 'ambient chatter may preserve stage occupancy',
      lane: 'NPC_SHADOW',
      shouldQueueNpc: false,
    };
  }
  if (countdownUrgency === 'critical' || room.phase === 'launching') {
    return {
      kind: 'launch_handoff',
      reason: 'room is crossing into launch handoff discipline',
      lane: 'SYSTEM_SHADOW',
      shouldQueueNpc: false,
    };
  }
  if (countdownUrgency === 'near' || countdownUrgency === 'approaching') {
    return {
      kind: 'countdown_tighten',
      reason: 'countdown compression should narrow social noise',
      lane: 'SYSTEM_SHADOW',
      shouldQueueNpc: false,
    };
  }
  if (room.phase === 'post_cancel') {
    return {
      kind: 'requeue_stabilize',
      reason: 'room is in requeue stabilization after cancellation',
      lane: 'RESCUE_SHADOW',
      shouldQueueNpc: false,
    };
  }
  return {
    kind: 'none',
    reason: 'no extra stage directive required',
    lane: null,
    shouldQueueNpc: false,
  };
}

function buildCounterplayDirective(
  room: LobbyChannelState,
  kind: LobbyMessageKind,
  readyPressure: LobbyReadyPressureBand,
  countdownUrgency: LobbyCountdownUrgency,
): LobbyCounterplayDirective {
  const existingEndsAt = room.counterplay?.counterplayWindowEndsAtMs;
  if (room.counterplay?.counterplayWindowOpen && typeof existingEndsAt === 'number') {
    return {
      disposition: 'keep_open',
      reason: 'existing lobby counterplay window remains open',
      windowEndsAtMs: existingEndsAt,
    };
  }
  if (kind === 'READY_STATE' && readyPressure !== 'none') {
    return {
      disposition: 'open_window',
      reason: 'readiness change under pressure creates a counterplay surface',
      windowEndsAtMs: room.countdownEndsAtMs,
    };
  }
  if (kind === 'COMMAND' && countdownUrgency === 'near') {
    return {
      disposition: 'open_window',
      reason: 'countdown command creates a short counterplay surface',
      windowEndsAtMs: room.countdownEndsAtMs,
    };
  }
  if (room.phase === 'launching' || room.phase === 'closed') {
    return {
      disposition: 'close_window',
      reason: 'launch or closure ends lobby counterplay legality',
      windowEndsAtMs: room.countdownEndsAtMs,
    };
  }
  return {
    disposition: 'none',
    reason: 'no lobby counterplay directive required',
  };
}

function isMountAllowed(room: LobbyChannelState): boolean {
  const mountRule = getMountRule(room);
  return mountRule.allowedPhases.includes(room.phase);
}

function shouldSuppressHelper(room: LobbyChannelState, actor: LobbyActorProfile): boolean {
  if (!room.allowHelperTips) {
    return true;
  }
  if (!actor.helperEligible) {
    return true;
  }
  if ((actor.helperFatigueScore ?? 0) >= 80) {
    return true;
  }
  return false;
}

function shouldSuppressHater(room: LobbyChannelState, actor: LobbyActorProfile, countdownUrgency: LobbyCountdownUrgency): boolean {
  if (!room.allowHaterTaunts) {
    return true;
  }
  if (!actor.haterTargeted) {
    return true;
  }
  if (room.phase === 'launching') {
    return true;
  }
  if (countdownUrgency === 'critical' && room.phase === 'countdown') {
    return true;
  }
  return false;
}

function shouldSuppressAmbient(room: LobbyChannelState, countdownUrgency: LobbyCountdownUrgency): boolean {
  if (!room.allowAmbient) {
    return true;
  }
  if (room.phase === 'countdown' && (countdownUrgency === 'near' || countdownUrgency === 'critical')) {
    return true;
  }
  if (room.phase === 'launching' || room.phase === 'closed') {
    return true;
  }
  return false;
}

function shouldOpenRescueWindow(
  room: LobbyChannelState,
  actor: LobbyActorProfile,
  kind: LobbyMessageKind,
  readyPressure: LobbyReadyPressureBand,
): boolean {
  if (room.rescueWindowOpen) {
    return true;
  }
  if (!actor.rescueEligible && !actor.newPlayer) {
    return false;
  }
  if (kind === 'HELPER_TIP') {
    return true;
  }
  return readyPressure === 'high' || readyPressure === 'severe';
}

function buildExplainability(
  room: LobbyChannelState,
  actor: LobbyActorProfile,
  kind: LobbyMessageKind,
  stageMood: LobbyStageMood,
  audienceHeatBand: LobbyAudienceHeatBand,
  countdownUrgency: LobbyCountdownUrgency,
  readyPressure: LobbyReadyPressureBand,
  nowMs: number,
  recentSendTimestampsMs: readonly number[],
  recentKinds: readonly LobbyMessageKind[],
): LobbyIngressExplainability {
  return {
    stageMood,
    audienceHeatBand,
    countdownUrgency,
    readyPressure,
    phaseDescription: describeLobbyPhase(room.phase),
    appliedMountSurface: resolveMountSurface(room),
    appliedBodyLimit: getBodyLimit(room, kind),
    countdownRemainingMs: computeCountdownRemainingMs(room, nowMs),
    missingReadyCount: computeMissingReadyCount(room),
    helperEligible: !shouldSuppressHelper(room, actor),
    haterEligible: !shouldSuppressHater(room, actor, countdownUrgency),
    ambientEligible: !shouldSuppressAmbient(room, countdownUrgency),
    sameKindBurstCount: countRecentKinds(8_000, nowMs, recentSendTimestampsMs, recentKinds, kind),
  };
}

function describeLobbyPhase(phase: LobbyPhase): string {
  switch (phase) {
    case 'open':
      return 'open social staging before matchmaking pressure tightens';
    case 'matchmaking':
      return 'players are assembling and party state is in flux';
    case 'ready_check':
      return 'members are expected to confirm readiness';
    case 'countdown':
      return 'countdown law narrows legal messages and increases urgency';
    case 'launching':
      return 'launch handoff is in progress and chat is mostly system-only';
    case 'post_cancel':
      return 'room remains open after cancellation for debrief and requeue';
    case 'closed':
      return 'room is closed and social append is finished';
    case 'spectating':
      return 'spectator law applies and participants are mostly read-only';
    default:
      return 'unknown lobby phase';
  }
}

// ============================================================================
// MARK: Lobby policy authority
// ============================================================================

export class LobbyChannelPolicy {
  public readonly channelId: LobbyChannelId = LOBBY_CHANNEL_ID;

  public getAvailableModes(): readonly LobbyModeId[] {
    return LOBBY_ALLOWED_MODES;
  }

  public isModeSupported(modeId: LobbyModeId): boolean {
    return (LOBBY_ALLOWED_MODES as readonly LobbyModeId[]).includes(modeId);
  }

  public inferStageMood(room: LobbyChannelState, nowMs: number): LobbyStageMood {
    return inferStageMood(room, nowMs);
  }

  public inferAudienceHeatBand(room: LobbyChannelState): LobbyAudienceHeatBand {
    return inferAudienceHeatBand(room);
  }

  public inferCountdownUrgency(room: LobbyChannelState, nowMs: number): LobbyCountdownUrgency {
    return computeCountdownUrgency(room, nowMs);
  }

  public inferReadyPressure(room: LobbyChannelState, nowMs: number): LobbyReadyPressureBand {
    return computeReadyPressureBand(room, nowMs);
  }

  public buildSnapshot(room: LobbyChannelState, nowMs: number = Date.now()): LobbyPolicySnapshot {
    return {
      channelId: this.channelId,
      availableInModes: LOBBY_ALLOWED_MODES,
      phase: room.phase,
      playerCount: room.playerCount,
      spectatorCount: room.spectatorCount,
      allowHaterTaunts: room.allowHaterTaunts,
      allowHelperTips: room.allowHelperTips,
      allowAmbient: room.allowAmbient,
      stageMood: inferStageMood(room, nowMs),
      countdownUrgency: computeCountdownUrgency(room, nowMs),
      readyPressure: computeReadyPressureBand(room, nowMs),
      mountSurface: resolveMountSurface(room),
    };
  }

  public buildFeedGuidance(room: LobbyChannelState, nowMs: number): LobbyFeedGuidance {
    const stageMood = inferStageMood(room, nowMs);
    const audienceHeatBand = inferAudienceHeatBand(room);
    const countdownUrgency = computeCountdownUrgency(room, nowMs);
    const readyPressure = computeReadyPressureBand(room, nowMs);
    const mountRule = getMountRule(room);
    return {
      stageMood,
      audienceHeatBand,
      countdownUrgency,
      readyPressure,
      notificationBias:
        countdownUrgency === 'critical'
          ? 'countdown_banner'
          : readyPressure === 'high' || readyPressure === 'severe'
            ? 'banner'
            : 'inline',
      defaultFanoutClass: mountRule.defaultFanoutClass,
      showThreatMeter: mountRule.showThreatMeter,
      showTranscriptDrawer: true,
      showPresenceStrip: mountRule.showPresenceStrip,
      density: mountRule.density,
    };
  }

  public getVisibilityClass(actor: LobbyActorProfile, room?: LobbyChannelState): LobbyVisibilityClass {
    if (actor.shadowMuted) {
      return 'shadow_only';
    }
    if (actor.actorKind === 'moderator' || actor.actorKind === 'admin') {
      return 'room_plus_moderation';
    }
    if (actor.actorKind === 'spectator') {
      if (room?.allowSpectatorWrite) {
        return 'room_only';
      }
      return 'spectator_read';
    }
    return 'room_only';
  }

  public explainIngress(
    draft: LobbyMessageDraft,
    context: LobbyIngressContext,
  ): LobbyIngressExplainability {
    const stageMood = inferStageMood(context.room, context.nowMs);
    const audienceHeatBand = inferAudienceHeatBand(context.room);
    const countdownUrgency = computeCountdownUrgency(context.room, context.nowMs);
    const readyPressure = computeReadyPressureBand(context.room, context.nowMs);
    return buildExplainability(
      context.room,
      context.actor,
      draft.kind,
      stageMood,
      audienceHeatBand,
      countdownUrgency,
      readyPressure,
      context.nowMs,
      context.recentSendTimestampsMs,
      context.recentKinds,
    );
  }

  public evaluateIngress(
    draft: LobbyMessageDraft,
    context: LobbyIngressContext,
  ): LobbyIngressDecision {
    const labels: string[] = [...(LOBBY_KIND_LABELS[draft.kind] ?? [])];
    const visibility = this.getVisibilityClass(context.actor, context.room);
    const stageMood = inferStageMood(context.room, context.nowMs);
    const audienceHeatBand = inferAudienceHeatBand(context.room);
    const countdownUrgency = computeCountdownUrgency(context.room, context.nowMs);
    const readyPressure = computeReadyPressureBand(context.room, context.nowMs);
    const explainability = buildExplainability(
      context.room,
      context.actor,
      draft.kind,
      stageMood,
      audienceHeatBand,
      countdownUrgency,
      readyPressure,
      context.nowMs,
      context.recentSendTimestampsMs,
      context.recentKinds,
    );
    const baseRateWindow = LOBBY_RATE_WINDOWS[draft.actorKind];
    const rateWindow = applyPhaseRateWindow(baseRateWindow, context.room.phase);
    const normalizedBody = normalizeWhitespace(draft.body ?? '');
    const shadowLane = deriveShadowLane(draft.kind, visibility, draft.actorKind);
    const transcript = deriveTranscriptDisposition(draft.kind, visibility);
    const fanout = deriveFanoutDirective(visibility, context.room, draft.kind);
    const replay = deriveReplayDirective(draft.kind, context.room.phase, readyPressure, countdownUrgency);
    const notification = deriveNotificationHint(draft.kind, stageMood, countdownUrgency, readyPressure);

    if (draft.channelId !== LOBBY_CHANNEL_ID) {
      return this.reject(
        'KIND_NOT_ALLOWED',
        ['wrong channel specialist received draft'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (!this.isModeSupported(context.room.modeId)) {
      return this.reject(
        'MODE_NOT_ALLOWED',
        [`mode ${context.room.modeId} does not expose LOBBY`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (!isMountAllowed(context.room)) {
      return this.reject(
        'MOUNT_RESTRICTED',
        [`mount ${resolveMountSurface(context.room)} is not legal for phase ${context.room.phase}`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    const membership = getMembership(context.room, draft.actorId);
    if (!membership && draft.actorKind !== 'system' && draft.actorKind !== 'service' && draft.actorKind !== 'moderator' && draft.actorKind !== 'admin') {
      return this.reject(
        'ROOM_NOT_JOINED',
        ['actor is not joined to this lobby'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (!kindAllowedForActor(draft.actorKind, draft.kind)) {
      const code: LobbyRejectionCode = draft.actorKind === 'helper'
        ? 'HELPER_SUPPRESSED'
        : draft.actorKind === 'hater'
          ? 'HATER_SUPPRESSED'
          : draft.actorKind === 'ambient_npc'
            ? 'AMBIENT_SUPPRESSED'
            : 'KIND_NOT_ALLOWED';
      return this.reject(
        code,
        [`actor kind ${draft.actorKind} may not emit ${draft.kind} in lobby`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (!kindAllowedForPhase(context.room.phase, draft.kind)) {
      const code: LobbyRejectionCode = context.room.phase === 'countdown' || context.room.phase === 'launching'
        ? 'COUNTDOWN_RESTRICTED'
        : 'PHASE_LOCKED';
      return this.reject(
        code,
        [`kind ${draft.kind} is not allowed during phase ${context.room.phase}`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (membership && !kindAllowedForRole(membership.role, draft.kind)) {
      return this.reject(
        membership.role === 'spectator' ? 'SPECTATOR_READ_ONLY' : 'ROLE_NOT_ALLOWED',
        [`role ${membership.role} may not emit ${draft.kind}`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if ((draft.isEdit || draft.isDelete) && draft.actorKind !== 'admin' && draft.actorKind !== 'moderator') {
      return this.reject(
        'PHASE_LOCKED',
        ['lobby policy does not allow edit/delete through normal ingress'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (context.actor.muted || context.actor.shadowMuted) {
      labels.push('muted');
      const stageDirective = buildStageDirective(context.room, context.actor, draft.kind, 'allow_shadow', readyPressure, countdownUrgency);
      return {
        status: 'allow_shadow',
        reasons: ['actor is muted or shadow-muted; emit only to shadow lane'],
        visibility: 'shadow_only',
        rateWindow,
        shouldPersist: isPersistedKind(draft.kind),
        shouldFanout: false,
        shouldEmitTelemetry: true,
        shouldEmitReplay: false,
        normalizedBody,
        auditLabels: unique([...labels, 'shadow_only']),
        notification: 'none',
        transcript: 'append_shadow_only',
        fanout: {
          fanoutClass: 'none',
          includeSpectators: false,
          includeModerationLane: true,
          includeSenderEcho: true,
        },
        replay: { priority: 'none', shouldReplay: false, reason: 'shadow-muted lobby message does not enter replay truth' },
        shadowLane: shadowLane ?? 'SYSTEM_SHADOW',
        shouldMirrorToShadow: true,
        shouldEscalateAudienceHeat: false,
        shouldOpenRescueWindow: false,
        counterplay: { disposition: 'none', reason: 'shadow-only ingress does not alter counterplay' },
        stageDirective,
        explainability,
      };
    }

    const bodyLimit = getBodyLimit(context.room, draft.kind);
    if (bodyLimit > 0 && normalizedBody.length === 0) {
      return this.reject(
        'EMPTY_BODY',
        ['body is empty after normalization'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (bodyLimit > 0 && normalizedBody.length > bodyLimit) {
      return this.reject(
        'MAX_LENGTH',
        [`body length ${normalizedBody.length} exceeds limit ${bodyLimit}`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (draft.kind === 'HELPER_TIP' && shouldSuppressHelper(context.room, context.actor)) {
      return this.reject(
        'HELPER_SUPPRESSED',
        ['helper intervention is disabled for this lobby or actor'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (draft.kind === 'BOT_TAUNT' && shouldSuppressHater(context.room, context.actor, countdownUrgency)) {
      return this.reject(
        'HATER_SUPPRESSED',
        ['hater taunts are disabled for this lobby, actor, or countdown state'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (draft.kind === 'NPC_AMBIENT' && shouldSuppressAmbient(context.room, countdownUrgency)) {
      return this.reject(
        'AMBIENT_SUPPRESSED',
        ['ambient chatter is disabled for this lobby state'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (draft.kind === 'READY_STATE' && membership?.role === 'spectator') {
      return this.reject(
        'READY_STATE_INVALID',
        ['spectators may not mutate ready state'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (context.room.phase === 'launching' && draft.kind !== 'SYSTEM' && draft.kind !== 'COUNTDOWN' && draft.kind !== 'MATCH_STATUS' && draft.kind !== 'PRESENCE') {
      return this.reject(
        'COUNTDOWN_LOCKED',
        ['launch handoff locks lobby down to system-bearing signals'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (context.room.phase === 'countdown' && countdownUrgency === 'critical' && draft.kind === 'PLAYER') {
      return this.reject(
        'COUNTDOWN_LOCKED',
        ['freeform player chatter is locked during critical countdown seconds'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    const burst = countRecent(rateWindow.burstWindowMs, context.nowMs, context.recentSendTimestampsMs);
    const sustained = countRecent(rateWindow.sustainedWindowMs, context.nowMs, context.recentSendTimestampsMs);
    const sameKindBurst = countRecentKinds(
      rateWindow.burstWindowMs,
      context.nowMs,
      context.recentSendTimestampsMs,
      context.recentKinds,
      draft.kind,
    );

    if (sameKindBurst >= 3 && isPersistedKind(draft.kind) && draft.kind !== 'READY_STATE' && draft.kind !== 'COUNTDOWN') {
      return this.defer(
        ['same-kind burst suggests low-value lobby spam; deferring instead of accepting immediately'],
        Math.max(600, rateWindow.cooldownMs),
        rateWindow,
        visibility,
        normalizedBody,
        [...labels, 'duplicate_spam'],
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (rateWindow.burstLimit > 0 && burst >= rateWindow.burstLimit) {
      if (draft.kind === 'PRESENCE' || draft.kind === 'TYPING' || draft.kind === 'CURSOR') {
        return this.defer(
          [`burst limit ${rateWindow.burstLimit} exceeded within ${rateWindow.burstWindowMs}ms`],
          Math.max(250, Math.floor(rateWindow.cooldownMs / 2)),
          rateWindow,
          visibility,
          normalizedBody,
          [...labels, 'ephemeral_pressure'],
          stageMood,
          audienceHeatBand,
          countdownUrgency,
          readyPressure,
          notification,
          transcript,
          fanout,
          replay,
          shadowLane,
          explainability,
        );
      }
      return this.reject(
        'BURST_LIMIT',
        [`burst limit ${rateWindow.burstLimit} exceeded within ${rateWindow.burstWindowMs}ms`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (rateWindow.sustainedLimit > 0 && sustained >= rateWindow.sustainedLimit) {
      return this.reject(
        'BURST_LIMIT',
        [`sustained limit ${rateWindow.sustainedLimit} exceeded within ${rateWindow.sustainedWindowMs}ms`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (draft.kind === 'COMMAND' && !this.isCommandAllowed(draft.command, membership?.role ?? draft.role, context.room.phase)) {
      return this.reject(
        'COMMAND_NOT_ALLOWED',
        [`command ${draft.command ?? '(none)'} is not legal in phase ${context.room.phase}`],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (draft.kind === 'COMMAND' && draft.command === '/start' && computeMissingReadyCount(context.room) > 0 && context.room.requiresPartyReady !== false) {
      return this.reject(
        'QUEUE_STATE_BLOCKED',
        ['host cannot start while required ready states remain unresolved'],
        rateWindow,
        visibility,
        normalizedBody,
        labels,
        stageMood,
        audienceHeatBand,
        countdownUrgency,
        readyPressure,
        notification,
        transcript,
        fanout,
        replay,
        shadowLane,
        explainability,
      );
    }

    if (draft.kind === 'READY_STATE') {
      labels.push('ready_state');
      if (readyPressure !== 'none') {
        labels.push(`ready_pressure_${readyPressure}`);
      }
    }
    if (draft.kind === 'COUNTDOWN' || draft.kind === 'MATCH_STATUS') {
      labels.push('phase_signal');
    }
    if (draft.kind === 'HELPER_TIP' && context.actor.newPlayer) {
      labels.push('cold_start_helper');
    }
    if (draft.kind === 'BOT_TAUNT') {
      labels.push('lobby_taunt');
    }
    if (countdownUrgency !== 'none') {
      labels.push(`countdown_${countdownUrgency}`);
    }
    if (stageMood !== 'social') {
      labels.push(`stage_${stageMood}`);
    }
    if (audienceHeatBand !== 'cold') {
      labels.push(`heat_${audienceHeatBand}`);
    }

    const shouldEscalateAudienceHeat =
      draft.kind === 'BOT_TAUNT' ||
      draft.kind === 'PARTY_INVITE' ||
      draft.kind === 'PARTY_ACCEPT' ||
      draft.kind === 'PARTY_REJECT' ||
      draft.kind === 'MATCH_STATUS';

    const shouldOpenRescueWindowValue = shouldOpenRescueWindow(context.room, context.actor, draft.kind, readyPressure);
    const counterplay = buildCounterplayDirective(context.room, draft.kind, readyPressure, countdownUrgency);
    const stageDirective = buildStageDirective(context.room, context.actor, draft.kind, 'allow', readyPressure, countdownUrgency);

    return {
      status: 'allow',
      reasons: ['message satisfies role, phase, countdown, and rate law for LOBBY'],
      visibility,
      rateWindow,
      shouldPersist: transcript !== 'ephemeral_only',
      shouldFanout: fanout.fanoutClass !== 'none' && draft.kind !== 'CURSOR',
      shouldEmitTelemetry: true,
      shouldEmitReplay: replay.shouldReplay,
      normalizedBody,
      auditLabels: unique(labels),
      notification,
      transcript,
      fanout,
      replay,
      shadowLane,
      shouldMirrorToShadow: shadowLane !== null && isPersistedKind(draft.kind),
      shouldEscalateAudienceHeat,
      shouldOpenRescueWindow: shouldOpenRescueWindowValue,
      counterplay,
      stageDirective,
      explainability,
    };
  }

  public isCommandAllowed(command: LobbyCommand | undefined, role: LobbyRole, phase: LobbyPhase): boolean {
    if (!command) {
      return false;
    }
    const rule = LOBBY_COMMAND_MATRIX[command];
    if (!rule) {
      return false;
    }
    return rule.roles.includes(role) && rule.allowedPhases.includes(phase);
  }

  public describePhase(phase: LobbyPhase): string {
    return describeLobbyPhase(phase);
  }

  public summarizeRestrictions(room: LobbyChannelState, nowMs: number = Date.now()): readonly string[] {
    const restrictions: string[] = [];
    restrictions.push(`phase=${room.phase}`);
    restrictions.push(`mountSurface=${resolveMountSurface(room)}`);
    restrictions.push(`stageMood=${inferStageMood(room, nowMs)}`);
    restrictions.push(`audienceHeatBand=${inferAudienceHeatBand(room)}`);
    restrictions.push(`readyPressure=${computeReadyPressureBand(room, nowMs)}`);
    restrictions.push(`countdownUrgency=${computeCountdownUrgency(room, nowMs)}`);
    restrictions.push(`allowHaterTaunts=${String(room.allowHaterTaunts)}`);
    restrictions.push(`allowHelperTips=${String(room.allowHelperTips)}`);
    restrictions.push(`allowAmbient=${String(room.allowAmbient)}`);
    restrictions.push(`playerCount=${String(room.playerCount)}`);
    restrictions.push(`spectatorCount=${String(room.spectatorCount)}`);
    restrictions.push(`missingReadyCount=${String(computeMissingReadyCount(room))}`);
    if (typeof room.countdownEndsAtMs === 'number') {
      restrictions.push(`countdownEndsAtMs=${String(room.countdownEndsAtMs)}`);
    }
    if (typeof room.launchAtMs === 'number') {
      restrictions.push(`launchAtMs=${String(room.launchAtMs)}`);
    }
    if (typeof room.queue?.queueDepth === 'number') {
      restrictions.push(`queueDepth=${String(room.queue.queueDepth)}`);
    }
    if (typeof room.queue?.queueWaitMs === 'number') {
      restrictions.push(`queueWaitMs=${String(room.queue.queueWaitMs)}`);
    }
    if (typeof room.counterplay?.counterplayWindowEndsAtMs === 'number') {
      restrictions.push(`counterplayWindowEndsAtMs=${String(room.counterplay.counterplayWindowEndsAtMs)}`);
    }
    return restrictions;
  }

  private reject(
    code: LobbyRejectionCode,
    reasons: readonly string[],
    rateWindow: LobbyRateWindow,
    visibility: LobbyVisibilityClass,
    normalizedBody: string,
    labels: readonly string[],
    stageMood: LobbyStageMood,
    audienceHeatBand: LobbyAudienceHeatBand,
    countdownUrgency: LobbyCountdownUrgency,
    readyPressure: LobbyReadyPressureBand,
    notification: LobbyNotificationHint,
    transcript: LobbyTranscriptDisposition,
    fanout: LobbyFanoutDirective,
    replay: LobbyReplayDirective,
    shadowLane: LobbyShadowLane | null,
    explainability: LobbyIngressExplainability,
  ): LobbyIngressDecision {
    return {
      status: 'reject',
      code,
      reasons,
      visibility,
      rateWindow,
      shouldPersist: false,
      shouldFanout: false,
      shouldEmitTelemetry: true,
      shouldEmitReplay: false,
      normalizedBody,
      auditLabels: unique([
        ...labels,
        'rejected',
        code.toLowerCase(),
        `stage_${stageMood}`,
        `heat_${audienceHeatBand}`,
        `ready_${readyPressure}`,
        `countdown_${countdownUrgency}`,
      ]),
      notification: notification === 'moderation_alert' ? notification : 'none',
      transcript: transcript === 'append_shadow_only' ? 'append_shadow_only' : 'drop',
      fanout: {
        fanoutClass: 'none',
        includeSpectators: false,
        includeModerationLane: visibility === 'room_plus_moderation',
        includeSenderEcho: true,
      },
      replay: { priority: 'none', shouldReplay: false, reason: 'rejected lobby message does not enter replay' },
      shadowLane,
      shouldMirrorToShadow: visibility === 'shadow_only',
      shouldEscalateAudienceHeat: false,
      shouldOpenRescueWindow: false,
      counterplay: { disposition: 'none', reason: 'rejected lobby message does not mutate counterplay' },
      stageDirective: {
        kind: 'none',
        reason: 'rejected ingress produces no stage directive',
        lane: shadowLane,
        shouldQueueNpc: false,
      },
      explainability,
    };
  }

  private defer(
    reasons: readonly string[],
    deferForMs: number,
    rateWindow: LobbyRateWindow,
    visibility: LobbyVisibilityClass,
    normalizedBody: string,
    labels: readonly string[],
    stageMood: LobbyStageMood,
    audienceHeatBand: LobbyAudienceHeatBand,
    countdownUrgency: LobbyCountdownUrgency,
    readyPressure: LobbyReadyPressureBand,
    notification: LobbyNotificationHint,
    transcript: LobbyTranscriptDisposition,
    fanout: LobbyFanoutDirective,
    replay: LobbyReplayDirective,
    shadowLane: LobbyShadowLane | null,
    explainability: LobbyIngressExplainability,
  ): LobbyIngressDecision {
    return {
      status: 'defer',
      reasons,
      visibility,
      rateWindow,
      shouldPersist: false,
      shouldFanout: false,
      shouldEmitTelemetry: true,
      shouldEmitReplay: false,
      normalizedBody,
      auditLabels: unique([
        ...labels,
        'deferred',
        `stage_${stageMood}`,
        `heat_${audienceHeatBand}`,
        `ready_${readyPressure}`,
        `countdown_${countdownUrgency}`,
      ]),
      notification: notification === 'countdown_banner' ? 'badge' : 'none',
      transcript: 'drop',
      fanout: {
        fanoutClass: 'none',
        includeSpectators: false,
        includeModerationLane: visibility === 'room_plus_moderation',
        includeSenderEcho: true,
      },
      replay: { priority: 'none', shouldReplay: false, reason: 'deferred lobby message has not entered replay truth yet' },
      shadowLane,
      shouldMirrorToShadow: false,
      shouldEscalateAudienceHeat: false,
      shouldOpenRescueWindow: false,
      counterplay: { disposition: 'none', reason: 'deferred lobby message does not mutate counterplay until accepted' },
      stageDirective: {
        kind: countdownUrgency === 'critical' || countdownUrgency === 'near' ? 'countdown_tighten' : 'none',
        reason: 'deferral preserves lobby coherence under pressure',
        lane: shadowLane,
        shouldQueueNpc: false,
      },
      deferForMs,
      explainability,
    };
  }
}

// ============================================================================
// MARK: Introspection exports
// ============================================================================

export const lobbyChannelPolicy = new LobbyChannelPolicy();

export function inspectLobbyPhaseMatrix(): Readonly<Record<LobbyPhase, readonly LobbyMessageKind[]>> {
  return LOBBY_ALLOWED_BY_PHASE;
}

export function inspectLobbyRoleMatrix(): Readonly<Record<LobbyRole, readonly LobbyMessageKind[]>> {
  return LOBBY_ROLE_MATRIX;
}

export function inspectLobbyActorMatrix(): Readonly<Record<LobbyActorKind, readonly LobbyMessageKind[]>> {
  return LOBBY_ACTOR_MATRIX;
}

export function inspectLobbyBodyLimits(): Readonly<Record<LobbyMessageKind, number>> {
  return LOBBY_BODY_LIMITS;
}

export function inspectLobbyCommandMatrix(): Readonly<Record<LobbyCommand, LobbyCommandRule>> {
  return LOBBY_COMMAND_MATRIX;
}

export function inspectLobbyMountMatrix(): Readonly<Record<LobbyMountSurface, LobbyMountRule>> {
  return LOBBY_MOUNT_MATRIX;
}

export function inspectLobbyRateWindows(): Readonly<Record<LobbyActorKind, LobbyRateWindow>> {
  return LOBBY_RATE_WINDOWS;
}

export function inspectLobbyNotificationHints(): Readonly<Record<LobbyMessageKind, LobbyNotificationHint>> {
  return LOBBY_NOTIFICATION_HINTS;
}

export function inspectLobbyTranscriptDispositions(): Readonly<Record<LobbyMessageKind, LobbyTranscriptDisposition>> {
  return LOBBY_TRANSCRIPT_DISPOSITIONS;
}

export function inspectLobbyShadowLaneDefaults(): Readonly<Record<LobbyMessageKind, LobbyShadowLane | null>> {
  return LOBBY_DEFAULT_SHADOW_LANE_BY_KIND;
}

export function inferLobbyStageMood(room: LobbyChannelState, nowMs: number): LobbyStageMood {
  return inferStageMood(room, nowMs);
}

export function inferLobbyAudienceHeatBand(room: LobbyChannelState): LobbyAudienceHeatBand {
  return inferAudienceHeatBand(room);
}

export function inferLobbyCountdownUrgency(room: LobbyChannelState, nowMs: number): LobbyCountdownUrgency {
  return computeCountdownUrgency(room, nowMs);
}

export function inferLobbyReadyPressure(room: LobbyChannelState, nowMs: number): LobbyReadyPressureBand {
  return computeReadyPressureBand(room, nowMs);
}

// ============================================================================
// MARK: Scenario fixtures
// ============================================================================

export const LOBBY_SCENARIO_1_SOCIAL_OPEN = {
  phase: 'open' as LobbyPhase,
  role: 'member' as LobbyRole,
  kind: 'PLAYER' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE.open.includes('PLAYER'),
  allowedByActor: LOBBY_ACTOR_MATRIX.player,
  expectedStageMood: 'social' as LobbyStageMood,
};

export const LOBBY_SCENARIO_2_READY_SIGNAL = {
  phase: 'ready_check' as LobbyPhase,
  role: 'member' as LobbyRole,
  kind: 'READY_STATE' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE.ready_check.includes('READY_STATE'),
  allowedByActor: LOBBY_ACTOR_MATRIX.player,
  expectedCounterplayDisposition: 'open_window' as LobbyCounterplayDisposition,
};

export const LOBBY_SCENARIO_3_COUNTDOWN_TAUNT = {
  phase: 'countdown' as LobbyPhase,
  actorKind: 'hater' as LobbyActorKind,
  kind: 'BOT_TAUNT' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE.countdown.includes('BOT_TAUNT'),
  allowedByActor: LOBBY_ACTOR_MATRIX.hater,
  suppressedWhenUrgencyCritical: true,
};

export const LOBBY_SCENARIO_4_HELPER_ONBOARD = {
  phase: 'open' as LobbyPhase,
  actorKind: 'helper' as LobbyActorKind,
  kind: 'HELPER_TIP' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE.open.includes('HELPER_TIP'),
  allowedByActor: LOBBY_ACTOR_MATRIX.helper,
  stageDirective: 'cold_start_helper' as LobbyStageDirectiveKind,
};

export const LOBBY_SCENARIO_5_POST_CANCEL_RESET = {
  phase: 'post_cancel' as LobbyPhase,
  role: 'host' as LobbyRole,
  kind: 'COMMAND' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE.post_cancel.includes('COMMAND'),
  allowedByActor: LOBBY_ACTOR_MATRIX.player,
  stageDirective: 'requeue_stabilize' as LobbyStageDirectiveKind,
};

export const LOBBY_SCENARIO_6_SPECTATOR_READ_ONLY = {
  phase: 'spectating' as LobbyPhase,
  role: 'spectator' as LobbyRole,
  kind: 'PLAYER' as LobbyMessageKind,
  allowedByRole: LOBBY_ROLE_MATRIX.spectator.includes('PLAYER'),
  expectedRejectionCode: 'SPECTATOR_READ_ONLY' as LobbyRejectionCode,
};

export const LOBBY_SCENARIO_7_LAUNCH_LOCK = {
  phase: 'launching' as LobbyPhase,
  actorKind: 'player' as LobbyActorKind,
  kind: 'PLAYER' as LobbyMessageKind,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE.launching.includes('PLAYER'),
  expectedRejectionCode: 'COUNTDOWN_LOCKED' as LobbyRejectionCode,
};

export const LOBBY_SCENARIO_8_PARTY_INVITE = {
  phase: 'matchmaking' as LobbyPhase,
  role: 'member' as LobbyRole,
  kind: 'PARTY_INVITE' as LobbyMessageKind,
  command: '/invite' as LobbyCommand,
  allowedByPhase: LOBBY_ALLOWED_BY_PHASE.matchmaking.includes('PARTY_INVITE'),
  allowedByCommand: LOBBY_COMMAND_MATRIX['/invite'].allowedPhases.includes('matchmaking'),
};
