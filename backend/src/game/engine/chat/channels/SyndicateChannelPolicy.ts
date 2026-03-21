
/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT SYNDICATE CHANNEL POLICY
 * FILE: backend/src/game/engine/chat/channels/SyndicateChannelPolicy.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical backend policy authority for the SYNDICATE chat lane.
 *
 * Backend-truth question
 * ----------------------
 *   "Given a candidate SYNDICATE-channel chat action, who may see it, who may
 *    emit it, how private is it, what trust/role/clearance conditions govern
 *    it, and what transcript / witness policy is authoritative?"
 *
 * SYNDICATE is not GLOBAL with a different label.
 * It is the intimate tactical lane:
 * - where role and trust matter,
 * - where private team coordination outranks spectacle,
 * - where helper and system intelligence may surface quietly,
 * - where opponents do not receive free access,
 * - and where room security, faction fit, and transcript handling are stricter.
 *
 * Repo-grounded doctrine preserved here
 * -------------------------------------
 * - Donor router truth in the old frontend lane defined SYNDICATE as team-only,
 *   private from opponents, available in co-op, with bot injection disabled,
 *   NPC injection permitted, system events permitted, and helper tips permitted.
 * - The broader chat doctrine elevates SYNDICATE into the intimate trust lane
 *   with reputation / role rules and zero requirement to behave like GLOBAL.
 * - Backend truth must therefore own membership, privacy, clearance, and
 *   tactical integrity rather than relying on frontend convenience.
 *
 * This file owns
 * --------------
 * - run-mode and room-type availability for SYNDICATE,
 * - participant membership and trust-band admission,
 * - role and clearance based posting policy,
 * - secrecy / transcript disposition / proof policy,
 * - quiet-tactical visibility shaping,
 * - helper/system/NPC allowances within syndicate boundaries,
 * - replay/telemetry friendly reason structures,
 * - and structured lane snapshots consumed by backend chat orchestration.
 *
 * This file does not own
 * ----------------------
 * - socket room attachment,
 * - transcript persistence implementation,
 * - moderation mutation,
 * - helper line generation,
 * - deal room proof hashing,
 * - or live transport fanout.
 *
 * Design laws
 * -----------
 * - SYNDICATE is intimate, not theatrical.
 * - Opponent visibility defaults to none.
 * - Tactical clarity outranks spectacle.
 * - Helper/system intelligence is permitted when trust and timing allow.
 * - Hater injection is not normal inside SYNDICATE.
 * - Roles, squads, factions, and trust bands must be first-class policy inputs.
 * - Privacy does not remove auditability; it changes transcript disposition.
 * ============================================================================
 */

// ============================================================================
// Scalar aliases
// ============================================================================

export type SyndicateChannelId = 'SYNDICATE';

export type SyndicateRunMode =
  | 'solo'
  | 'asymmetric-pvp'
  | 'co-op'
  | 'ghost';

export type SyndicateModeFamily =
  | 'EMPIRE'
  | 'PREDATOR'
  | 'SYNDICATE'
  | 'PHANTOM';

export type SyndicateMountSurface =
  | 'SYNDICATE_SCREEN'
  | 'BATTLE_HUD'
  | 'GAME_BOARD'
  | 'LOBBY_SCREEN'
  | 'CLUB_UI'
  | 'LEAGUE_UI'
  | 'CHAT_DRAWER'
  | 'COUNTERPLAY_MODAL'
  | 'RESCUE_WINDOW_BANNER'
  | 'THREAT_RADAR_PANEL'
  | 'UNKNOWN';

export type SyndicateSpeakerClass =
  | 'PLAYER'
  | 'SYSTEM'
  | 'HELPER'
  | 'NPC'
  | 'MODERATOR'
  | 'SPECTATOR'
  | 'REPLAY_AGENT'
  | 'COMMAND_PROXY'
  | 'HATER';

export type SyndicateRole =
  | 'LEAD'
  | 'TACTICIAN'
  | 'RUNNER'
  | 'ANALYST'
  | 'BANKER'
  | 'SCOUT'
  | 'ALLY'
  | 'OBSERVER'
  | 'MENTOR'
  | 'SYSTEM';

export type SyndicateTrustBand =
  | 'HOSTILE'
  | 'UNKNOWN'
  | 'PROVISIONAL'
  | 'TRUSTED'
  | 'INNER_CIRCLE'
  | 'SOVEREIGN';

export type SyndicateSecurityTier =
  | 'OPEN'
  | 'TACTICAL'
  | 'SEALED'
  | 'INNER_RING';

export type SyndicateClearance =
  | 'NONE'
  | 'READ'
  | 'WRITE'
  | 'TACTICAL'
  | 'COMMAND';

export type SyndicateMessageKind =
  | 'PLAYER'
  | 'PLAYER_RESPONSE'
  | 'SYSTEM'
  | 'SYSTEM_DIRECTIVE'
  | 'HELPER_TIP'
  | 'COUNTER_INTEL'
  | 'TACTICAL_CALL'
  | 'TACTICAL_UPDATE'
  | 'RESOURCE_ALERT'
  | 'SQUAD_SIGNAL'
  | 'ROOM_STATE'
  | 'ALLY_NOTE'
  | 'MENTOR_NOTE'
  | 'REPUTATION_ALERT'
  | 'PROOF_WITNESS'
  | 'DEAL_RECAP'
  | 'BOT_TAUNT'
  | 'BOT_ATTACK';

export type SyndicateAudienceBand =
  | 'HUSHED'
  | 'FOCUSED'
  | 'LOCKED_IN'
  | 'STRESSED'
  | 'FRACTURING';

export type SyndicateRoomPosture =
  | 'BRIEFING'
  | 'EXECUTION'
  | 'RECOVERY'
  | 'STEALTH'
  | 'DISRUPTED';

export type SyndicateSeverity =
  | 'TRACE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'EXTREME';

export type SyndicateAdmissionDecision =
  | 'ALLOW'
  | 'DEFER'
  | 'SUPPRESS'
  | 'REROUTE'
  | 'PRIVATE_ONLY'
  | 'SHADOW_ONLY';

export type SyndicateVisibilityBand =
  | 'WHISPER'
  | 'STANDARD'
  | 'PINNED'
  | 'COMMAND'
  | 'SEALED';

export type SyndicateNotificationHint =
  | 'NONE'
  | 'BADGE'
  | 'INLINE'
  | 'PIN'
  | 'TACTICAL_PING';

export type SyndicateTranscriptDisposition =
  | 'APPEND_PRIVATE'
  | 'APPEND_PINNED'
  | 'APPEND_SEALED'
  | 'SHADOW_LEDGER'
  | 'DROP';

