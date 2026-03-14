
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT GLOBAL CHANNEL POLICY
 * FILE: backend/src/game/engine/chat/channels/GlobalChannelPolicy.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend policy authority for the GLOBAL chat lane.
 *
 * Backend-truth question
 * ----------------------
 *   "Given a candidate GLOBAL-channel chat action, what is the authoritative
 *    backend decision about admission, visibility, transcript handling,
 *    notification, witness amplification, and policy routing?"
 *
 * GLOBAL is not a cosmetic tab. It is the public theater of the run:
 * - where system truth becomes social witness,
 * - where haters pressure the player in the open,
 * - where helpers sometimes intervene publicly,
 * - where crowd mood and reputational heat become visible,
 * - and where proof-bearing run moments can become legend.
 *
 * Repo-grounded doctrine preserved here
 * -------------------------------------
 * - Donor router truth from the old frontend lane: GLOBAL is available in the
 *   four primary run modes and accepts player, bot, NPC, system, and helper
 *   traffic.
 * - Donor chat engine logic already treats GLOBAL as an event witness lane for
 *   shield breaches, pressure spikes, bot aggression, collapse risk, and major
 *   run moments.
 * - Backend chat must not mirror frontend optimism. It must decide what enters
 *   transcript truth, what is deferred, what is suppressed, and what is only
 *   witnessed as a lower-visibility event.
 *
 * This file owns
 * --------------
 * - mode availability law for GLOBAL,
 * - participant/channel admission for GLOBAL,
 * - ingress decisions for player/system/helper/hater/NPC/crowd messages,
 * - rate, heat, spectacle, and visibility shaping,
 * - transcript disposition and witness amplification,
 * - feed layout guidance consumed by backend chat orchestration,
 * - structured reasons suitable for replay, telemetry, and inspection.
 *
 * This file does not own
 * ----------------------
 * - socket admission,
 * - moderation redaction implementation,
 * - transcript mutation,
 * - NPC line generation,
 * - invasion start/stop truth,
 * - learning profile persistence,
 * - or frontend rendering.
 *
 * Design laws
 * -----------
 * - GLOBAL should almost always exist, but it should not always be equally loud.
 * - Not every truth deserves a spotlight.
 * - Public spectacle must still respect transcript discipline.
 * - Proof-bearing moments may escalate visibility, but never bypass policy.
 * - Helper presence is allowed, but helper spam is not.
 * - Hater pressure is allowed, but incoherent noise storms are not.
 * - Public mood can amplify a message, yet mode identity still matters.
 * ============================================================================
 */

// ============================================================================
// Narrow scalar aliases
// ============================================================================

export type GlobalChannelId = 'GLOBAL';

export type GlobalRunMode =
  | 'solo'
  | 'asymmetric-pvp'
  | 'co-op'
  | 'ghost';

export type GlobalModeFamily =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM';

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
  | 'CHAT_DRAWER'
  | 'UNKNOWN';

export type GlobalSpeakerClass =
  | 'PLAYER'
  | 'SYSTEM'
  | 'HATER'
  | 'HELPER'
  | 'NPC'
  | 'CROWD'
  | 'MODERATOR'
  | 'SPECTATOR'
  | 'REPLAY_AGENT';

export type GlobalMessageKind =
  | 'PLAYER'
  | 'PLAYER_RESPONSE'
  | 'SYSTEM'
  | 'MARKET_ALERT'
  | 'SHIELD_EVENT'
  | 'CASCADE_ALERT'
  | 'ACHIEVEMENT'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK'
  | 'HELPER_TIP'
  | 'RUN_NOTICE'
  | 'RUN_OUTCOME'
  | 'INVASION'
  | 'CROWD_SWELL'
  | 'DEAL_RECAP'
  | 'PROOF_WITNESS'
  | 'COUNTER_INTEL'
  | 'PRESSURE_WITNESS'
  | 'REPUTATION_WITNESS'
  | 'MODE_WITNESS';

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

export type GlobalAudienceHeatBand =
  | 'COLD'
  | 'WARM'
  | 'HOT'
  | 'FEVER'
  | 'PANIC';

export type GlobalCrowdMood =
  | 'NEUTRAL'
  | 'CURIOUS'
  | 'AMPLIFYING'
  | 'MOCKING'
  | 'PREDATORY'
  | 'REVERENT'
  | 'PANICKED';

export type GlobalSeverity =
  | 'TRACE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'EXTREME';

export type GlobalAdmissionDecision =
  | 'ALLOW'
  | 'DEFER'
  | 'SUPPRESS'
  | 'REROUTE'
  | 'SHADOW_ONLY';

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
  | 'ESCALATION_BANNER';

export type GlobalTranscriptDisposition =
  | 'APPEND'
  | 'APPEND_MUTED'
  | 'APPEND_LEGEND'
  | 'SHADOW_LEDGER'
  | 'DROP';

export type GlobalWitnessAmplifier =
  | 'NONE'
  | 'CROWD'
  | 'HELPER'
  | 'SYSTEM'
  | 'CROWD_AND_SYSTEM'
  | 'LEGEND';

export type GlobalRoomStageMood =
  | 'QUIET'
  | 'TENSE'
  | 'HOT'
  | 'OVERLOADED'
  | 'AFTERMATH';

export type GlobalFeatureDensity =
  | 'DENSE'
  | 'STANDARD'
  | 'EXPANDED';

export type GlobalReasonCode =
  | 'MODE_ALLOWED'
  | 'MODE_BLOCKED'
  | 'CHANNEL_HEALTH_DEGRADED'
  | 'CHANNEL_LOCKED'
  | 'RATE_ALLOW'
  | 'RATE_DEFER'
  | 'RATE_SUPPRESS'
  | 'KIND_ALLOWED'
  | 'KIND_BLOCKED'
  | 'ACTOR_ALLOWED'
  | 'ACTOR_BLOCKED'
  | 'PUBLIC_WITNESS'
  | 'PUBLIC_NOISE_SUPPRESSED'
  | 'HELPER_ALLOWED'
  | 'HELPER_DEFERRED'
  | 'HATER_ALLOWED'
  | 'HATER_DEFERRED'
  | 'HATER_SUPPRESSED'
  | 'LEGEND_ELEVATION'
  | 'PROOF_WITNESS'
  | 'CROWD_HEAT_LOW'
  | 'CROWD_HEAT_HIGH'
  | 'CROWD_HEAT_PANIC'
  | 'SURFACE_MUTED'
  | 'SURFACE_EXPANDED'
  | 'PRESSURE_ELEVATED'
  | 'PRESSURE_CRITICAL'
  | 'TICK_COLLAPSE'
  | 'REPLAY_SYNC'
  | 'READ_ONLY_WINDOW'
  | 'MODERATION_QUARANTINE'
  | 'TRANSPORT_DEGRADED'
  | 'BACKPRESSURE'
  | 'INVISIBILITY'
  | 'ALREADY_SPOTLIT'
  | 'CHANNEL_POLICY_SCORE';

// ============================================================================
// Core source-facing contracts
// ============================================================================

export interface GlobalActorRef {
  id: string;
  displayName: string;
  speakerClass: GlobalSpeakerClass;
  isLocalPlayer?: boolean;
  isSpectator?: boolean;
  isTrustedSystem?: boolean;
  isMuted?: boolean;
  teamId?: string | null;
  factionId?: string | null;
  botId?: string | null;
  helperId?: string | null;
  npcId?: string | null;
}

export interface GlobalMessageEnvelope {
  id: string;
  channel: GlobalChannelId;
  kind: GlobalMessageKind;
  body: string;
  ts: number;
  actor: GlobalActorRef;
  proofHash?: string | null;
  immutable?: boolean;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  metadata?: Record<string, unknown> | null;
}

export interface GlobalGameplayState {
  runId: string | null;
  seed: string | number | null;
  tick: number;
  totalTicks?: number | null;
  roundNumber?: number | null;
  totalRounds?: number | null;
  runMode: GlobalRunMode;
  modeFamily?: GlobalModeFamily | null;
  cash?: number | null;
  netWorth?: number | null;
  income?: number | null;
  expenses?: number | null;
  pressureTier?: GlobalPressureTier | null;
  tickTier?: GlobalTickTier | null;
  haterHeat?: number | null;
  localScore?: number | null;
  opponentScore?: number | null;
  activeThreatCardCount?: number | null;
  freezeTicks?: number | null;
  sabotageIntensity?: number | null;
  rescueWindowOpen?: boolean;
  sovereigntyWindowOpen?: boolean;
  nearBankruptcy?: boolean;
  collapseRisk?: number | null;
}