export type SyndicateReasonCode =
  | 'MODE_ALLOWED'
  | 'MODE_BLOCKED'
  | 'ROOM_ALLOWED'
  | 'ROOM_BLOCKED'
  | 'MEMBERSHIP_ALLOWED'
  | 'MEMBERSHIP_BLOCKED'
  | 'TRUST_LOW'
  | 'TRUST_OK'
  | 'ROLE_ALLOWED'
  | 'ROLE_BLOCKED'
  | 'CLEARANCE_ALLOWED'
  | 'CLEARANCE_BLOCKED'
  | 'OPPONENT_BLOCKED'
  | 'HELPER_ALLOWED'
  | 'HELPER_DEFERRED'
  | 'SYSTEM_ALLOWED'
  | 'SYSTEM_PINNED'
  | 'NPC_ALLOWED'
  | 'NPC_BLOCKED'
  | 'HATER_BLOCKED'
  | 'RATE_ALLOW'
  | 'RATE_DEFER'
  | 'RATE_SUPPRESS'
  | 'SECURITY_SEALED'
  | 'SECURITY_TACTICAL'
  | 'READ_ONLY_WINDOW'
  | 'MODERATION_QUARANTINE'
  | 'TRANSPORT_DEGRADED'
  | 'BACKPRESSURE'
  | 'PROOF_REQUIRED'
  | 'PROOF_PRESENT'
  | 'PRIVATE_TRANSCRIPT'
  | 'SEALED_TRANSCRIPT'
  | 'TACTICAL_SIGNAL'
  | 'COMMAND_SIGNAL'
  | 'ROOM_DISRUPTED'
  | 'CHANNEL_POLICY_SCORE';

// ============================================================================
// Input contracts
// ============================================================================

export interface SyndicateIdentity {
  actorId: string;
  displayName: string;
  speakerClass: SyndicateSpeakerClass;
  role: SyndicateRole;
  trustBand: SyndicateTrustBand;
  clearance: SyndicateClearance;
  teamId?: string | null;
  squadId?: string | null;
  factionId?: string | null;
  isLocalPlayer?: boolean;
  isOpponent?: boolean;
  isMuted?: boolean;
  helperId?: string | null;
  npcId?: string | null;
}

export interface SyndicateMessageEnvelope {
  id: string;
  channel: SyndicateChannelId;
  kind: SyndicateMessageKind;
  body: string;
  ts: number;
  actor: SyndicateIdentity;
  proofHash?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SyndicateGameplayState {
  runId: string | null;
  seed: string | number | null;
  tick: number;
  runMode: SyndicateRunMode;
  modeFamily?: SyndicateModeFamily | null;
  pressureScore?: number | null;
  rescueWindowOpen?: boolean;
  collapseRisk?: number | null;
  activeThreatCardCount?: number | null;
  factionIntegrity?: number | null;
  squadIntegrity?: number | null;
}

export interface SyndicateSurfaceContext {
  activeSurface: SyndicateMountSurface;
  visibleSurfaces: SyndicateMountSurface[];
  chatDockOpen: boolean;
  chatFocused: boolean;
  drawerOpen?: boolean;
  collapsed?: boolean;
}

export interface SyndicateAudienceState {
  participantCount: number;
  activeSpeakers: number;
  audienceBand?: SyndicateAudienceBand | null;
  tensionScore: number;
  fractureRisk: number;
}

export interface SyndicateRateState {
  now: number;
  trailing10sCount: number;
  trailing30sCount: number;
  trailing60sCount: number;
  sameActorTrailing30sCount: number;
  sameKindTrailing30sCount: number;
  sameBodyFingerprintTrailing60sCount: number;
}

export interface SyndicateChannelHealth {
  degradedTransport: boolean;
  moderationLock: boolean;
  readOnlyWindow: boolean;
  replaySyncInProgress: boolean;
  localBackpressure: boolean;
}

export interface SyndicateModerationSnapshot {
  actorShadowMuted?: boolean;
  actorHardMuted?: boolean;
  actorQuarantined?: boolean;
  bodyFlagged?: boolean;
  bodyRiskScore?: number;
}

export interface SyndicateMembershipState {
  roomId: string;
  roomType: 'SYNDICATE_ROOM' | 'COOP_PARTY' | 'WAR_ROOM' | 'UNKNOWN';
  roomPosture?: SyndicateRoomPosture | null;
  securityTier: SyndicateSecurityTier;
  members: string[];
  trustedMembers?: string[];
  factionId?: string | null;
  squadId?: string | null;
  allowCrossFactionMentors?: boolean;
}

export interface SyndicatePolicyInput {
  message: SyndicateMessageEnvelope;
  gameplay: SyndicateGameplayState;
  surface: SyndicateSurfaceContext;
  audience: SyndicateAudienceState;
  rate: SyndicateRateState;
  health: SyndicateChannelHealth;
  membership: SyndicateMembershipState;
  moderation?: SyndicateModerationSnapshot | null;
}

export interface SyndicateSnapshotInput {
  gameplay: SyndicateGameplayState;
  surface: SyndicateSurfaceContext;
  audience: SyndicateAudienceState;
  health: SyndicateChannelHealth;
  membership: SyndicateMembershipState;
}

// ============================================================================
// Outputs
// ============================================================================

export interface SyndicatePolicyReason {
  code: SyndicateReasonCode;
  detail: string;
  weight: number;
}

export interface SyndicateFeatureLayout {
  maxVisibleMessages: number;
  shouldShowRoster: boolean;
  shouldShowClearanceBadges: boolean;
  shouldShowTacticalPins: boolean;
  shouldShowHelperPrompt: boolean;
  shouldShowSecurityTierBadge: boolean;
  shouldUseDenseFeed: boolean;
}

export interface SyndicateComposeCapability {
  canCompose: boolean;
  canIssueTacticalCall: boolean;
  canIssueCommandDirective: boolean;
  canDropProofWitness: boolean;
  maxBodyLength: number;
  reasons: SyndicatePolicyReason[];
}

export interface SyndicateIngressDecision {
  decision: SyndicateAdmissionDecision;
  visibility: SyndicateVisibilityBand;
  notification: SyndicateNotificationHint;
  transcript: SyndicateTranscriptDisposition;
  score: number;
  shouldPersistInTranscript: boolean;
  shouldPinInRoom: boolean;
  shouldMirrorToTelemetry: boolean;
  shouldMirrorToNpcOrchestrator: boolean;
  shouldRequestHelperFollowup: boolean;
  shouldOpenCollapsedPill: boolean;
  shouldEmitTacticalPing: boolean;
  deferForMs?: number;
  rerouteChannel?: string;
  reasons: SyndicatePolicyReason[];
}

export interface SyndicateRecommendation {
  id: string;
  priority: number;
  title: string;
  detail: string;
  kind:
    | 'OPEN_ROOM'
    | 'PIN_SYSTEM'
    | 'TIGHTEN_SECURITY'
    | 'ALLOW_HELPER'
    | 'DEFER_HELPER'
    | 'TIGHTEN_RATE'
    | 'PROMOTE_TACTICAL_CALL';
}

export interface SyndicateChannelSnapshot {
  channel: SyndicateChannelId;
  available: boolean;
  runMode: SyndicateRunMode;
  modeFamily: SyndicateModeFamily;
  audienceBand: SyndicateAudienceBand;
  securityTier: SyndicateSecurityTier;
  compose: SyndicateComposeCapability;
  layout: SyndicateFeatureLayout;
  recommendations: SyndicateRecommendation[];
  reasons: SyndicatePolicyReason[];
}

// ============================================================================
// Options / manifest
// ============================================================================

export interface SyndicateChannelPolicyOptions {
  defaultMaxBodyLength?: number;
  sealedMaxBodyLength?: number;
  allowMentorCrossFaction?: boolean;
  allowNpcCrossFaction?: boolean;
  tacticalPinCooldownMs?: number;
}

export interface SyndicateChannelPolicyManifest {
  id: SyndicateChannelId;
  version: string;
  primaryModes: SyndicateRunMode[];
  playerKinds: SyndicateMessageKind[];
  helperKinds: SyndicateMessageKind[];
  systemKinds: SyndicateMessageKind[];
  npcKinds: SyndicateMessageKind[];
}

// ============================================================================
// Canonical constants
// ============================================================================

export const SYNDICATE_CHANNEL_ID: SyndicateChannelId = 'SYNDICATE';

export const SYNDICATE_PRIMARY_MODES: readonly SyndicateRunMode[] = [
  'co-op',
] as const;

export const SYNDICATE_MODE_FAMILY_MAP: Readonly<Record<SyndicateRunMode, SyndicateModeFamily>> = {
  solo: 'EMPIRE',
  'asymmetric-pvp': 'PREDATOR',
  'co-op': 'SYNDICATE',
  ghost: 'PHANTOM',
};

export const SYNDICATE_PLAYER_KINDS: readonly SyndicateMessageKind[] = [
  'PLAYER',
  'PLAYER_RESPONSE',
  'TACTICAL_CALL',
  'TACTICAL_UPDATE',
  'SQUAD_SIGNAL',
  'PROOF_WITNESS',
] as const;

export const SYNDICATE_HELPER_KINDS: readonly SyndicateMessageKind[] = [
  'HELPER_TIP',
  'COUNTER_INTEL',
  'MENTOR_NOTE',
] as const;

export const SYNDICATE_SYSTEM_KINDS: readonly SyndicateMessageKind[] = [
  'SYSTEM',
  'SYSTEM_DIRECTIVE',
  'ROOM_STATE',
  'RESOURCE_ALERT',
  'REPUTATION_ALERT',
] as const;

export const SYNDICATE_NPC_KINDS: readonly SyndicateMessageKind[] = [
  'ALLY_NOTE',
  'MENTOR_NOTE',
  'RESOURCE_ALERT',
  'DEAL_RECAP',
] as const;

export const SYNDICATE_BLOCKED_HATER_KINDS: readonly SyndicateMessageKind[] = [
  'BOT_TAUNT',
  'BOT_ATTACK',
] as const;

export const SYNDICATE_OPTIONS_DEFAULT: Required<SyndicateChannelPolicyOptions> = {
  defaultMaxBodyLength: 420,
  sealedMaxBodyLength: 280,
  allowMentorCrossFaction: true,
  allowNpcCrossFaction: false,
  tacticalPinCooldownMs: 9000,
};

export const SYNDICATE_MANIFEST: SyndicateChannelPolicyManifest = {
  id: SYNDICATE_CHANNEL_ID,
  version: '2026.03.14',
  primaryModes: [...SYNDICATE_PRIMARY_MODES],
  playerKinds: [...SYNDICATE_PLAYER_KINDS],
  helperKinds: [...SYNDICATE_HELPER_KINDS],
  systemKinds: [...SYNDICATE_SYSTEM_KINDS],
  npcKinds: [...SYNDICATE_NPC_KINDS],
};

export const SYNDICATE_CLEARANCE_SCORE: Readonly<Record<SyndicateClearance, number>> = {
  NONE: 0,
  READ: 0.25,
  WRITE: 0.5,
  TACTICAL: 0.75,
  COMMAND: 1,
};

export const SYNDICATE_TRUST_SCORE: Readonly<Record<SyndicateTrustBand, number>> = {
  HOSTILE: 0,
  UNKNOWN: 0.15,
  PROVISIONAL: 0.38,
  TRUSTED: 0.64,
  INNER_CIRCLE: 0.86,
  SOVEREIGN: 1,
};

export const SYNDICATE_AUDIENCE_BAND_THRESHOLDS = {
  hushed: 0.15,
  focused: 0.34,
  lockedIn: 0.56,
  stressed: 0.78,
};

export const SYNDICATE_RATE_LIMITS = {
  trailing10sHardCap: 8,
  trailing30sHardCap: 18,
  trailing60sHardCap: 30,
  sameActor30sHardCap: 7,
  sameKind30sHardCap: 8,
  sameFingerprint60sHardCap: 2,
  baseDeferMs: 1800,
  stressedDeferMs: 2800,
};

// ============================================================================
// Utility helpers
// ============================================================================

function syndSafeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function syndClamp01(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function syndNormalizeBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim();
}

function syndBodyFingerprint(body: string): string {
  const normalized = syndNormalizeBody(body).toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `sfp_${Math.abs(hash).toString(36)}`;
}

function syndPushReason(
  bucket: SyndicatePolicyReason[],
  code: SyndicateReasonCode,
  detail: string,
  weight: number,
): void {
  bucket.push({ code, detail, weight });
}

function syndModeFamily(mode: SyndicateRunMode, family?: SyndicateModeFamily | null): SyndicateModeFamily {
  return family ?? SYNDICATE_MODE_FAMILY_MAP[mode];
}

function syndAudienceBand(audience: SyndicateAudienceState): SyndicateAudienceBand {
  if (audience.audienceBand) return audience.audienceBand;
  const tension = syndClamp01(audience.tensionScore);
  if (tension >= SYNDICATE_AUDIENCE_BAND_THRESHOLDS.stressed) return 'FRACTURING';
  if (tension >= SYNDICATE_AUDIENCE_BAND_THRESHOLDS.lockedIn) return 'STRESSED';
  if (tension >= SYNDICATE_AUDIENCE_BAND_THRESHOLDS.focused) return 'LOCKED_IN';
  if (tension >= SYNDICATE_AUDIENCE_BAND_THRESHOLDS.hushed) return 'FOCUSED';
  return 'HUSHED';
}

function syndTrustScore(trust: SyndicateTrustBand): number {
  return SYNDICATE_TRUST_SCORE[trust];
}

function syndClearanceScore(clearance: SyndicateClearance): number {
  return SYNDICATE_CLEARANCE_SCORE[clearance];
}

function syndIsPlayer(actor: SyndicateIdentity): boolean {
  return actor.speakerClass === 'PLAYER';
}

function syndIsHelper(actor: SyndicateIdentity): boolean {
  return actor.speakerClass === 'HELPER';
}

function syndIsSystem(actor: SyndicateIdentity): boolean {
  return actor.speakerClass === 'SYSTEM' || actor.speakerClass === 'MODERATOR';
}

function syndIsNpc(actor: SyndicateIdentity): boolean {
  return actor.speakerClass === 'NPC' || actor.speakerClass === 'COMMAND_PROXY';
}

function syndIsHater(actor: SyndicateIdentity): boolean {
  return actor.speakerClass === 'HATER';
}

// ============================================================================
// Policy class
// ============================================================================

export class SyndicateChannelPolicy {
  private readonly options: Required<SyndicateChannelPolicyOptions>;