export interface GlobalSurfaceContext {
  activeSurface: GlobalMountSurface;
  visibleSurfaces: GlobalMountSurface[];
  chatDockOpen: boolean;
  chatFocused: boolean;
  drawerOpen?: boolean;
  collapsed?: boolean;
  tabActive?: boolean;
}

export interface GlobalAudienceState {
  heat: number;
  heatBand?: GlobalAudienceHeatBand | null;
  crowdMood?: GlobalCrowdMood | null;
  spectators: number;
  ridiculeLikelihood: number;
  reverenceLikelihood: number;
  swarmLikelihood: number;
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

export interface GlobalModerationSnapshot {
  actorShadowMuted?: boolean;
  actorHardMuted?: boolean;
  actorQuarantined?: boolean;
  bodyFlagged?: boolean;
  bodyRiskScore?: number;
}

export interface GlobalRoomState {
  roomId: string;
  occupancy: number;
  stageMood?: GlobalRoomStageMood | null;
  spotlightMessageIds?: string[];
  lastLegendAt?: number | null;
  lastSystemBroadcastAt?: number | null;
  lastHelperBroadcastAt?: number | null;
  lastHaterBroadcastAt?: number | null;
}

export interface GlobalInvasionState {
  active: boolean;
  invasionId?: string | null;
  severity?: GlobalSeverity | null;
  shadowFirst?: boolean;
  startedAt?: number | null;
  expectedEndAt?: number | null;
}

export interface GlobalPolicyInput {
  message: GlobalMessageEnvelope;
  gameplay: GlobalGameplayState;
  surface: GlobalSurfaceContext;
  audience: GlobalAudienceState;
  rate: GlobalRateState;
  health: GlobalChannelHealth;
  moderation?: GlobalModerationSnapshot | null;
  room?: GlobalRoomState | null;
  invasion?: GlobalInvasionState | null;
}

export interface GlobalChannelSnapshotInput {
  gameplay: GlobalGameplayState;
  surface: GlobalSurfaceContext;
  audience: GlobalAudienceState;
  health: GlobalChannelHealth;
  room?: GlobalRoomState | null;
}

// ============================================================================
// Structured outputs
// ============================================================================

export interface GlobalPolicyReason {
  code: GlobalReasonCode;
  detail: string;
  weight: number;
}

export interface GlobalFeatureLayout {
  feedDensity: GlobalFeatureDensity;
  maxVisibleMessages: number;
  shouldShowPresenceStrip: boolean;
  shouldShowThreatMeter: boolean;
  shouldShowInvasionBanner: boolean;
  shouldShowHelperPrompt: boolean;
  shouldShowTranscriptDrawerShortcut: boolean;
  shouldShowProofSummary: boolean;
  shouldUseSpotlightCard: boolean;
}

export interface GlobalComposeCapability {
  canCompose: boolean;
  canReplyToSystem: boolean;
  canCounterTaunt: boolean;
  canDropProofClaim: boolean;
  maxBodyLength: number;
  reasons: GlobalPolicyReason[];
}

export interface GlobalIngressDecision {
  decision: GlobalAdmissionDecision;
  visibility: GlobalVisibilityBand;
  notification: GlobalNotificationHint;
  transcript: GlobalTranscriptDisposition;
  amplifier: GlobalWitnessAmplifier;
  score: number;
  shouldPersistInTranscript: boolean;
  shouldFeatureInFeed: boolean;
  shouldAnimateBanner: boolean;
  shouldEscalateAudienceHeat: boolean;
  shouldMirrorToInvasionOrchestrator: boolean;
  shouldMirrorToNpcOrchestrator: boolean;
  shouldMirrorToTelemetry: boolean;
  shouldRequestHelperFollowup: boolean;
  shouldRequestCrowdFollowup: boolean;
  shouldOpenCollapsedPill: boolean;
  deferForMs?: number;
  rerouteChannel?: string;
  reasons: GlobalPolicyReason[];
}

export interface GlobalRecommendation {
  id: string;
  priority: number;
  title: string;
  detail: string;
  kind:
    | 'OPEN_CHAT'
    | 'PIN_SYSTEM_NOTICE'
    | 'DEFER_HATER'
    | 'SHOW_HELPER'
    | 'MUTE_CROWD'
    | 'RATE_LIMIT_ENFORCE'
    | 'COLLAPSE_WITNESS'
    | 'COMEBACK_WITNESS'
    | 'PROOF_SPOTLIGHT';
}

export interface GlobalChannelSnapshot {
  channel: GlobalChannelId;
  available: boolean;
  runMode: GlobalRunMode;
  modeFamily: GlobalModeFamily;
  audienceHeatBand: GlobalAudienceHeatBand;
  crowdMood: GlobalCrowdMood;
  compose: GlobalComposeCapability;
  layout: GlobalFeatureLayout;
  recommendations: GlobalRecommendation[];
  reasons: GlobalPolicyReason[];
}

// ============================================================================
// Options and manifest
// ============================================================================

export interface GlobalChannelPolicyOptions {
  defaultMaxBodyLength?: number;
  spotlightCooldownMs?: number;
  helperPublicCooldownMs?: number;
  haterPublicCooldownMs?: number;
  allowSpectatorPosting?: boolean;
  allowReplayAgentPosting?: boolean;
}

export interface GlobalChannelPolicyManifest {
  id: GlobalChannelId;
  version: string;
  allowedModes: GlobalRunMode[];
  proofWitnessKinds: GlobalMessageKind[];
  legendEligibleKinds: GlobalMessageKind[];
  helperKinds: GlobalMessageKind[];
  haterKinds: GlobalMessageKind[];
}

// ============================================================================
// Canonical constants
// ============================================================================

export const GLOBAL_CHANNEL_ID: GlobalChannelId = 'GLOBAL';

export const GLOBAL_ALLOWED_MODES: readonly GlobalRunMode[] = [
  'solo',
  'asymmetric-pvp',
  'co-op',
  'ghost',
] as const;

export const GLOBAL_MODE_FAMILY_MAP: Readonly<Record<GlobalRunMode, GlobalModeFamily>> = {
  solo: 'EMPIRE',
  'asymmetric-pvp': 'PREDATOR',
  'co-op': 'SYNDICATE',
  ghost: 'PHANTOM',
};

export const GLOBAL_ALLOWED_PLAYER_KINDS: readonly GlobalMessageKind[] = [
  'PLAYER',
  'PLAYER_RESPONSE',
  'PROOF_WITNESS',
] as const;

export const GLOBAL_ALLOWED_SYSTEM_KINDS: readonly GlobalMessageKind[] = [
  'SYSTEM',
  'MARKET_ALERT',
  'SHIELD_EVENT',
  'CASCADE_ALERT',
  'ACHIEVEMENT',
  'RUN_NOTICE',
  'RUN_OUTCOME',
  'PRESSURE_WITNESS',
  'REPUTATION_WITNESS',
  'MODE_WITNESS',
] as const;

export const GLOBAL_ALLOWED_HATER_KINDS: readonly GlobalMessageKind[] = [
  'BOT_TAUNT',
  'BOT_ATTACK',
  'INVASION',
] as const;

export const GLOBAL_ALLOWED_HELPER_KINDS: readonly GlobalMessageKind[] = [
  'HELPER_TIP',
  'COUNTER_INTEL',
] as const;

export const GLOBAL_ALLOWED_NPC_KINDS: readonly GlobalMessageKind[] = [
  'CROWD_SWELL',
  'DEAL_RECAP',
  'MODE_WITNESS',
  'PRESSURE_WITNESS',
] as const;

export const GLOBAL_PROOF_WITNESS_KINDS: readonly GlobalMessageKind[] = [
  'PROOF_WITNESS',
  'ACHIEVEMENT',
  'RUN_OUTCOME',
  'DEAL_RECAP',
] as const;

export const GLOBAL_LEGEND_ELIGIBLE_KINDS: readonly GlobalMessageKind[] = [
  'RUN_OUTCOME',
  'ACHIEVEMENT',
  'PROOF_WITNESS',
  'INVASION',
  'BOT_ATTACK',
] as const;

export const GLOBAL_SURFACE_WEIGHTS: Readonly<Record<GlobalMountSurface, number>> = {
  BATTLE_HUD: 1.0,
  GAME_BOARD: 0.9,
  LOBBY_SCREEN: 0.75,
  EMPIRE_SCREEN: 0.85,
  PREDATOR_SCREEN: 0.85,
  SYNDICATE_SCREEN: 0.9,
  PHANTOM_SCREEN: 0.85,
  CLUB_UI: 0.7,
  LEAGUE_UI: 0.7,
  COUNTERPLAY_MODAL: 0.6,
  EMPIRE_BLEED_BANNER: 0.55,
  MOMENT_FLASH: 0.65,
  PROOF_CARD: 0.75,
  PROOF_CARD_V2: 0.8,
  RESCUE_WINDOW_BANNER: 0.55,
  SABOTAGE_IMPACT_PANEL: 0.6,
  THREAT_RADAR_PANEL: 0.7,
  CHAT_DRAWER: 1.0,
  UNKNOWN: 0.5,
};

export const GLOBAL_KIND_BASE_SCORE: Readonly<Record<GlobalMessageKind, number>> = {
  PLAYER: 0.56,
  PLAYER_RESPONSE: 0.58,
  SYSTEM: 0.62,
  MARKET_ALERT: 0.66,
  SHIELD_EVENT: 0.72,
  CASCADE_ALERT: 0.78,
  ACHIEVEMENT: 0.84,
  BOT_TAUNT: 0.54,
  BOT_ATTACK: 0.73,
  HELPER_TIP: 0.61,
  RUN_NOTICE: 0.6,
  RUN_OUTCOME: 0.91,
  INVASION: 0.81,
  CROWD_SWELL: 0.55,
  DEAL_RECAP: 0.67,
  PROOF_WITNESS: 0.83,
  COUNTER_INTEL: 0.64,
  PRESSURE_WITNESS: 0.69,
  REPUTATION_WITNESS: 0.66,
  MODE_WITNESS: 0.61,
};

export const GLOBAL_KIND_HEAT_IMPACT: Readonly<Record<GlobalMessageKind, number>> = {
  PLAYER: 0.01,
  PLAYER_RESPONSE: 0.015,
  SYSTEM: 0.02,
  MARKET_ALERT: 0.03,
  SHIELD_EVENT: 0.04,
  CASCADE_ALERT: 0.07,
  ACHIEVEMENT: 0.08,
  BOT_TAUNT: 0.03,
  BOT_ATTACK: 0.06,
  HELPER_TIP: -0.01,
  RUN_NOTICE: 0.01,
  RUN_OUTCOME: 0.09,
  INVASION: 0.09,
  CROWD_SWELL: 0.025,
  DEAL_RECAP: 0.03,
  PROOF_WITNESS: 0.05,
  COUNTER_INTEL: 0.01,
  PRESSURE_WITNESS: 0.04,
  REPUTATION_WITNESS: 0.03,
  MODE_WITNESS: 0.02,
};

export const GLOBAL_RATE_LIMITS = {
  trailing10sHardCap: 10,
  trailing30sHardCap: 24,
  trailing60sHardCap: 42,
  trailing5mHardCap: 160,
  sameActor30sHardCap: 8,
  sameKind30sHardCap: 10,
  sameFingerprint60sHardCap: 3,
  baseDeferMs: 1600,
  panicDeferMs: 3200,
};

export const GLOBAL_DEFAULT_OPTIONS: Required<GlobalChannelPolicyOptions> = {
  defaultMaxBodyLength: 500,
  spotlightCooldownMs: 12000,
  helperPublicCooldownMs: 7000,
  haterPublicCooldownMs: 4500,
  allowSpectatorPosting: false,
  allowReplayAgentPosting: false,
};

export const GLOBAL_MANIFEST: GlobalChannelPolicyManifest = {
  id: GLOBAL_CHANNEL_ID,
  version: '2026.03.14',
  allowedModes: [...GLOBAL_ALLOWED_MODES],
  proofWitnessKinds: [...GLOBAL_PROOF_WITNESS_KINDS],
  legendEligibleKinds: [...GLOBAL_LEGEND_ELIGIBLE_KINDS],
  helperKinds: [...GLOBAL_ALLOWED_HELPER_KINDS],
  haterKinds: [...GLOBAL_ALLOWED_HATER_KINDS],
};

// ============================================================================
// Utility helpers
// ============================================================================

function clamp01(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function coalesceModeFamily(mode: GlobalRunMode, family?: GlobalModeFamily | null): GlobalModeFamily {
  return family ?? GLOBAL_MODE_FAMILY_MAP[mode];
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

function bodyFingerprint(body: string): string {
  const normalized = normalizeBody(body).toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `gfp_${Math.abs(hash >>> 0).toString(36)}`;
}

function includesKind(list: readonly GlobalMessageKind[], kind: GlobalMessageKind): boolean {
  return list.includes(kind);
}

function includesMode(list: readonly GlobalRunMode[], mode: GlobalRunMode): boolean {
  return list.includes(mode);
}

function pushReason(
  bucket: GlobalPolicyReason[],
  code: GlobalReasonCode,
  detail: string,
  weight: number,
): void {
  bucket.push({ code, detail, weight });
}

function stageMoodFromInput(input: GlobalPolicyInput): GlobalRoomStageMood {
  if (input.room?.stageMood) return input.room.stageMood;
  if (input.health.localBackpressure) return 'OVERLOADED';
  if (input.invasion?.active) return 'HOT';
  if (input.gameplay.collapseRisk && input.gameplay.collapseRisk >= 0.75) return 'TENSE';
  return 'QUIET';
}

function computeAudienceHeatBand(audience: GlobalAudienceState): GlobalAudienceHeatBand {
  if (audience.heatBand) return audience.heatBand;
  const heat = clamp01(audience.heat);
  if (heat >= 0.9) return 'PANIC';
  if (heat >= 0.72) return 'FEVER';
  if (heat >= 0.48) return 'HOT';
  if (heat >= 0.2) return 'WARM';
  return 'COLD';
}

function computeCrowdMood(
  audience: GlobalAudienceState,
  gameplay: GlobalGameplayState,
): GlobalCrowdMood {
  if (audience.crowdMood) return audience.crowdMood;
  const heatBand = computeAudienceHeatBand(audience);
  if (gameplay.sovereigntyWindowOpen) return 'REVERENT';
  if (gameplay.collapseRisk && gameplay.collapseRisk >= 0.8) return 'PANICKED';
  if (heatBand === 'PANIC') return 'PANICKED';
  if (heatBand === 'FEVER' && audience.ridiculeLikelihood >= 0.55) return 'MOCKING';
  if (heatBand === 'FEVER') return 'AMPLIFYING';
  if (heatBand === 'HOT') return 'CURIOUS';
  return 'NEUTRAL';
}

function computePressureTier(gameplay: GlobalGameplayState): GlobalPressureTier {
  if (gameplay.pressureTier) return gameplay.pressureTier;
  const collapseRisk = clamp01(safeNumber(gameplay.collapseRisk, 0));
  if (collapseRisk >= 0.88) return 'CRITICAL';
  if (collapseRisk >= 0.66) return 'HIGH';
  if (collapseRisk >= 0.42) return 'ELEVATED';
  if (collapseRisk >= 0.2) return 'BUILDING';
  return 'CALM';
}

function computeTickTier(gameplay: GlobalGameplayState): GlobalTickTier {
  if (gameplay.tickTier) return gameplay.tickTier;
  if (gameplay.sovereigntyWindowOpen) return 'SOVEREIGN';
  if (gameplay.freezeTicks && gameplay.freezeTicks > 0) return 'CRISIS';
  if (gameplay.collapseRisk && gameplay.collapseRisk >= 0.9) return 'COLLAPSE_IMMINENT';
  if (gameplay.activeThreatCardCount && gameplay.activeThreatCardCount >= 4) return 'COMPRESSED';
  return 'STABLE';
}

function isLegendCandidate(input: GlobalPolicyInput): boolean {
  if (!includesKind(GLOBAL_LEGEND_ELIGIBLE_KINDS, input.message.kind)) return false;
  if (input.message.proofHash) return true;
  if (input.gameplay.sovereigntyWindowOpen) return true;
  if (input.gameplay.collapseRisk && input.gameplay.collapseRisk >= 0.9) return true;
  return false;
}

function isProofWitness(input: GlobalPolicyInput): boolean {
  return Boolean(
    input.message.proofHash ||
    includesKind(GLOBAL_PROOF_WITNESS_KINDS, input.message.kind),
  );
}

function isSystemActor(actor: GlobalActorRef): boolean {
  return actor.speakerClass === 'SYSTEM' || Boolean(actor.isTrustedSystem);
}

function isHelperActor(actor: GlobalActorRef): boolean {
  return actor.speakerClass === 'HELPER';
}

function isHaterActor(actor: GlobalActorRef): boolean {
  return actor.speakerClass === 'HATER';
}

function isCrowdActor(actor: GlobalActorRef): boolean {
  return actor.speakerClass === 'CROWD';
}

function isPlayerActor(actor: GlobalActorRef): boolean {
  return actor.speakerClass === 'PLAYER';
}

function baseComposeReasons(gameplay: GlobalGameplayState): GlobalPolicyReason[] {
  const reasons: GlobalPolicyReason[] = [];
  pushReason(reasons, 'MODE_ALLOWED', `GLOBAL compose allowed in ${gameplay.runMode}`, 0.5);
  return reasons;
}

// ============================================================================
// Policy core
// ============================================================================

export class GlobalChannelPolicy {
  private readonly options: Required<GlobalChannelPolicyOptions>;

  public constructor(options: GlobalChannelPolicyOptions = {}) {
    this.options = {
      ...GLOBAL_DEFAULT_OPTIONS,
      ...options,
    };
  }

  public getChannelId(): GlobalChannelId {
    return GLOBAL_CHANNEL_ID;
  }

  public getManifest(): GlobalChannelPolicyManifest {
    return {
      ...GLOBAL_MANIFEST,
      allowedModes: [...GLOBAL_MANIFEST.allowedModes],
      proofWitnessKinds: [...GLOBAL_MANIFEST.proofWitnessKinds],
      legendEligibleKinds: [...GLOBAL_MANIFEST.legendEligibleKinds],
      helperKinds: [...GLOBAL_MANIFEST.helperKinds],
      haterKinds: [...GLOBAL_MANIFEST.haterKinds],
    };
  }

  public isAvailableInMode(mode: GlobalRunMode): boolean {
    return includesMode(GLOBAL_ALLOWED_MODES, mode);
  }

  public evaluateComposeCapability(
    gameplay: GlobalGameplayState,
    health: GlobalChannelHealth,
  ): GlobalComposeCapability {
    const reasons = baseComposeReasons(gameplay);
    let canCompose = this.isAvailableInMode(gameplay.runMode);
    let maxBodyLength = this.options.defaultMaxBodyLength;
    let canReplyToSystem = true;
    let canCounterTaunt = true;
    let canDropProofClaim = true;

    if (health.readOnlyWindow) {
      canCompose = false;
      canReplyToSystem = false;
      canCounterTaunt = false;
      canDropProofClaim = false;
      pushReason(reasons, 'READ_ONLY_WINDOW', 'GLOBAL is in read-only window', -0.9);
    }

    if (health.moderationLock) {
      canCompose = false;
      canReplyToSystem = false;
      canCounterTaunt = false;
      canDropProofClaim = false;
      pushReason(reasons, 'MODERATION_QUARANTINE', 'moderation lock active', -1);
    }

    if (health.localBackpressure) {
      maxBodyLength = Math.min(maxBodyLength, 280);
      pushReason(reasons, 'BACKPRESSURE', 'body length compressed under backpressure', -0.28);
    }

    if (gameplay.runMode === 'ghost') {
      canDropProofClaim = false;
      pushReason(reasons, 'INVISIBILITY', 'ghost mode suppresses proof-claim theatrics', -0.2);
    }

    return {
      canCompose,
      canReplyToSystem,
      canCounterTaunt,
      canDropProofClaim,
      maxBodyLength,
      reasons,
    };
  }

  public evaluateIngress(input: GlobalPolicyInput): GlobalIngressDecision {
    const reasons: GlobalPolicyReason[] = [];
    const audienceHeatBand = computeAudienceHeatBand(input.audience);
    const crowdMood = computeCrowdMood(input.audience, input.gameplay);
    const pressureTier = computePressureTier(input.gameplay);
    const tickTier = computeTickTier(input.gameplay);
    const roomStage = stageMoodFromInput(input);
    const baseScore = GLOBAL_KIND_BASE_SCORE[input.message.kind] ?? 0.5;
    let score = baseScore;

    if (!this.isAvailableInMode(input.gameplay.runMode)) {
      pushReason(reasons, 'MODE_BLOCKED', `GLOBAL unavailable in ${input.gameplay.runMode}`, -1);
      return this.buildSuppressedDecision(score, reasons);
    }

    pushReason(reasons, 'MODE_ALLOWED', `GLOBAL available in ${input.gameplay.runMode}`, 0.35);

    if (input.health.moderationLock) {
      pushReason(reasons, 'MODERATION_QUARANTINE', 'moderation lock active', -1);
      return this.buildSuppressedDecision(score, reasons);
    }

    if (input.health.readOnlyWindow && isPlayerActor(input.message.actor)) {
      pushReason(reasons, 'READ_ONLY_WINDOW', 'player writes blocked during read-only window', -0.9);
      return this.buildDeferredDecision(score, reasons, GLOBAL_RATE_LIMITS.baseDeferMs);
    }

    const actorDecision = this.evaluateActor(input, reasons);
    if (!actorDecision.allowed) {
      return this.buildSuppressedDecision(score + actorDecision.scoreDelta, reasons);
    }
    score += actorDecision.scoreDelta;

    const kindDecision = this.evaluateKind(input, reasons);
    if (!kindDecision.allowed) {
      return this.buildSuppressedDecision(score + kindDecision.scoreDelta, reasons);
    }
    score += kindDecision.scoreDelta;

    const rateDecision = this.evaluateRate(input, reasons, audienceHeatBand, roomStage);
    if (rateDecision.decision === 'SUPPRESS') {
      return this.buildSuppressedDecision(score + rateDecision.scoreDelta, reasons);
    }
    if (rateDecision.decision === 'DEFER') {
      return this.buildDeferredDecision(
        score + rateDecision.scoreDelta,
        reasons,
        rateDecision.deferForMs ?? GLOBAL_RATE_LIMITS.baseDeferMs,
      );
    }
    score += rateDecision.scoreDelta;

    const moderationDecision = this.evaluateModeration(input, reasons);
    if (moderationDecision.decision === 'SUPPRESS') {
      return this.buildSuppressedDecision(score + moderationDecision.scoreDelta, reasons);
    }
    score += moderationDecision.scoreDelta;

    if (pressureTier === 'CRITICAL') {
      score += 0.07;
      pushReason(reasons, 'PRESSURE_CRITICAL', 'critical pressure elevates public witness', 0.25);
    } else if (pressureTier === 'HIGH' || pressureTier === 'ELEVATED') {
      score += 0.03;
      pushReason(reasons, 'PRESSURE_ELEVATED', 'elevated pressure slightly raises witness weight', 0.15);
    }

    if (tickTier === 'COLLAPSE_IMMINENT') {
      score += 0.06;
      pushReason(reasons, 'TICK_COLLAPSE', 'collapse-imminent tick deserves stronger witness', 0.18);
    }

    if (isProofWitness(input)) {
      score += 0.05;
      pushReason(reasons, 'PROOF_WITNESS', 'proof-bearing event receives higher transcript priority', 0.22);
    }

    if (isLegendCandidate(input)) {
      score += 0.08;
      pushReason(reasons, 'LEGEND_ELEVATION', 'legend candidate elevated for public witness', 0.3);
    }

    if (input.health.degradedTransport) {
      score -= 0.04;
      pushReason(reasons, 'TRANSPORT_DEGRADED', 'transport degraded; witness softened', -0.12);
    }

    if (input.health.replaySyncInProgress) {
      score -= 0.02;
      pushReason(reasons, 'REPLAY_SYNC', 'replay sync in progress; favor stability', -0.08);
    }

    if (input.health.localBackpressure) {
      score -= 0.03;
      pushReason(reasons, 'BACKPRESSURE', 'local backpressure lowers visibility ambitions', -0.1);
    }

    const visibility = this.resolveVisibility(input, reasons, score, audienceHeatBand, crowdMood);
    const notification = this.resolveNotification(input, visibility, audienceHeatBand);
    const transcript = this.resolveTranscript(input, visibility);
    const amplifier = this.resolveAmplifier(input, visibility, crowdMood, audienceHeatBand);

    const shouldPersistInTranscript = transcript !== 'DROP';
    const shouldFeatureInFeed = visibility !== 'MUTED';
    const shouldAnimateBanner =
      visibility === 'SPOTLIGHT' ||
      visibility === 'LEGEND' ||
      notification === 'ESCALATION_BANNER';
    const shouldEscalateAudienceHeat =
      GLOBAL_KIND_HEAT_IMPACT[input.message.kind] > 0.03 ||
      visibility === 'SPOTLIGHT' ||
      visibility === 'LEGEND';
    const shouldMirrorToInvasionOrchestrator =
      input.message.kind === 'INVASION' ||
      (isHaterActor(input.message.actor) && pressureTier !== 'CALM');
    const shouldMirrorToNpcOrchestrator =
      isHelperActor(input.message.actor) ||
      isHaterActor(input.message.actor) ||
      isCrowdActor(input.message.actor);
    const shouldMirrorToTelemetry = true;
    const shouldRequestHelperFollowup =
      !isHelperActor(input.message.actor) &&
      (input.gameplay.rescueWindowOpen || pressureTier === 'CRITICAL') &&
      visibility !== 'MUTED';
    const shouldRequestCrowdFollowup =
      shouldEscalateAudienceHeat &&
      !isCrowdActor(input.message.actor) &&
      audienceHeatBand !== 'COLD';
    const shouldOpenCollapsedPill =
      Boolean(input.surface.collapsed) &&
      (visibility === 'FEATURED' || visibility === 'SPOTLIGHT' || visibility === 'LEGEND');

    score = clamp01(score);

    pushReason(reasons, 'CHANNEL_POLICY_SCORE', `final GLOBAL score=${score.toFixed(3)}`, score);

    return {
      decision: 'ALLOW',
      visibility,
      notification,
      transcript,
      amplifier,
      score,
      shouldPersistInTranscript,
      shouldFeatureInFeed,
      shouldAnimateBanner,
      shouldEscalateAudienceHeat,
      shouldMirrorToInvasionOrchestrator,
      shouldMirrorToNpcOrchestrator,
      shouldMirrorToTelemetry,
      shouldRequestHelperFollowup,
      shouldRequestCrowdFollowup,
      shouldOpenCollapsedPill,
      reasons,
    };
  }

  public evaluateSnapshot(input: GlobalChannelSnapshotInput): GlobalChannelSnapshot {
    const modeFamily = coalesceModeFamily(input.gameplay.runMode, input.gameplay.modeFamily ?? null);
    const audienceHeatBand = computeAudienceHeatBand(input.audience);
    const crowdMood = computeCrowdMood(input.audience, input.gameplay);
    const reasons: GlobalPolicyReason[] = [];

    if (this.isAvailableInMode(input.gameplay.runMode)) {
      pushReason(reasons, 'MODE_ALLOWED', `GLOBAL mounted for ${input.gameplay.runMode}`, 0.4);
    } else {
      pushReason(reasons, 'MODE_BLOCKED', `GLOBAL unavailable for ${input.gameplay.runMode}`, -1);
    }

    if (input.health.localBackpressure) {
      pushReason(reasons, 'BACKPRESSURE', 'layout compressed under backpressure', -0.2);
    }

    const compose = this.evaluateComposeCapability(input.gameplay, input.health);
    const layout = this.resolveFeatureLayout(
      input.gameplay,
      input.surface,
      input.audience,
      input.health,
    );

    const recommendations: GlobalRecommendation[] = this.buildRecommendations(
      input.gameplay,
      input.surface,
      input.audience,
      input.health,
      input.room ?? null,
    );

    return {
      channel: GLOBAL_CHANNEL_ID,
      available: this.isAvailableInMode(input.gameplay.runMode),
      runMode: input.gameplay.runMode,
      modeFamily,
      audienceHeatBand,
      crowdMood,
      compose,
      layout,
      recommendations,
      reasons,
    };
  }

  public explainAvailability(mode: GlobalRunMode): GlobalPolicyReason[] {
    const reasons: GlobalPolicyReason[] = [];
    if (this.isAvailableInMode(mode)) {
      pushReason(reasons, 'MODE_ALLOWED', `GLOBAL available in ${mode}`, 0.5);
    } else {
      pushReason(reasons, 'MODE_BLOCKED', `GLOBAL unavailable in ${mode}`, -1);
    }
    return reasons;
  }

  public createDefaultSnapshotInput(mode: GlobalRunMode): GlobalChannelSnapshotInput {
    return {
      gameplay: {
        runId: null,
        seed: null,
        tick: 0,
        runMode: mode,
      },
      surface: {
        activeSurface: 'UNKNOWN',
        visibleSurfaces: ['UNKNOWN'],
        chatDockOpen: true,
        chatFocused: false,
      },
      audience: {
        heat: 0.15,
        spectators: 0,
        ridiculeLikelihood: 0.2,
        reverenceLikelihood: 0.1,
        swarmLikelihood: 0.12,
      },
      health: {
        degradedTransport: false,
        moderationLock: false,
        readOnlyWindow: false,
        replaySyncInProgress: false,
        localBackpressure: false,
      },
      room: null,
    };
  }

  private evaluateActor(
    input: GlobalPolicyInput,
    reasons: GlobalPolicyReason[],
  ): { allowed: boolean; scoreDelta: number } {
    const actor = input.message.actor;

    if (actor.isMuted || input.moderation?.actorHardMuted) {
      pushReason(reasons, 'ACTOR_BLOCKED', 'actor hard-muted in GLOBAL', -1);
      return { allowed: false, scoreDelta: -0.4 };
    }

    if (input.moderation?.actorQuarantined) {
      pushReason(reasons, 'MODERATION_QUARANTINE', 'actor quarantined; GLOBAL suppressed', -1);
      return { allowed: false, scoreDelta: -0.5 };
    }

    if (actor.isSpectator && !this.options.allowSpectatorPosting && isPlayerActor(actor)) {
      pushReason(reasons, 'ACTOR_BLOCKED', 'spectator posting disabled in GLOBAL', -0.8);
      return { allowed: false, scoreDelta: -0.3 };
    }

    if (actor.speakerClass === 'REPLAY_AGENT' && !this.options.allowReplayAgentPosting) {
      pushReason(reasons, 'ACTOR_BLOCKED', 'replay agents may not emit live GLOBAL messages', -0.9);
      return { allowed: false, scoreDelta: -0.35 };
    }

    if (input.moderation?.actorShadowMuted) {
      pushReason(reasons, 'INVISIBILITY', 'actor shadow-muted; reroute to shadow ledger', -0.55);
      return { allowed: true, scoreDelta: -0.3 };
    }

    pushReason(reasons, 'ACTOR_ALLOWED', `${actor.speakerClass} may enter GLOBAL policy`, 0.18);

    if (isSystemActor(actor)) return { allowed: true, scoreDelta: 0.05 };
    if (isHelperActor(actor)) return { allowed: true, scoreDelta: 0.02 };
    if (isHaterActor(actor)) return { allowed: true, scoreDelta: 0.03 };
    if (isCrowdActor(actor)) return { allowed: true, scoreDelta: -0.01 };
    return { allowed: true, scoreDelta: 0 };
  }

  private evaluateKind(
    input: GlobalPolicyInput,
    reasons: GlobalPolicyReason[],
  ): { allowed: boolean; scoreDelta: number } {
    const kind = input.message.kind;
    const actor = input.message.actor;

    if (isPlayerActor(actor) && !includesKind(GLOBAL_ALLOWED_PLAYER_KINDS, kind)) {
      pushReason(reasons, 'KIND_BLOCKED', `player cannot emit ${kind} in GLOBAL`, -0.7);
      return { allowed: false, scoreDelta: -0.25 };
    }

    if (isSystemActor(actor) && !includesKind(GLOBAL_ALLOWED_SYSTEM_KINDS, kind)) {
      pushReason(reasons, 'KIND_BLOCKED', `system cannot emit ${kind} in GLOBAL`, -0.7);
      return { allowed: false, scoreDelta: -0.25 };
    }

    if (isHelperActor(actor) && !includesKind(GLOBAL_ALLOWED_HELPER_KINDS, kind)) {
      pushReason(reasons, 'KIND_BLOCKED', `helper cannot emit ${kind} in GLOBAL`, -0.7);
      return { allowed: false, scoreDelta: -0.25 };
    }

    if (isHaterActor(actor) && !includesKind(GLOBAL_ALLOWED_HATER_KINDS, kind)) {
      pushReason(reasons, 'KIND_BLOCKED', `hater cannot emit ${kind} in GLOBAL`, -0.7);
      return { allowed: false, scoreDelta: -0.25 };
    }

    if ((actor.speakerClass === 'NPC' || isCrowdActor(actor)) && !includesKind(GLOBAL_ALLOWED_NPC_KINDS, kind)) {
      pushReason(reasons, 'KIND_BLOCKED', `NPC/crowd cannot emit ${kind} in GLOBAL`, -0.7);
      return { allowed: false, scoreDelta: -0.22 };
    }

    pushReason(reasons, 'KIND_ALLOWED', `${kind} permitted in GLOBAL`, 0.15);
    return { allowed: true, scoreDelta: 0 };
  }

  private evaluateRate(
    input: GlobalPolicyInput,
    reasons: GlobalPolicyReason[],
    heatBand: GlobalAudienceHeatBand,
    roomStage: GlobalRoomStageMood,
  ): { decision: 'ALLOW' | 'DEFER' | 'SUPPRESS'; scoreDelta: number; deferForMs?: number } {
    const rate = input.rate;
    const fp = bodyFingerprint(input.message.body);
    const sameFingerprint = safeNumber(rate.sameBodyFingerprintTrailing60sCount, 0);

    if (sameFingerprint >= GLOBAL_RATE_LIMITS.sameFingerprint60sHardCap) {
      pushReason(reasons, 'RATE_SUPPRESS', `fingerprint ${fp} repeated too often`, -0.95);
      return { decision: 'SUPPRESS', scoreDelta: -0.35 };
    }

    if (
      rate.trailing10sCount >= GLOBAL_RATE_LIMITS.trailing10sHardCap ||
      rate.trailing30sCount >= GLOBAL_RATE_LIMITS.trailing30sHardCap ||
      rate.trailing60sCount >= GLOBAL_RATE_LIMITS.trailing60sHardCap ||
      rate.trailing5mCount >= GLOBAL_RATE_LIMITS.trailing5mHardCap
    ) {
      pushReason(reasons, 'RATE_DEFER', 'GLOBAL burst window saturated', -0.5);
      return {
        decision: 'DEFER',
        scoreDelta: -0.18,
        deferForMs:
          heatBand === 'PANIC' || roomStage === 'OVERLOADED'
            ? GLOBAL_RATE_LIMITS.panicDeferMs
            : GLOBAL_RATE_LIMITS.baseDeferMs,
      };
    }

    if (
      rate.sameActorTrailing30sCount >= GLOBAL_RATE_LIMITS.sameActor30sHardCap ||
      rate.sameKindTrailing30sCount >= GLOBAL_RATE_LIMITS.sameKind30sHardCap
    ) {
      pushReason(reasons, 'RATE_DEFER', 'actor/kind repeating too quickly for GLOBAL', -0.38);
      return {
        decision: 'DEFER',
        scoreDelta: -0.12,
        deferForMs: GLOBAL_RATE_LIMITS.baseDeferMs,
      };
    }

    pushReason(reasons, 'RATE_ALLOW', 'GLOBAL rate envelope healthy', 0.11);
    return { decision: 'ALLOW', scoreDelta: 0 };
  }

  private evaluateModeration(
    input: GlobalPolicyInput,
    reasons: GlobalPolicyReason[],
  ): { decision: 'ALLOW' | 'SUPPRESS'; scoreDelta: number } {
    const moderation = input.moderation;
    if (!moderation) return { decision: 'ALLOW', scoreDelta: 0 };

    if (moderation.bodyFlagged && safeNumber(moderation.bodyRiskScore, 0) >= 0.92) {
      pushReason(reasons, 'MODERATION_QUARANTINE', 'body risk score too high for GLOBAL', -1);
      return { decision: 'SUPPRESS', scoreDelta: -0.4 };
    }

    if (moderation.bodyFlagged) {
      pushReason(reasons, 'PUBLIC_NOISE_SUPPRESSED', 'flagged body softens GLOBAL visibility', -0.2);
      return { decision: 'ALLOW', scoreDelta: -0.1 };
    }

    return { decision: 'ALLOW', scoreDelta: 0 };
  }

  private resolveVisibility(
    input: GlobalPolicyInput,
    reasons: GlobalPolicyReason[],
    score: number,
    heatBand: GlobalAudienceHeatBand,
    crowdMood: GlobalCrowdMood,
  ): GlobalVisibilityBand {
    const surfaceWeight = GLOBAL_SURFACE_WEIGHTS[input.surface.activeSurface] ?? 0.5;
    const normalizedScore = clamp01(score + (surfaceWeight - 0.5) * 0.16);

    if (isLegendCandidate(input) && normalizedScore >= 0.72) {
      pushReason(reasons, 'LEGEND_ELEVATION', 'legend candidate escalated to LEGEND visibility', 0.35);
      return 'LEGEND';
    }

    if (input.moderation?.actorShadowMuted) {
      pushReason(reasons, 'INVISIBILITY', 'shadow-muted actor reduced to MUTED visibility', -0.4);
      return 'MUTED';
    }

    if (heatBand === 'PANIC' && isCrowdActor(input.message.actor)) {
      pushReason(reasons, 'CROWD_HEAT_PANIC', 'panic crowd softened to FEATURED instead of spotlight', -0.16);
      return normalizedScore >= 0.68 ? 'FEATURED' : 'STANDARD';
    }

    if (normalizedScore >= 0.8) {
      if (crowdMood === 'PREDATORY' && isCrowdActor(input.message.actor)) {
        pushReason(reasons, 'PUBLIC_NOISE_SUPPRESSED', 'predatory crowd held below spotlight', -0.15);
        return 'FEATURED';
      }
      return 'SPOTLIGHT';
    }

    if (normalizedScore >= 0.62) return 'FEATURED';
    if (normalizedScore >= 0.35) return 'STANDARD';
    return 'MUTED';
  }

  private resolveNotification(
    input: GlobalPolicyInput,
    visibility: GlobalVisibilityBand,
    heatBand: GlobalAudienceHeatBand,
  ): GlobalNotificationHint {
    if (visibility === 'LEGEND') return 'ESCALATION_BANNER';
    if (visibility === 'SPOTLIGHT' && (input.surface.collapsed || !input.surface.chatDockOpen)) return 'BANNER';
    if (visibility === 'SPOTLIGHT') return 'SOUND';
    if (visibility === 'FEATURED' && heatBand !== 'COLD') return 'INLINE';
    if (visibility === 'FEATURED') return 'BADGE';
    if (visibility === 'STANDARD' && !input.surface.chatDockOpen) return 'BADGE';
    return 'NONE';
  }

  private resolveTranscript(
    input: GlobalPolicyInput,
    visibility: GlobalVisibilityBand,
  ): GlobalTranscriptDisposition {
    if (input.moderation?.actorShadowMuted) return 'SHADOW_LEDGER';
    if (visibility === 'LEGEND') return 'APPEND_LEGEND';
    if (visibility === 'MUTED') return 'APPEND_MUTED';
    return 'APPEND';
  }

  private resolveAmplifier(
    input: GlobalPolicyInput,
    visibility: GlobalVisibilityBand,
    crowdMood: GlobalCrowdMood,
    heatBand: GlobalAudienceHeatBand,
  ): GlobalWitnessAmplifier {
    if (visibility === 'LEGEND') return 'LEGEND';
    if (visibility === 'SPOTLIGHT' && isSystemActor(input.message.actor)) return 'CROWD_AND_SYSTEM';
    if (visibility === 'SPOTLIGHT' && isHelperActor(input.message.actor)) return 'HELPER';
    if (visibility === 'SPOTLIGHT' && crowdMood !== 'NEUTRAL') return 'CROWD';
    if (visibility === 'FEATURED' && heatBand === 'HOT') return 'CROWD';
    return 'NONE';
  }

  private resolveFeatureLayout(
    gameplay: GlobalGameplayState,
    surface: GlobalSurfaceContext,
    audience: GlobalAudienceState,
    health: GlobalChannelHealth,
  ): GlobalFeatureLayout {
    const pressureTier = computePressureTier(gameplay);
    const heatBand = computeAudienceHeatBand(audience);
    const spotlightCapable = surface.chatDockOpen || surface.drawerOpen || !surface.collapsed;

    let feedDensity: GlobalFeatureDensity = 'STANDARD';
    let maxVisibleMessages = 140;
    let shouldUseSpotlightCard = spotlightCapable;
    let shouldShowThreatMeter = pressureTier !== 'CALM';
    let shouldShowInvasionBanner = Boolean(gameplay.rescueWindowOpen === false && gameplay.collapseRisk && gameplay.collapseRisk >= 0.7);
    let shouldShowHelperPrompt = Boolean(gameplay.rescueWindowOpen);
    let shouldShowProofSummary = gameplay.sovereigntyWindowOpen || Boolean(gameplay.collapseRisk && gameplay.collapseRisk >= 0.75);

    if (health.localBackpressure || heatBand === 'PANIC') {
      feedDensity = 'DENSE';
      maxVisibleMessages = 90;
      shouldUseSpotlightCard = false;
    } else if (surface.drawerOpen || surface.activeSurface === 'CHAT_DRAWER') {
      feedDensity = 'EXPANDED';
      maxVisibleMessages = 220;
    }

    if (gameplay.runMode === 'ghost') {
      shouldShowHelperPrompt = false;
    }

    return {
      feedDensity,
      maxVisibleMessages,
      shouldShowPresenceStrip: !surface.collapsed,
      shouldShowThreatMeter,
      shouldShowInvasionBanner,
      shouldShowHelperPrompt,
      shouldShowTranscriptDrawerShortcut: true,
      shouldShowProofSummary,
      shouldUseSpotlightCard,
    };
  }

  private buildRecommendations(
    gameplay: GlobalGameplayState,
    surface: GlobalSurfaceContext,
    audience: GlobalAudienceState,
    health: GlobalChannelHealth,
    room: GlobalRoomState | null,
  ): GlobalRecommendation[] {
    const recommendations: GlobalRecommendation[] = [];
    const pressureTier = computePressureTier(gameplay);
    const heatBand = computeAudienceHeatBand(audience);

    if (surface.collapsed && (pressureTier === 'HIGH' || pressureTier === 'CRITICAL')) {
      recommendations.push({
        id: 'open-chat-collapse',
        priority: 92,
        title: 'Open GLOBAL witness lane',
        detail: 'Pressure is peaking; public witness may matter for readability.',
        kind: 'OPEN_CHAT',
      });
    }

    if (gameplay.collapseRisk && gameplay.collapseRisk >= 0.8) {
      recommendations.push({
        id: 'collapse-witness',
        priority: 96,
        title: 'Promote collapse witness',
        detail: 'Collapse-risk events deserve higher visibility in GLOBAL.',
        kind: 'COLLAPSE_WITNESS',
      });
    }

    if (gameplay.sovereigntyWindowOpen) {
      recommendations.push({
        id: 'proof-spotlight',
        priority: 98,
        title: 'Spotlight proof-bearing moment',
        detail: 'Sovereignty window open; elevate proof-bearing messages.',
        kind: 'PROOF_SPOTLIGHT',
      });
    }

    if (health.localBackpressure || heatBand === 'PANIC') {
      recommendations.push({
        id: 'rate-limit-enforce',
        priority: 88,
        title: 'Tighten GLOBAL burst envelope',
        detail: 'Backpressure/panic detected; prefer deferrals over noise.',
        kind: 'RATE_LIMIT_ENFORCE',
      });
    }

    if (audience.ridiculeLikelihood >= 0.7 && room?.occupancy && room.occupancy > 4) {
      recommendations.push({
        id: 'mute-crowd',
        priority: 74,
        title: 'Soft-limit crowd swell',
        detail: 'Crowd ridicule spike detected; restrain background witness.',
        kind: 'MUTE_CROWD',
      });
    }

    if (gameplay.rescueWindowOpen) {
      recommendations.push({
        id: 'show-helper',
        priority: 91,
        title: 'Permit public helper rescue',
        detail: 'Rescue window open; helper witness may stabilize the lane.',
        kind: 'SHOW_HELPER',
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private buildSuppressedDecision(
    score: number,
    reasons: GlobalPolicyReason[],
  ): GlobalIngressDecision {
    return {
      decision: 'SUPPRESS',
      visibility: 'MUTED',
      notification: 'NONE',
      transcript: 'DROP',
      amplifier: 'NONE',
      score: clamp01(score),
      shouldPersistInTranscript: false,
      shouldFeatureInFeed: false,
      shouldAnimateBanner: false,
      shouldEscalateAudienceHeat: false,
      shouldMirrorToInvasionOrchestrator: false,
      shouldMirrorToNpcOrchestrator: false,
      shouldMirrorToTelemetry: true,
      shouldRequestHelperFollowup: false,
      shouldRequestCrowdFollowup: false,
      shouldOpenCollapsedPill: false,
      reasons,
    };
  }

  private buildDeferredDecision(
    score: number,
    reasons: GlobalPolicyReason[],
    deferForMs: number,
  ): GlobalIngressDecision {
    return {
      decision: 'DEFER',
      visibility: 'MUTED',
      notification: 'NONE',
      transcript: 'SHADOW_LEDGER',
      amplifier: 'NONE',
      score: clamp01(score),
      shouldPersistInTranscript: true,
      shouldFeatureInFeed: false,
      shouldAnimateBanner: false,
      shouldEscalateAudienceHeat: false,
      shouldMirrorToInvasionOrchestrator: false,
      shouldMirrorToNpcOrchestrator: false,
      shouldMirrorToTelemetry: true,
      shouldRequestHelperFollowup: false,
      shouldRequestCrowdFollowup: false,
      shouldOpenCollapsedPill: false,
      deferForMs,
      reasons,
    };
  }
}

// ============================================================================
// Pure helpers for orchestration call sites
// ============================================================================

export function createGlobalChannelPolicy(
  options: GlobalChannelPolicyOptions = {},
): GlobalChannelPolicy {
  return new GlobalChannelPolicy(options);
}

export function evaluateGlobalIngress(
  input: GlobalPolicyInput,
  options: GlobalChannelPolicyOptions = {},
): GlobalIngressDecision {
  return new GlobalChannelPolicy(options).evaluateIngress(input);
}

export function evaluateGlobalSnapshot(
  input: GlobalChannelSnapshotInput,
  options: GlobalChannelPolicyOptions = {},
): GlobalChannelSnapshot {
  return new GlobalChannelPolicy(options).evaluateSnapshot(input);
}

export const globalChannelPolicy = new GlobalChannelPolicy();

// ============================================================================
// Extended policy notes embedded as executable-friendly metadata
// ============================================================================

export interface GlobalPolicyMatrixRow {
  actor: GlobalSpeakerClass;
  kind: GlobalMessageKind;
  defaultDecision: GlobalAdmissionDecision;
  transcript: GlobalTranscriptDisposition;
  visibilityFloor: GlobalVisibilityBand;
  notes: string;
}

export const GLOBAL_POLICY_MATRIX: readonly GlobalPolicyMatrixRow[] = [
  {
    actor: 'PLAYER',
    kind: 'PLAYER',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'STANDARD',
    notes: 'Public authored player speech is allowed unless health/rate gates intervene.',
  },
  {
    actor: 'PLAYER',
    kind: 'PLAYER_RESPONSE',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'STANDARD',
    notes: 'Counter-taunt / player response remains public witness content.',
  },
  {
    actor: 'PLAYER',
    kind: 'PROOF_WITNESS',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND_LEGEND',
    visibilityFloor: 'FEATURED',
    notes: 'Proof witness may escalate to spotlight or legend.',
  },
  {
    actor: 'SYSTEM',
    kind: 'SYSTEM',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'FEATURED',
    notes: 'System notices are trusted and may earn high layout priority.',
  },
  {
    actor: 'SYSTEM',
    kind: 'MARKET_ALERT',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'FEATURED',
    notes: 'Market alerts are public truth with moderate spectacle value.',
  },
  {
    actor: 'SYSTEM',
    kind: 'SHIELD_EVENT',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'FEATURED',
    notes: 'Shield events often deserve immediate public witness.',
  },
  {
    actor: 'SYSTEM',
    kind: 'CASCADE_ALERT',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'SPOTLIGHT',
    notes: 'Cascade alerts may create public theater but still obey rate/health.',
  },
  {
    actor: 'SYSTEM',
    kind: 'ACHIEVEMENT',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND_LEGEND',
    visibilityFloor: 'FEATURED',
    notes: 'Achievement witness may become legend.',
  },
  {
    actor: 'HATER',
    kind: 'BOT_TAUNT',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND_MUTED',
    visibilityFloor: 'MUTED',
    notes: 'Taunts exist publicly, but they are easy to defer under spam pressure.',
  },
  {
    actor: 'HATER',
    kind: 'BOT_ATTACK',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'FEATURED',
    notes: 'Chat-native attacks are not mere flavor; they deserve stronger witness.',
  },
  {
    actor: 'HATER',
    kind: 'INVASION',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'FEATURED',
    notes: 'Invasion witness may route to invasion orchestration and public banners.',
  },
  {
    actor: 'HELPER',
    kind: 'HELPER_TIP',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND_MUTED',
    visibilityFloor: 'STANDARD',
    notes: 'Public helper interventions are valid but should not flood GLOBAL.',
  },
  {
    actor: 'HELPER',
    kind: 'COUNTER_INTEL',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'FEATURED',
    notes: 'Counter-intel can rise during threat windows.',
  },
  {
    actor: 'NPC',
    kind: 'CROWD_SWELL',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND_MUTED',
    visibilityFloor: 'MUTED',
    notes: 'Crowd swell is ambient and easily softened.',
  },
  {
    actor: 'CROWD',
    kind: 'CROWD_SWELL',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND_MUTED',
    visibilityFloor: 'MUTED',
    notes: 'Crowd witness can amplify, but crowd spam must remain bounded.',
  },
  {
    actor: 'NPC',
    kind: 'DEAL_RECAP',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'STANDARD',
    notes: 'Deal recaps are public witness only when already fit for GLOBAL.',
  },
  {
    actor: 'MODERATOR',
    kind: 'SYSTEM',
    defaultDecision: 'ALLOW',
    transcript: 'APPEND',
    visibilityFloor: 'FEATURED',
    notes: 'Moderator actions surface as trusted system witness.',
  },
];

// ============================================================================
// Layout / cue maps
// ============================================================================

export const GLOBAL_LAYOUT_TARGETS: Readonly<Record<GlobalFeatureDensity, number>> = {
  DENSE: 90,
  STANDARD: 140,
  EXPANDED: 220,
};

export const GLOBAL_SPOTLIGHT_ELIGIBILITY: readonly GlobalMessageKind[] = [
  'CASCADE_ALERT',
  'ACHIEVEMENT',
  'BOT_ATTACK',
  'RUN_OUTCOME',
  'INVASION',
  'PROOF_WITNESS',
  'PRESSURE_WITNESS',
] as const;

export const GLOBAL_CROWD_MUTING_SURFACES: readonly GlobalMountSurface[] = [
  'COUNTERPLAY_MODAL',
  'EMPIRE_BLEED_BANNER',
  'RESCUE_WINDOW_BANNER',
  'SABOTAGE_IMPACT_PANEL',
] as const;

export const GLOBAL_HELPER_PUBLIC_PRIORITIES: Readonly<Record<GlobalPressureTier, number>> = {
  CALM: 0.15,
  BUILDING: 0.24,
  ELEVATED: 0.42,
  HIGH: 0.67,
  CRITICAL: 0.86,
};

export const GLOBAL_HATER_PUBLIC_PRIORITIES: Readonly<Record<GlobalPressureTier, number>> = {
  CALM: 0.22,
  BUILDING: 0.34,
  ELEVATED: 0.51,
  HIGH: 0.72,
  CRITICAL: 0.81,
};

export const GLOBAL_PUBLIC_WITNESS_NOTES: readonly string[] = [
  'GLOBAL is the open witness lane, not the private strategy lane.',
  'It should remain readable under pressure rather than mechanically exhaustive.',
  'Legend moments are rare and should not be cheapened by overuse.',
  'Public helper interventions must be timely, not spammy.',
  'Hater presence may be theatrical, but it still answers to policy discipline.',
] as const;

// ============================================================================
// Inspection helpers
// ============================================================================

export function listGlobalMatrixRowsForActor(
  actor: GlobalSpeakerClass,
): GlobalPolicyMatrixRow[] {
  return GLOBAL_POLICY_MATRIX.filter((row) => row.actor === actor);
}

export function isGlobalSpotlightEligible(kind: GlobalMessageKind): boolean {
  return GLOBAL_SPOTLIGHT_ELIGIBILITY.includes(kind);
}

export function isGlobalCrowdMutedSurface(surface: GlobalMountSurface): boolean {
  return GLOBAL_CROWD_MUTING_SURFACES.includes(surface);
}

export function createGlobalBodyFingerprint(body: string): string {
  return bodyFingerprint(body);
}

export function inferGlobalAudienceHeatBand(audience: GlobalAudienceState): GlobalAudienceHeatBand {
  return computeAudienceHeatBand(audience);
}

export function inferGlobalCrowdMood(
  audience: GlobalAudienceState,
  gameplay: GlobalGameplayState,
): GlobalCrowdMood {
  return computeCrowdMood(audience, gameplay);
}

export function inferGlobalPressureTier(gameplay: GlobalGameplayState): GlobalPressureTier {
  return computePressureTier(gameplay);
}

export function inferGlobalTickTier(gameplay: GlobalGameplayState): GlobalTickTier {
  return computeTickTier(gameplay);
}

export function isGlobalLegendCandidate(input: GlobalPolicyInput): boolean {
  return isLegendCandidate(input);
}

export function isGlobalProofWitness(input: GlobalPolicyInput): boolean {
  return isProofWitness(input);
}

// ============================================================================
// Replay / telemetry friendly summaries
// ============================================================================

export interface GlobalPolicyAuditRecord {
  channel: GlobalChannelId;
  runMode: GlobalRunMode;
  modeFamily: GlobalModeFamily;
  actorId: string;
  actorClass: GlobalSpeakerClass;
  messageId: string;
  kind: GlobalMessageKind;
  decision: GlobalAdmissionDecision;
  visibility: GlobalVisibilityBand;
  transcript: GlobalTranscriptDisposition;
  amplifier: GlobalWitnessAmplifier;
  score: number;
  reasons: GlobalPolicyReason[];
}

export function createGlobalPolicyAuditRecord(
  input: GlobalPolicyInput,
  decision: GlobalIngressDecision,
): GlobalPolicyAuditRecord {
  return {
    channel: GLOBAL_CHANNEL_ID,
    runMode: input.gameplay.runMode,
    modeFamily: coalesceModeFamily(input.gameplay.runMode, input.gameplay.modeFamily ?? null),
    actorId: input.message.actor.id,
    actorClass: input.message.actor.speakerClass,
    messageId: input.message.id,
    kind: input.message.kind,
    decision: decision.decision,
    visibility: decision.visibility,
    transcript: decision.transcript,
    amplifier: decision.amplifier,
    score: decision.score,
    reasons: decision.reasons,
  };
}

// ============================================================================
// Canonical export surface
// ============================================================================

export default GlobalChannelPolicy;