  public constructor(options: SyndicateChannelPolicyOptions = {}) {
    this.options = {
      ...SYNDICATE_OPTIONS_DEFAULT,
      ...options,
    };
  }

  public getChannelId(): SyndicateChannelId {
    return SYNDICATE_CHANNEL_ID;
  }

  public getManifest(): SyndicateChannelPolicyManifest {
    return {
      ...SYNDICATE_MANIFEST,
      primaryModes: [...SYNDICATE_MANIFEST.primaryModes],
      playerKinds: [...SYNDICATE_MANIFEST.playerKinds],
      helperKinds: [...SYNDICATE_MANIFEST.helperKinds],
      systemKinds: [...SYNDICATE_MANIFEST.systemKinds],
      npcKinds: [...SYNDICATE_MANIFEST.npcKinds],
    };
  }

  public isAvailableInMode(
    mode: SyndicateRunMode,
    membership: SyndicateMembershipState,
  ): boolean {
    if (SYNDICATE_PRIMARY_MODES.includes(mode)) return true;
    return membership.roomType === 'WAR_ROOM';
  }

  public evaluateComposeCapability(
    gameplay: SyndicateGameplayState,
    health: SyndicateChannelHealth,
    membership: SyndicateMembershipState,
    actor?: SyndicateIdentity,
  ): SyndicateComposeCapability {
    const reasons: SyndicatePolicyReason[] = [];
    let canCompose = this.isAvailableInMode(gameplay.runMode, membership);
    let canIssueTacticalCall = true;
    let canIssueCommandDirective = false;
    let canDropProofWitness = true;
    let maxBodyLength =
      membership.securityTier === 'INNER_RING'
        ? this.options.sealedMaxBodyLength
        : this.options.defaultMaxBodyLength;

    if (!canCompose) {
      syndPushReason(reasons, 'MODE_BLOCKED', `SYNDICATE unavailable in ${gameplay.runMode}`, -1);
    } else {
      syndPushReason(reasons, 'MODE_ALLOWED', `SYNDICATE available in ${gameplay.runMode}`, 0.35);
    }

    if (health.readOnlyWindow) {
      canCompose = false;
      canIssueTacticalCall = false;
      canIssueCommandDirective = false;
      canDropProofWitness = false;
      syndPushReason(reasons, 'READ_ONLY_WINDOW', 'read-only window active', -0.95);
    }

    if (health.moderationLock) {
      canCompose = false;
      canIssueTacticalCall = false;
      canIssueCommandDirective = false;
      canDropProofWitness = false;
      syndPushReason(reasons, 'MODERATION_QUARANTINE', 'moderation lock active', -1);
    }

    if (health.localBackpressure) {
      maxBodyLength = Math.min(maxBodyLength, 220);
      syndPushReason(reasons, 'BACKPRESSURE', 'max body length tightened by backpressure', -0.24);
    }

    if (membership.securityTier === 'SEALED' || membership.securityTier === 'INNER_RING') {
      syndPushReason(reasons, 'SECURITY_SEALED', 'sealed security tier compresses room chatter', -0.12);
    } else {
      syndPushReason(reasons, 'SECURITY_TACTICAL', 'tactical security tier permits normal room traffic', 0.12);
    }

    if (actor) {
      const trust = syndTrustScore(actor.trustBand);
      const clearance = syndClearanceScore(actor.clearance);

      if (trust < 0.38) {
        canCompose = false;
        canIssueTacticalCall = false;
        canIssueCommandDirective = false;
        canDropProofWitness = false;
        syndPushReason(reasons, 'TRUST_LOW', 'trust band too low to compose in SYNDICATE', -0.8);
      } else {
        syndPushReason(reasons, 'TRUST_OK', `trust band ${actor.trustBand} accepted`, 0.16);
      }

      if (clearance < 0.5) {
        canIssueTacticalCall = false;
        canIssueCommandDirective = false;
        syndPushReason(reasons, 'CLEARANCE_BLOCKED', 'clearance below WRITE/TACTICAL threshold', -0.22);
      } else {
        syndPushReason(reasons, 'CLEARANCE_ALLOWED', `clearance ${actor.clearance} accepted`, 0.12);
      }

      if (actor.role === 'LEAD' || actor.role === 'TACTICIAN') {
        canIssueTacticalCall = true;
        syndPushReason(reasons, 'ROLE_ALLOWED', `${actor.role} may issue tactical calls`, 0.14);
      }

      if (actor.clearance === 'COMMAND' || actor.role === 'LEAD') {
        canIssueCommandDirective = true;
        syndPushReason(reasons, 'COMMAND_SIGNAL', 'command authority present', 0.18);
      }
    }

    return {
      canCompose,
      canIssueTacticalCall,
      canIssueCommandDirective,
      canDropProofWitness,
      maxBodyLength,
      reasons,
    };
  }

  public evaluateIngress(input: SyndicatePolicyInput): SyndicateIngressDecision {
    const reasons: SyndicatePolicyReason[] = [];
    let score = 0.5;
    const audienceBand = syndAudienceBand(input.audience);

    if (!this.isAvailableInMode(input.gameplay.runMode, input.membership)) {
      syndPushReason(reasons, 'MODE_BLOCKED', `SYNDICATE unavailable in ${input.gameplay.runMode}`, -1);
      return this.buildSuppressed(score, reasons);
    }
    syndPushReason(reasons, 'MODE_ALLOWED', `SYNDICATE available in ${input.gameplay.runMode}`, 0.3);

    const membershipDecision = this.evaluateMembership(input, reasons);
    if (!membershipDecision.allowed) {
      return this.buildSuppressed(score + membershipDecision.scoreDelta, reasons);
    }
    score += membershipDecision.scoreDelta;

    const actorDecision = this.evaluateActor(input, reasons);
    if (!actorDecision.allowed) {
      return this.buildSuppressed(score + actorDecision.scoreDelta, reasons);
    }
    score += actorDecision.scoreDelta;

    const kindDecision = this.evaluateKind(input, reasons);
    if (!kindDecision.allowed) {
      return this.buildSuppressed(score + kindDecision.scoreDelta, reasons);
    }
    score += kindDecision.scoreDelta;

    const rateDecision = this.evaluateRate(input, reasons, audienceBand);
    if (rateDecision.decision === 'SUPPRESS') {
      return this.buildSuppressed(score + rateDecision.scoreDelta, reasons);
    }
    if (rateDecision.decision === 'DEFER') {
      return this.buildDeferred(score + rateDecision.scoreDelta, reasons, rateDecision.deferForMs!);
    }
    score += rateDecision.scoreDelta;

    if (input.health.moderationLock) {
      syndPushReason(reasons, 'MODERATION_QUARANTINE', 'moderation lock active', -1);
      return this.buildSuppressed(score - 0.25, reasons);
    }

    if (input.moderation?.actorShadowMuted) {
      syndPushReason(reasons, 'PRIVATE_TRANSCRIPT', 'shadow-muted actor rerouted into shadow ledger', -0.35);
      return {
        decision: 'SHADOW_ONLY',
        visibility: 'WHISPER',
        notification: 'NONE',
        transcript: 'SHADOW_LEDGER',
        score: syndClamp01(score - 0.2),
        shouldPersistInTranscript: true,
        shouldPinInRoom: false,
        shouldMirrorToTelemetry: true,
        shouldMirrorToNpcOrchestrator: false,
        shouldRequestHelperFollowup: false,
        shouldOpenCollapsedPill: false,
        shouldEmitTacticalPing: false,
        reasons,
      };
    }

    if (input.membership.securityTier === 'INNER_RING') {
      score += 0.05;
      syndPushReason(reasons, 'SEALED_TRANSCRIPT', 'inner-ring security raises sealed handling', 0.2);
    }

    if (input.message.proofHash) {
      score += 0.04;
      syndPushReason(reasons, 'PROOF_PRESENT', 'proof hash accepted for private witness', 0.16);
    } else if (input.message.kind === 'PROOF_WITNESS') {
      syndPushReason(reasons, 'PROOF_REQUIRED', 'proof witness without proof hash remains allowed but softened', -0.08);
      score -= 0.02;
    }

    if (input.membership.roomPosture === 'DISRUPTED') {
      syndPushReason(reasons, 'ROOM_DISRUPTED', 'room posture disrupted; visibility/pings softened', -0.18);
      score -= 0.04;
    }

    if (input.health.degradedTransport) {
      syndPushReason(reasons, 'TRANSPORT_DEGRADED', 'transport degraded; avoid over-pinning', -0.12);
      score -= 0.03;
    }

    if (input.health.localBackpressure) {
      syndPushReason(reasons, 'BACKPRESSURE', 'backpressure softens tactical lane', -0.12);
      score -= 0.03;
    }

    const visibility = this.resolveVisibility(input, audienceBand, score, reasons);
    const notification = this.resolveNotification(input, visibility);
    const transcript = this.resolveTranscript(input, visibility);
    const shouldPersistInTranscript = transcript !== 'DROP';
    const shouldPinInRoom = visibility === 'PINNED' || visibility === 'COMMAND' || visibility === 'SEALED';
    const shouldMirrorToTelemetry = true;
    const shouldMirrorToNpcOrchestrator = syndIsHelper(input.message.actor) || syndIsNpc(input.message.actor);
    const shouldRequestHelperFollowup =
      !syndIsHelper(input.message.actor) &&
      Boolean(input.gameplay.rescueWindowOpen || input.gameplay.collapseRisk && input.gameplay.collapseRisk >= 0.7);
    const shouldOpenCollapsedPill =
      Boolean(input.surface.collapsed) &&
      (visibility === 'PINNED' || visibility === 'COMMAND' || visibility === 'SEALED');
    const shouldEmitTacticalPing =
      visibility === 'COMMAND' ||
      visibility === 'SEALED' ||
      input.message.kind === 'TACTICAL_CALL' ||
      input.message.kind === 'SYSTEM_DIRECTIVE';

    score = syndClamp01(score);
    syndPushReason(reasons, 'CHANNEL_POLICY_SCORE', `final SYNDICATE score=${score.toFixed(3)}`, score);

    return {
      decision: 'ALLOW',
      visibility,
      notification,
      transcript,
      score,
      shouldPersistInTranscript,
      shouldPinInRoom,
      shouldMirrorToTelemetry,
      shouldMirrorToNpcOrchestrator,
      shouldRequestHelperFollowup,
      shouldOpenCollapsedPill,
      shouldEmitTacticalPing,
      reasons,
    };
  }

  public evaluateSnapshot(input: SyndicateSnapshotInput): SyndicateChannelSnapshot {
    const reasons: SyndicatePolicyReason[] = [];
    const audienceBand = syndAudienceBand(input.audience);

    if (this.isAvailableInMode(input.gameplay.runMode, input.membership)) {
      syndPushReason(reasons, 'MODE_ALLOWED', `SYNDICATE mounted for ${input.gameplay.runMode}`, 0.35);
    } else {
      syndPushReason(reasons, 'MODE_BLOCKED', `SYNDICATE not mounted for ${input.gameplay.runMode}`, -1);
    }

    syndPushReason(reasons, 'ROOM_ALLOWED', `room type ${input.membership.roomType}`, 0.12);

    if (input.membership.securityTier === 'SEALED' || input.membership.securityTier === 'INNER_RING') {
      syndPushReason(reasons, 'SECURITY_SEALED', 'sealed room security visible in snapshot', 0.14);
    } else {
      syndPushReason(reasons, 'SECURITY_TACTICAL', 'tactical/open room security visible in snapshot', 0.08);
    }

    const compose = this.evaluateComposeCapability(
      input.gameplay,
      input.health,
      input.membership,
    );

    const layout = this.resolveFeatureLayout(input);
    const recommendations = this.buildRecommendations(input);

    return {
      channel: SYNDICATE_CHANNEL_ID,
      available: this.isAvailableInMode(input.gameplay.runMode, input.membership),
      runMode: input.gameplay.runMode,
      modeFamily: syndModeFamily(input.gameplay.runMode, input.gameplay.modeFamily ?? null),
      audienceBand,
      securityTier: input.membership.securityTier,
      compose,
      layout,
      recommendations,
      reasons,
    };
  }

  private evaluateMembership(
    input: SyndicatePolicyInput,
    reasons: SyndicatePolicyReason[],
  ): { allowed: boolean; scoreDelta: number } {
    const actor = input.message.actor;
    const membership = input.membership;

    if (actor.isOpponent) {
      syndPushReason(reasons, 'OPPONENT_BLOCKED', 'opponent may not enter SYNDICATE lane', -1);
      return { allowed: false, scoreDelta: -0.35 };
    }

    if (actor.teamId && membership.factionId && actor.factionId && actor.factionId !== membership.factionId) {
      if (!(syndIsHelper(actor) && this.options.allowMentorCrossFaction)) {
        syndPushReason(reasons, 'MEMBERSHIP_BLOCKED', 'cross-faction actor blocked from room', -0.85);
        return { allowed: false, scoreDelta: -0.28 };
      }
    }

    if (
      membership.members.length > 0 &&
      !membership.members.includes(actor.actorId) &&
      !syndIsHelper(actor) &&
      !syndIsSystem(actor) &&
      !syndIsNpc(actor)
    ) {
      syndPushReason(reasons, 'MEMBERSHIP_BLOCKED', 'actor not present in syndicate membership roster', -0.9);
      return { allowed: false, scoreDelta: -0.3 };
    }

    syndPushReason(reasons, 'MEMBERSHIP_ALLOWED', 'actor accepted by syndicate membership policy', 0.16);
    return { allowed: true, scoreDelta: 0.04 };
  }

  private evaluateActor(
    input: SyndicatePolicyInput,
    reasons: SyndicatePolicyReason[],
  ): { allowed: boolean; scoreDelta: number } {
    const actor = input.message.actor;
    const trustScore = syndTrustScore(actor.trustBand);
    const clearanceScore = syndClearanceScore(actor.clearance);

    if (actor.isMuted || input.moderation?.actorHardMuted) {
      syndPushReason(reasons, 'MEMBERSHIP_BLOCKED', 'actor hard-muted', -1);
      return { allowed: false, scoreDelta: -0.4 };
    }

    if (input.moderation?.actorQuarantined) {
      syndPushReason(reasons, 'MODERATION_QUARANTINE', 'actor quarantined', -1);
      return { allowed: false, scoreDelta: -0.42 };
    }

    if (syndIsHater(actor)) {
      syndPushReason(reasons, 'HATER_BLOCKED', 'hater presence is not normal inside SYNDICATE', -1);
      return { allowed: false, scoreDelta: -0.4 };
    }

    if (trustScore < 0.38 && !syndIsSystem(actor) && !syndIsHelper(actor)) {
      syndPushReason(reasons, 'TRUST_LOW', `trust band ${actor.trustBand} below syndicate threshold`, -0.82);
      return { allowed: false, scoreDelta: -0.26 };
    }

    syndPushReason(reasons, 'TRUST_OK', `trust band ${actor.trustBand} accepted`, 0.14);

    if (clearanceScore < 0.25 && !syndIsHelper(actor) && !syndIsSystem(actor)) {
      syndPushReason(reasons, 'CLEARANCE_BLOCKED', 'clearance below READ threshold', -0.75);
      return { allowed: false, scoreDelta: -0.24 };
    }

    syndPushReason(reasons, 'CLEARANCE_ALLOWED', `clearance ${actor.clearance} accepted`, 0.12);

    if (actor.role === 'LEAD' || actor.role === 'TACTICIAN') {
      syndPushReason(reasons, 'ROLE_ALLOWED', `${actor.role} role raises tactical authority`, 0.14);
      return { allowed: true, scoreDelta: 0.05 };
    }

    return { allowed: true, scoreDelta: 0 };
  }

  private evaluateKind(
    input: SyndicatePolicyInput,
    reasons: SyndicatePolicyReason[],
  ): { allowed: boolean; scoreDelta: number } {
    const kind = input.message.kind;
    const actor = input.message.actor;

    if (syndIsPlayer(actor) && !SYNDICATE_PLAYER_KINDS.includes(kind)) {
      syndPushReason(reasons, 'ROLE_BLOCKED', `player role may not emit ${kind}`, -0.7);
      return { allowed: false, scoreDelta: -0.2 };
    }

    if (syndIsHelper(actor) && !SYNDICATE_HELPER_KINDS.includes(kind)) {
      syndPushReason(reasons, 'HELPER_DEFERRED', `helper may not emit ${kind} into SYNDICATE`, -0.4);
      return { allowed: false, scoreDelta: -0.12 };
    }

    if (syndIsSystem(actor) && !SYNDICATE_SYSTEM_KINDS.includes(kind)) {
      syndPushReason(reasons, 'ROLE_BLOCKED', `system may not emit ${kind}`, -0.7);
      return { allowed: false, scoreDelta: -0.2 };
    }

    if (syndIsNpc(actor) && !SYNDICATE_NPC_KINDS.includes(kind)) {
      syndPushReason(reasons, 'NPC_BLOCKED', `NPC/proxy may not emit ${kind}`, -0.7);
      return { allowed: false, scoreDelta: -0.2 };
    }

    if (SYNDICATE_BLOCKED_HATER_KINDS.includes(kind)) {
      syndPushReason(reasons, 'HATER_BLOCKED', `${kind} is not valid inside SYNDICATE`, -0.9);
      return { allowed: false, scoreDelta: -0.28 };
    }

    if (kind === 'SYSTEM_DIRECTIVE') {
      syndPushReason(reasons, 'SYSTEM_PINNED', 'system directive is pin-eligible', 0.16);
      return { allowed: true, scoreDelta: 0.05 };
    }

    if (kind === 'TACTICAL_CALL' || kind === 'SQUAD_SIGNAL') {
      syndPushReason(reasons, 'TACTICAL_SIGNAL', `${kind} is tactical in nature`, 0.15);
      return { allowed: true, scoreDelta: 0.04 };
    }

    return { allowed: true, scoreDelta: 0 };
  }

  private evaluateRate(
    input: SyndicatePolicyInput,
    reasons: SyndicatePolicyReason[],
    audienceBand: SyndicateAudienceBand,
  ): { decision: 'ALLOW' | 'DEFER' | 'SUPPRESS'; scoreDelta: number; deferForMs?: number } {
    const rate = input.rate;

    if (rate.sameBodyFingerprintTrailing60sCount >= SYNDICATE_RATE_LIMITS.sameFingerprint60sHardCap) {
      syndPushReason(reasons, 'RATE_SUPPRESS', 'same body fingerprint repeated in private lane', -0.92);
      return { decision: 'SUPPRESS', scoreDelta: -0.32 };
    }

    if (
      rate.trailing10sCount >= SYNDICATE_RATE_LIMITS.trailing10sHardCap ||
      rate.trailing30sCount >= SYNDICATE_RATE_LIMITS.trailing30sHardCap ||
      rate.trailing60sCount >= SYNDICATE_RATE_LIMITS.trailing60sHardCap
    ) {
      syndPushReason(reasons, 'RATE_DEFER', 'syndicate burst envelope saturated', -0.45);
      return {
        decision: 'DEFER',
        scoreDelta: -0.16,
        deferForMs: audienceBand === 'FRACTURING'
          ? SYNDICATE_RATE_LIMITS.stressedDeferMs
          : SYNDICATE_RATE_LIMITS.baseDeferMs,
      };
    }

    if (
      rate.sameActorTrailing30sCount >= SYNDICATE_RATE_LIMITS.sameActor30sHardCap ||
      rate.sameKindTrailing30sCount >= SYNDICATE_RATE_LIMITS.sameKind30sHardCap
    ) {
      syndPushReason(reasons, 'RATE_DEFER', 'actor/kind cadence too dense for private tactical lane', -0.32);
      return {
        decision: 'DEFER',
        scoreDelta: -0.1,
        deferForMs: SYNDICATE_RATE_LIMITS.baseDeferMs,
      };
    }

    syndPushReason(reasons, 'RATE_ALLOW', 'syndicate cadence healthy', 0.1);
    return { decision: 'ALLOW', scoreDelta: 0 };
  }

  private resolveVisibility(
    input: SyndicatePolicyInput,
    audienceBand: SyndicateAudienceBand,
    score: number,
    reasons: SyndicatePolicyReason[],
  ): SyndicateVisibilityBand {
    const actor = input.message.actor;
    const membership = input.membership;

    if (membership.securityTier === 'INNER_RING') {
      syndPushReason(reasons, 'SECURITY_SEALED', 'inner-ring message visibility sealed', 0.28);
      return 'SEALED';
    }

    if (input.message.kind === 'SYSTEM_DIRECTIVE' || actor.clearance === 'COMMAND' || actor.role === 'LEAD') {
      syndPushReason(reasons, 'COMMAND_SIGNAL', 'command visibility assigned', 0.22);
      return membership.securityTier === 'SEALED' ? 'SEALED' : 'COMMAND';
    }

    if (input.message.kind === 'TACTICAL_CALL' || input.message.kind === 'SQUAD_SIGNAL') {
      syndPushReason(reasons, 'TACTICAL_SIGNAL', 'tactical message pinned inside room', 0.18);
      return 'PINNED';
    }

    if (audienceBand === 'HUSHED' && !input.surface.chatFocused) {
      return 'WHISPER';
    }

    if (syndIsHelper(actor) && membership.securityTier === 'TACTICAL') {
      syndPushReason(reasons, 'HELPER_ALLOWED', 'helper allowed at standard/private visibility', 0.08);
      return 'STANDARD';
    }

    if (score >= 0.72) return 'PINNED';
    return 'STANDARD';
  }

  private resolveNotification(
    input: SyndicatePolicyInput,
    visibility: SyndicateVisibilityBand,
  ): SyndicateNotificationHint {
    if (visibility === 'SEALED' || visibility === 'COMMAND') return 'TACTICAL_PING';
    if (visibility === 'PINNED' && (input.surface.collapsed || !input.surface.chatDockOpen)) return 'PIN';
    if (visibility === 'PINNED') return 'INLINE';
    if (visibility === 'STANDARD' && !input.surface.chatDockOpen) return 'BADGE';
    return 'NONE';
  }

  private resolveTranscript(
    input: SyndicatePolicyInput,
    visibility: SyndicateVisibilityBand,
  ): SyndicateTranscriptDisposition {
    if (input.moderation?.actorShadowMuted) return 'SHADOW_LEDGER';
    if (visibility === 'SEALED') return 'APPEND_SEALED';
    if (visibility === 'PINNED' || visibility === 'COMMAND') return 'APPEND_PINNED';
    return 'APPEND_PRIVATE';
  }

  private resolveFeatureLayout(input: SyndicateSnapshotInput): SyndicateFeatureLayout {
    const band = syndAudienceBand(input.audience);
    const dense = input.health.localBackpressure || band === 'FRACTURING';

    return {
      maxVisibleMessages: dense ? 80 : 120,
      shouldShowRoster: true,
      shouldShowClearanceBadges: true,
      shouldShowTacticalPins: true,
      shouldShowHelperPrompt: Boolean(input.gameplay.rescueWindowOpen),
      shouldShowSecurityTierBadge: true,
      shouldUseDenseFeed: dense,
    };
  }

  private buildRecommendations(input: SyndicateSnapshotInput): SyndicateRecommendation[] {
    const recommendations: SyndicateRecommendation[] = [];
    const band = syndAudienceBand(input.audience);

    if (input.surface.collapsed && (band === 'STRESSED' || band === 'FRACTURING')) {
      recommendations.push({
        id: 'open-room',
        priority: 88,
        title: 'Open syndicate room',
        detail: 'Private tactical lane is under stress and should be visible.',
        kind: 'OPEN_ROOM',
      });
    }

    if (input.membership.securityTier === 'OPEN' && input.gameplay.collapseRisk && input.gameplay.collapseRisk >= 0.7) {
      recommendations.push({
        id: 'tighten-security',
        priority: 91,
        title: 'Tighten room security',
        detail: 'High collapse risk suggests moving from OPEN to TACTICAL/SEALED.',
        kind: 'TIGHTEN_SECURITY',
      });
    }

    if (input.gameplay.rescueWindowOpen) {
      recommendations.push({
        id: 'allow-helper',
        priority: 86,
        title: 'Permit helper follow-up',
        detail: 'Rescue window open; helper/private mentorship may stabilize room.',
        kind: 'ALLOW_HELPER',
      });
    }

    if (input.health.localBackpressure || band === 'FRACTURING') {
      recommendations.push({
        id: 'tighten-rate',
        priority: 84,
        title: 'Tighten syndicate cadence',
        detail: 'Private lane is overactive; prefer pinned signals over chatter.',
        kind: 'TIGHTEN_RATE',
      });
    }

    if (input.membership.roomPosture === 'EXECUTION') {
      recommendations.push({
        id: 'promote-tactical-call',
        priority: 83,
        title: 'Promote tactical call format',
        detail: 'Execution posture benefits from shorter structured calls.',
        kind: 'PROMOTE_TACTICAL_CALL',
      });
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private buildSuppressed(
    score: number,
    reasons: SyndicatePolicyReason[],
  ): SyndicateIngressDecision {
    return {
      decision: 'SUPPRESS',
      visibility: 'WHISPER',
      notification: 'NONE',
      transcript: 'DROP',
      score: syndClamp01(score),
      shouldPersistInTranscript: false,
      shouldPinInRoom: false,
      shouldMirrorToTelemetry: true,
      shouldMirrorToNpcOrchestrator: false,
      shouldRequestHelperFollowup: false,
      shouldOpenCollapsedPill: false,
      shouldEmitTacticalPing: false,
      reasons,
    };
  }

  private buildDeferred(
    score: number,
    reasons: SyndicatePolicyReason[],
    deferForMs: number,
  ): SyndicateIngressDecision {
    return {
      decision: 'DEFER',
      visibility: 'WHISPER',
      notification: 'NONE',
      transcript: 'SHADOW_LEDGER',
      score: syndClamp01(score),
      shouldPersistInTranscript: true,
      shouldPinInRoom: false,
      shouldMirrorToTelemetry: true,
      shouldMirrorToNpcOrchestrator: false,
      shouldRequestHelperFollowup: false,
      shouldOpenCollapsedPill: false,
      shouldEmitTacticalPing: false,
      deferForMs,
      reasons,
    };
  }
}

// ============================================================================
// Helper exports
// ============================================================================

export function createSyndicateChannelPolicy(
  options: SyndicateChannelPolicyOptions = {},
): SyndicateChannelPolicy {
  return new SyndicateChannelPolicy(options);
}

export function evaluateSyndicateIngress(
  input: SyndicatePolicyInput,
  options: SyndicateChannelPolicyOptions = {},
): SyndicateIngressDecision {
  return new SyndicateChannelPolicy(options).evaluateIngress(input);
}

export function evaluateSyndicateSnapshot(
  input: SyndicateSnapshotInput,
  options: SyndicateChannelPolicyOptions = {},
): SyndicateChannelSnapshot {
  return new SyndicateChannelPolicy(options).evaluateSnapshot(input);
}

export const syndicateChannelPolicy = new SyndicateChannelPolicy();

// ============================================================================
// Matrix / inspection helpers
// ============================================================================

export interface SyndicatePolicyMatrixRow {
  actor: SyndicateSpeakerClass;
  kind: SyndicateMessageKind;
  baseDecision: SyndicateAdmissionDecision;
  transcript: SyndicateTranscriptDisposition;
  visibilityFloor: SyndicateVisibilityBand;
  notes: string;
}

export const SYNDICATE_POLICY_MATRIX: readonly SyndicatePolicyMatrixRow[] = [
  {
    actor: 'PLAYER',
    kind: 'PLAYER',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PRIVATE',
    visibilityFloor: 'STANDARD',
    notes: 'Private player speech is allowed when membership/trust/clearance permit.',
  },
  {
    actor: 'PLAYER',
    kind: 'TACTICAL_CALL',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PINNED',
    visibilityFloor: 'PINNED',
    notes: 'Tactical calls deserve pin-friendly handling.',
  },
  {
    actor: 'PLAYER',
    kind: 'SQUAD_SIGNAL',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PINNED',
    visibilityFloor: 'PINNED',
    notes: 'Squad signals are short-form tactical guidance.',
  },
  {
    actor: 'PLAYER',
    kind: 'PROOF_WITNESS',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PRIVATE',
    visibilityFloor: 'STANDARD',
    notes: 'Proof witness is allowed privately even when not public-facing.',
  },
  {
    actor: 'SYSTEM',
    kind: 'SYSTEM',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PINNED',
    visibilityFloor: 'PINNED',
    notes: 'Trusted system room notices may pin.',
  },
  {
    actor: 'SYSTEM',
    kind: 'SYSTEM_DIRECTIVE',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_SEALED',
    visibilityFloor: 'COMMAND',
    notes: 'Command-style directives are among the highest-authority private events.',
  },
  {
    actor: 'HELPER',
    kind: 'HELPER_TIP',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PRIVATE',
    visibilityFloor: 'STANDARD',
    notes: 'Private helper tips are valid when security posture allows them.',
  },
  {
    actor: 'HELPER',
    kind: 'COUNTER_INTEL',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PINNED',
    visibilityFloor: 'PINNED',
    notes: 'Counter-intel can escalate within the room without leaving the room.',
  },
  {
    actor: 'NPC',
    kind: 'ALLY_NOTE',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PRIVATE',
    visibilityFloor: 'STANDARD',
    notes: 'Ally notes are private color with tactical value.',
  },
  {
    actor: 'COMMAND_PROXY',
    kind: 'RESOURCE_ALERT',
    baseDecision: 'ALLOW',
    transcript: 'APPEND_PINNED',
    visibilityFloor: 'PINNED',
    notes: 'Command proxies may deliver resource alerts into the private lane.',
  },
  {
    actor: 'HATER',
    kind: 'BOT_TAUNT',
    baseDecision: 'SUPPRESS',
    transcript: 'DROP',
    visibilityFloor: 'WHISPER',
    notes: 'Hostile public-taunt semantics are blocked from SYNDICATE by default.',
  },
  {
    actor: 'HATER',
    kind: 'BOT_ATTACK',
    baseDecision: 'SUPPRESS',
    transcript: 'DROP',
    visibilityFloor: 'WHISPER',
    notes: 'Attack witness belongs in public/battle lanes, not default syndicate privacy.',
  },
];

export function listSyndicateMatrixRowsForActor(
  actor: SyndicateSpeakerClass,
): SyndicatePolicyMatrixRow[] {
  return SYNDICATE_POLICY_MATRIX.filter((row) => row.actor === actor);
}

export function inferSyndicateAudienceBand(
  audience: SyndicateAudienceState,
): SyndicateAudienceBand {
  return syndAudienceBand(audience);
}

export function inferSyndicateBodyFingerprint(body: string): string {
  return syndBodyFingerprint(body);
}

export function inferSyndicateModeFamily(
  mode: SyndicateRunMode,
  family?: SyndicateModeFamily | null,
): SyndicateModeFamily {
  return syndModeFamily(mode, family);
}

// ============================================================================
// Audit / telemetry-friendly record
// ============================================================================

export interface SyndicatePolicyAuditRecord {
  channel: SyndicateChannelId;
  runMode: SyndicateRunMode;
  modeFamily: SyndicateModeFamily;
  roomId: string;
  roomType: string;
  securityTier: SyndicateSecurityTier;
  actorId: string;
  actorRole: SyndicateRole;
  actorClass: SyndicateSpeakerClass;
  kind: SyndicateMessageKind;
  decision: SyndicateAdmissionDecision;
  visibility: SyndicateVisibilityBand;
  transcript: SyndicateTranscriptDisposition;
  score: number;
  reasons: SyndicatePolicyReason[];
}

export function createSyndicatePolicyAuditRecord(
  input: SyndicatePolicyInput,
  decision: SyndicateIngressDecision,
): SyndicatePolicyAuditRecord {
  return {
    channel: SYNDICATE_CHANNEL_ID,
    runMode: input.gameplay.runMode,
    modeFamily: syndModeFamily(input.gameplay.runMode, input.gameplay.modeFamily ?? null),
    roomId: input.membership.roomId,
    roomType: input.membership.roomType,
    securityTier: input.membership.securityTier,
    actorId: input.message.actor.actorId,
    actorRole: input.message.actor.role,
    actorClass: input.message.actor.speakerClass,
    kind: input.message.kind,
    decision: decision.decision,
    visibility: decision.visibility,
    transcript: decision.transcript,
    score: decision.score,
    reasons: decision.reasons,
  };
}

// ============================================================================
// Canonical export surface
// ============================================================================

export default SyndicateChannelPolicy;
