/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CARRYOVER RESOLVER
 * FILE: backend/src/game/engine/chat/continuity/CarryoverResolver.ts
 * VERSION: 2026.03.20-continuity-refactor
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Resolve durable backend continuity into a mount-aware carryover package that
 * frontend, transport, replay, and orchestration surfaces can trust.
 *
 * This file remains intentionally additive. It does not mutate ChatState,
 * render UI, or bypass the continuity ledger. It transforms authoritative
 * continuity snapshots into a richer projection that can survive screen swaps,
 * run-state pivots, recovery flows, and transport handoffs without inventing
 * emotional truth on the frontend.
 *
 * Design doctrine
 * ---------------
 * - Continuity comes from backend state, not UI memory.
 * - The resolver is mode-aware but never mode-coupled to donor zones.
 * - Escorts, reveals, and relationships are ranked, not merely copied.
 * - Overlay recovery is deliberate, not an accidental side effect.
 * - Server envelopes carry explanation, not just raw identifiers.
 * - Debug notes must explain why continuity moved, not only that it moved.
 */

import type {
  ChatRoomId,
  ChatState,
  ChatUserId,
  ChatVisibleChannel,
  JsonValue,
  UnixMs,
} from '../types';
import {
  BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS,
  type BackendChatContinuityActorCue,
  type BackendChatContinuityBand,
  type BackendChatContinuityOverlayState,
  type BackendChatContinuityRelationshipDigest,
  type BackendChatContinuityRevealCue,
  type BackendChatContinuityTemperature,
  type BackendChatEscortStyle,
  type BackendChatMountTarget,
  type BackendChatMountTransitionRecord,
  type BackendChatPlayerContinuityState,
  type BackendChatRoomContinuitySnapshot,
  type BackendChatTransitionReason,
  CrossModeContinuityLedger,
} from './CrossModeContinuityLedger';

// ============================================================================
// MARK: Public resolver contracts
// ============================================================================

export type CarryoverSceneEntryMode =
  | 'OPEN_WITH_SCENE'
  | 'DEFERRED_ENTRY'
  | 'SHADOW_PRESENCE'
  | 'SUPPRESSED';

export type CarryoverRevealWindowClass =
  | 'NOW'
  | 'NEXT_BEAT'
  | 'DEFER_TO_PRESSURE'
  | 'DEFER_TO_RECOVERY'
  | 'SHADOW_RESOLVE';

export type CarryoverOverlayStrategy =
  | 'REOPEN_NOW'
  | 'REOPEN_ON_ESCORT'
  | 'REOPEN_ON_REVEAL'
  | 'PRESERVE_CALM'
  | 'STAY_COLLAPSED';

export type CarryoverContinuityHealth = 'STABLE' | 'WATCH' | 'ACTIVE' | 'CRITICAL';

export interface CarryoverEscortDirective {
  readonly actorId: string;
  readonly displayName: string;
  readonly personaId?: string;
  readonly sourceChannelId: string;
  readonly escortStyle: BackendChatEscortStyle;
  readonly visible: boolean;
  readonly shadowOnly: boolean;
  readonly delayMs: number;
  readonly openWithScene: boolean;
  readonly entryMode: CarryoverSceneEntryMode;
  readonly reason: string;
  readonly threat01: number;
  readonly helper01: number;
  readonly intimacy01: number;
  readonly escortScore01: number;
  readonly priority01: number;
  readonly relationshipStance?: string;
  readonly transportHint: string;
  readonly tags: readonly string[];
}

export interface CarryoverRelationshipDirective {
  readonly actorId: string;
  readonly relationshipId: string;
  readonly stance: string;
  readonly intensity01: number;
  readonly threat01: number;
  readonly helperBias01: number;
  readonly intimacy01: number;
  readonly trust01: number;
  readonly fear01: number;
  readonly contempt01: number;
  readonly fascination01: number;
  readonly rivalry01: number;
  readonly rescueDebt01: number;
  readonly priority01: number;
  readonly summaryLine: string;
  readonly axisPatch: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
}

export interface CarryoverRevealDirective {
  readonly revealId: string;
  readonly actorId?: string;
  readonly surfaceTiming: 'IMMEDIATE' | 'DELAYED' | 'SHADOW_ONLY';
  readonly revealWindow: CarryoverRevealWindowClass;
  readonly delayMs: number;
  readonly channelId: string;
  readonly targetVisibleChannel: ChatVisibleChannel;
  readonly summaryLine: string;
  readonly tags: readonly string[];
  readonly openOverlay: boolean;
  readonly priority01: number;
  readonly threatWeighted: boolean;
}

export interface CarryoverOverlayDirective {
  readonly strategy: CarryoverOverlayStrategy;
  readonly restoreCollapsed: boolean;
  readonly restorePanelOpen: boolean;
  readonly transcriptWindowTarget: number;
  readonly preferredChannel: ChatVisibleChannel;
  readonly reason: string;
  readonly sourceOverlay: BackendChatContinuityOverlayState;
}

export interface CarryoverTransportHint {
  readonly hintId: string;
  readonly kind:
    | 'RESTORE_CHANNEL'
    | 'ESCORT_ENTRY'
    | 'REVEAL_WINDOW'
    | 'OVERLAY_POLICY'
    | 'RELATIONSHIP_PRESSURE';
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly priority01: number;
  readonly delayMs: number;
  readonly visibleChannel?: ChatVisibleChannel;
  readonly actorId?: string;
  readonly revealId?: string;
  readonly payload: Readonly<Record<string, JsonValue>>;
}

export interface CarryoverMetrics {
  readonly continuityScore01: number;
  readonly escortPressure01: number;
  readonly revealPressure01: number;
  readonly relationshipPressure01: number;
  readonly unresolvedMomentPressure01: number;
  readonly transportUrgency01: number;
  readonly health: CarryoverContinuityHealth;
}

export interface CarryoverFrontendPatch {
  readonly summaryId: string;
  readonly builtAt: UnixMs;
  readonly fromMount: BackendChatMountTarget;
  readonly toMount: BackendChatMountTarget;
  readonly preferredVisibleChannel: ChatVisibleChannel;
  readonly restoredVisibleChannel?: ChatVisibleChannel;
  readonly activeSceneId?: string;
  readonly activeMomentId?: string;
  readonly activeLegendId?: string;
  readonly unresolvedMomentIds: readonly string[];
  readonly carriedPersonaIds: readonly string[];
  readonly carriedActorIds: readonly string[];
  readonly escortActorId?: string;
  readonly summaryLine: string;
  readonly shadowSummaryLine: string;
  readonly tensionBand: BackendChatContinuityBand;
  readonly temperature: BackendChatContinuityTemperature;
  readonly continuityScore01: number;
  readonly overlay: {
    readonly strategy: CarryoverOverlayStrategy;
    readonly restoreCollapsed: boolean;
    readonly restorePanelOpen: boolean;
    readonly transcriptWindowTarget: number;
    readonly preferredChannel: ChatVisibleChannel;
    readonly reason: string;
  };
  readonly escortSummary: readonly Readonly<Record<string, JsonValue>>[];
  readonly revealSummary: readonly Readonly<Record<string, JsonValue>>[];
  readonly relationshipSummary: readonly Readonly<Record<string, JsonValue>>[];
  readonly worldState: Readonly<Record<string, JsonValue>>;
  readonly transcriptPreview: readonly Readonly<Record<string, JsonValue>>[];
}

export interface CarryoverServerEnvelope {
  readonly continuityId: string;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly eventName: 'chat_continuity_resolved';
  readonly createdAt: UnixMs;
  readonly payload: Readonly<Record<string, JsonValue>>;
}

export interface CarryoverResolution {
  readonly resolutionId: string;
  readonly builtAt: UnixMs;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly fromMount: BackendChatMountTarget;
  readonly toMount: BackendChatMountTarget;
  readonly reason: BackendChatTransitionReason;
  readonly continuitySnapshot: BackendChatRoomContinuitySnapshot;
  readonly playerState?: BackendChatPlayerContinuityState;
  readonly transitionRecord?: BackendChatMountTransitionRecord;
  readonly restoredChannel: ChatVisibleChannel;
  readonly overlayDirective: CarryoverOverlayDirective;
  readonly escorts: readonly CarryoverEscortDirective[];
  readonly relationshipDirectives: readonly CarryoverRelationshipDirective[];
  readonly revealDirectives: readonly CarryoverRevealDirective[];
  readonly transportHints: readonly CarryoverTransportHint[];
  readonly metrics: CarryoverMetrics;
  readonly frontendPatch: CarryoverFrontendPatch;
  readonly serverEnvelope: CarryoverServerEnvelope;
  readonly debugNotes: readonly string[];
}

export interface ResolveCarryoverArgs {
  readonly state: Readonly<ChatState>;
  readonly roomId: ChatRoomId;
  readonly userId: ChatUserId;
  readonly fromMount: BackendChatMountTarget;
  readonly toMount: BackendChatMountTarget;
  readonly reason?: BackendChatTransitionReason;
  readonly now?: UnixMs;
  readonly persistTransition?: boolean;
}

export interface CarryoverResolverConfig {
  readonly maxEscortCount: number;
  readonly maxRelationshipDirectives: number;
  readonly maxRevealDirectives: number;
  readonly maxTransportHints: number;
  readonly maxDebugNotes: number;
  readonly revealImmediateWindowMs: number;
  readonly revealDeferredFloorMs: number;
  readonly revealDeferredCeilingMs: number;
  readonly shadowRevealThreatThreshold01: number;
  readonly helperDelayBiasMs: number;
  readonly rivalDelayBiasMs: number;
  readonly shadowDelayBiasMs: number;
  readonly silenceFloorMs: number;
  readonly transcriptPatchCap: number;
  readonly staleEscortWindowMs: number;
  readonly activeMomentBoost01: number;
  readonly activeSceneBoost01: number;
  readonly pendingRevealBoost01: number;
  readonly unresolvedMomentBoost01: number;
  readonly playerSummaryBias01: number;
  readonly overlayOpenPressureFloor01: number;
  readonly overlayOpenUrgencyFloor01: number;
}

export const DEFAULT_CARRYOVER_RESOLVER_CONFIG: CarryoverResolverConfig = Object.freeze({
  maxEscortCount: 4,
  maxRelationshipDirectives: 6,
  maxRevealDirectives: 6,
  maxTransportHints: 10,
  maxDebugNotes: 24,
  revealImmediateWindowMs: 2_400,
  revealDeferredFloorMs: 1_250,
  revealDeferredCeilingMs: 9_500,
  shadowRevealThreatThreshold01: 0.63,
  helperDelayBiasMs: 850,
  rivalDelayBiasMs: 1_450,
  shadowDelayBiasMs: 1_150,
  silenceFloorMs: 1_200,
  transcriptPatchCap: 8,
  staleEscortWindowMs: 7 * 60 * 1000,
  activeMomentBoost01: 0.12,
  activeSceneBoost01: 0.08,
  pendingRevealBoost01: 0.1,
  unresolvedMomentBoost01: 0.09,
  playerSummaryBias01: 0.05,
  overlayOpenPressureFloor01: 0.42,
  overlayOpenUrgencyFloor01: 0.38,
});

// ============================================================================
// MARK: Utility
// ============================================================================

function nowUnixMs(): UnixMs {
  return Date.now() as UnixMs;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value <= min) return min;
  if (value >= max) return max;
  return Math.round(value);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average01(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return clamp01(sum(values) / values.length);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function compactStrings(values: readonly (string | undefined | null | false)[]): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function asVisibleChannel(value: string | undefined): ChatVisibleChannel | undefined {
  switch (value) {
    case 'GLOBAL':
    case 'SYNDICATE':
    case 'DEAL_ROOM':
    case 'LOBBY':
      return value;
    default:
      return undefined;
  }
}

function lower(value: string): string {
  return value.toLowerCase();
}

function relationshipStanceTag(stance: string | undefined): string | undefined {
  return stance ? `STANCE:${stance}` : undefined;
}

function defaultChannelForMount(target: BackendChatMountTarget): ChatVisibleChannel {
  return BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[target].defaultVisibleChannel;
}

function prefersPrivatePressure(target: BackendChatMountTarget): boolean {
  return target === 'PREDATOR_GAME_SCREEN';
}

function prefersTeamCoordination(target: BackendChatMountTarget): boolean {
  return target === 'SYNDICATE_GAME_SCREEN' || target === 'EMPIRE_GAME_SCREEN';
}

function mountTransportBias01(target: BackendChatMountTarget): number {
  switch (target) {
    case 'BATTLE_HUD':
      return 0.92;
    case 'PREDATOR_GAME_SCREEN':
      return 0.88;
    case 'PHANTOM_GAME_SCREEN':
      return 0.84;
    case 'GAME_BOARD':
      return 0.72;
    case 'EMPIRE_GAME_SCREEN':
      return 0.7;
    case 'SYNDICATE_GAME_SCREEN':
      return 0.68;
    case 'POST_RUN_SUMMARY':
      return 0.52;
    case 'CLUB_UI':
    case 'LEAGUE_UI':
      return 0.38;
    case 'LOBBY_SCREEN':
      return 0.3;
    default:
      return 0.5;
  }
}

function mountRevealBias01(target: BackendChatMountTarget): number {
  switch (target) {
    case 'PREDATOR_GAME_SCREEN':
      return 0.82;
    case 'BATTLE_HUD':
      return 0.78;
    case 'PHANTOM_GAME_SCREEN':
      return 0.74;
    case 'GAME_BOARD':
      return 0.66;
    case 'SYNDICATE_GAME_SCREEN':
      return 0.62;
    case 'EMPIRE_GAME_SCREEN':
      return 0.58;
    case 'POST_RUN_SUMMARY':
      return 0.44;
    case 'LOBBY_SCREEN':
      return 0.35;
    case 'CLUB_UI':
    case 'LEAGUE_UI':
      return 0.28;
    default:
      return 0.5;
  }
}

function mountRelationshipBias01(target: BackendChatMountTarget): number {
  switch (target) {
    case 'SYNDICATE_GAME_SCREEN':
      return 0.84;
    case 'EMPIRE_GAME_SCREEN':
      return 0.78;
    case 'PREDATOR_GAME_SCREEN':
      return 0.72;
    case 'PHANTOM_GAME_SCREEN':
      return 0.7;
    case 'GAME_BOARD':
      return 0.6;
    case 'POST_RUN_SUMMARY':
      return 0.56;
    case 'BATTLE_HUD':
      return 0.52;
    case 'LOBBY_SCREEN':
      return 0.34;
    case 'CLUB_UI':
    case 'LEAGUE_UI':
      return 0.3;
    default:
      return 0.5;
  }
}

function chooseRestoredChannel(
  snapshot: BackendChatRoomContinuitySnapshot,
  toMount: BackendChatMountTarget,
  reason: BackendChatTransitionReason,
  playerState?: BackendChatPlayerContinuityState,
): ChatVisibleChannel {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount];
  const allowed = preset.allowedVisibleChannels;
  const playerPreferred = asVisibleChannel(
    typeof playerState?.carryoverSummary?.preferredVisibleChannel === 'string'
      ? String(playerState.carryoverSummary.preferredVisibleChannel)
      : undefined,
  );

  if (reason === 'POST_RUN' && allowed.includes('GLOBAL')) {
    return 'GLOBAL';
  }

  if (prefersPrivatePressure(toMount) && allowed.includes('DEAL_ROOM') && snapshot.carriedActors.some((cue) => cue.threat01 >= 0.58)) {
    return 'DEAL_ROOM';
  }

  if (prefersTeamCoordination(toMount) && allowed.includes('SYNDICATE') && snapshot.carriedActors.some((cue) => cue.helper01 >= 0.55)) {
    return 'SYNDICATE';
  }

  if (playerPreferred && allowed.includes(playerPreferred)) {
    return playerPreferred;
  }

  if (allowed.includes(snapshot.preferredVisibleChannel)) {
    return snapshot.preferredVisibleChannel;
  }

  if (allowed.includes(snapshot.overlay.preferredChannel)) {
    return snapshot.overlay.preferredChannel;
  }

  return preset.defaultVisibleChannel;
}

function msAgo(now: UnixMs, then: UnixMs): number {
  return Math.max(0, Number(now) - Number(then));
}

function cueFreshness01(cue: BackendChatContinuityActorCue, now: UnixMs, config: CarryoverResolverConfig): number {
  const ageMs = msAgo(now, cue.lastSeenAt);
  if (ageMs <= 0) return 1;
  if (ageMs >= config.staleEscortWindowMs) return 0;
  return clamp01(1 - (ageMs / config.staleEscortWindowMs));
}

function determineEscortStyle(
  cue: BackendChatContinuityActorCue,
  toMount: BackendChatMountTarget,
): BackendChatEscortStyle {
  if (cue.preferredEscortStyle !== 'NONE') {
    if (toMount === 'PREDATOR_GAME_SCREEN' && cue.threat01 >= Math.max(0.5, cue.helper01)) {
      return 'PREDATOR_STALK';
    }
    if (toMount === 'PHANTOM_GAME_SCREEN' && cue.shadowFollow) {
      return 'SHADOW_ESCORT';
    }
    return cue.preferredEscortStyle;
  }

  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount];
  if (cue.shadowFollow) return preset.preferredEscortStyle === 'VISIBLE_ESCORT' ? 'SHADOW_ESCORT' : preset.preferredEscortStyle;
  if (cue.visibleFollow) return preset.preferredEscortStyle === 'NONE' ? 'VISIBLE_ESCORT' : preset.preferredEscortStyle;
  return 'NONE';
}

function escortPriority01(
  cue: BackendChatContinuityActorCue,
  snapshot: BackendChatRoomContinuitySnapshot,
  toMount: BackendChatMountTarget,
  now: UnixMs,
  config: CarryoverResolverConfig,
): number {
  const freshness = cueFreshness01(cue, now, config);
  const mountBias = mountTransportBias01(toMount) * 0.12;
  const visibleBias = cue.visibleFollow ? 0.12 : 0;
  const shadowBias = cue.shadowFollow ? 0.08 : 0;
  const relationshipBias = clamp01(cue.relationship?.intensity01 ?? 0) * 0.16;
  const unresolvedBias = clamp01(cue.unresolvedMomentum01) * 0.18;
  const threatHelper = Math.max(cue.threat01, cue.helper01) * 0.22;
  const escort = clamp01(cue.escortScore01) * 0.18;
  const activeMomentBias = snapshot.activeMomentId ? config.activeMomentBoost01 : 0;
  const activeSceneBias = snapshot.activeSceneId ? config.activeSceneBoost01 : 0;
  const revealBias = snapshot.hasPendingReveals ? config.pendingRevealBoost01 : 0;

  return clamp01(
    freshness * 0.14
    + mountBias
    + visibleBias
    + shadowBias
    + relationshipBias
    + unresolvedBias
    + threatHelper
    + escort
    + activeMomentBias
    + activeSceneBias
    + revealBias,
  );
}

function determineEscortDelayMs(
  cue: BackendChatContinuityActorCue,
  toMount: BackendChatMountTarget,
  now: UnixMs,
  config: CarryoverResolverConfig,
): number {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount];
  const freshness = cueFreshness01(cue, now, config);
  const base = cue.helper01 >= cue.threat01
    ? config.helperDelayBiasMs + ((1 - cue.helper01) * 900)
    : config.rivalDelayBiasMs + (cue.threat01 * 1_250);

  if (cue.preferredEscortStyle === 'PREDATOR_STALK' || preset.preferredEscortStyle === 'PREDATOR_STALK') {
    return clampInt(base + 900 - (freshness * 240), 650, config.revealDeferredCeilingMs);
  }

  if (cue.preferredEscortStyle === 'SILENT_WATCH' || preset.preferredEscortStyle === 'SILENT_WATCH') {
    return clampInt(base + 400 - (freshness * 180), 350, config.revealDeferredCeilingMs);
  }

  if (cue.shadowFollow && !cue.visibleFollow) {
    return clampInt(base + config.shadowDelayBiasMs - (freshness * 120), 450, config.revealDeferredCeilingMs);
  }

  if (cue.visibleFollow) {
    return clampInt(base * 0.55, 200, config.revealDeferredCeilingMs);
  }

  return clampInt(base, 350, config.revealDeferredCeilingMs);
}

function escortOpenWithScene(cue: BackendChatContinuityActorCue, snapshot: BackendChatRoomContinuitySnapshot): boolean {
  if (cue.helper01 >= 0.72 && snapshot.temperature !== 'HOSTILE') return true;
  if (cue.threat01 >= 0.76 && snapshot.temperature === 'HOSTILE') return true;
  if (cue.unresolvedMomentum01 >= 0.66) return true;
  if (cue.relationship?.intensity01 && cue.relationship.intensity01 >= 0.74) return true;
  return false;
}

function escortEntryMode(
  cue: BackendChatContinuityActorCue,
  snapshot: BackendChatRoomContinuitySnapshot,
  style: BackendChatEscortStyle,
): CarryoverSceneEntryMode {
  if (!cue.visibleFollow && cue.shadowFollow) return 'SHADOW_PRESENCE';
  if (style === 'SHADOW_ESCORT' || style === 'PREDATOR_STALK') return 'SHADOW_PRESENCE';
  if (escortOpenWithScene(cue, snapshot)) return 'OPEN_WITH_SCENE';
  if (cue.visibleFollow || cue.helper01 >= 0.58) return 'DEFERRED_ENTRY';
  return 'SUPPRESSED';
}

function escortReason(
  cue: BackendChatContinuityActorCue,
  snapshot: BackendChatRoomContinuitySnapshot,
  style: BackendChatEscortStyle,
  priority01: number,
): string {
  const reasons: string[] = [];
  if (cue.helper01 >= cue.threat01) reasons.push('helper_bias');
  if (cue.threat01 > cue.helper01) reasons.push('rival_bias');
  if (cue.visibleFollow) reasons.push('visible_follow');
  if (cue.shadowFollow) reasons.push('shadow_follow');
  if (cue.relationship?.stance) reasons.push(`stance_${lower(cue.relationship.stance)}`);
  if (snapshot.activeMomentId) reasons.push('active_moment');
  if (snapshot.activeSceneId) reasons.push('active_scene');
  if (snapshot.hasPendingReveals) reasons.push('pending_reveal_pressure');
  if (style === 'PREDATOR_STALK') reasons.push('predator_mount');
  if (priority01 >= 0.72) reasons.push('priority_hot');
  return reasons.join('|') || 'continuity_escort';
}

function escortTransportHint(
  cue: BackendChatContinuityActorCue,
  style: BackendChatEscortStyle,
  visible: boolean,
): string {
  if (style === 'PREDATOR_STALK') return 'escort.predator.stalk';
  if (!visible && cue.shadowFollow) return 'escort.shadow.persist';
  if (cue.helper01 >= cue.threat01) return 'escort.helper.recover';
  return 'escort.rival.pressure';
}

function relationshipPriority01(
  rel: BackendChatContinuityRelationshipDigest,
  toMount: BackendChatMountTarget,
  snapshot: BackendChatRoomContinuitySnapshot,
  config: CarryoverResolverConfig,
): number {
  const mountBias = mountRelationshipBias01(toMount) * 0.15;
  const activeMomentBias = snapshot.activeMomentId ? config.activeMomentBoost01 : 0;
  const revealBias = snapshot.hasPendingReveals ? 0.04 : 0;

  return clamp01(
    (rel.intensity01 * 0.34)
    + (Math.max(rel.threat01, rel.helperBias01) * 0.18)
    + (rel.intimacy01 * 0.1)
    + (rel.rivalry01 * 0.08)
    + (rel.fascination01 * 0.07)
    + (rel.rescueDebt01 * 0.05)
    + mountBias
    + activeMomentBias
    + revealBias,
  );
}

function relationshipDirective(
  rel: BackendChatContinuityRelationshipDigest,
  priority01: number,
): CarryoverRelationshipDirective {
  const tags = compactStrings([
    relationshipStanceTag(rel.stance),
    rel.helperBias01 >= rel.threat01 ? 'HELPER_LEAN' : 'THREAT_LEAN',
    rel.rescueDebt01 >= 0.4 ? 'RESCUE_DEBT' : '',
    rel.rivalry01 >= 0.5 ? 'RIVALRY_HOT' : '',
    rel.fascination01 >= 0.5 ? 'FASCINATION_HOT' : '',
  ]);

  return {
    actorId: rel.actorId,
    relationshipId: rel.relationshipId,
    stance: rel.stance,
    intensity01: rel.intensity01,
    threat01: rel.threat01,
    helperBias01: rel.helperBias01,
    intimacy01: rel.intimacy01,
    trust01: rel.trust01,
    fear01: rel.fear01,
    contempt01: rel.contempt01,
    fascination01: rel.fascination01,
    rivalry01: rel.rivalry01,
    rescueDebt01: rel.rescueDebt01,
    priority01,
    summaryLine: `${rel.actorId}=${lower(rel.stance)} intensity:${rel.intensity01.toFixed(2)} helper:${rel.helperBias01.toFixed(2)} threat:${rel.threat01.toFixed(2)}`,
    axisPatch: {
      trust01: rel.trust01,
      fear01: rel.fear01,
      contempt01: rel.contempt01,
      fascination01: rel.fascination01,
      rivalry01: rel.rivalry01,
      rescueDebt01: rel.rescueDebt01,
      intimacy01: rel.intimacy01,
      helperBias01: rel.helperBias01,
      threat01: rel.threat01,
    },
    tags,
  };
}

function revealTagScore(tags: readonly string[]): number {
  if (tags.length === 0) return 0;
  let score = 0;
  for (const tag of tags) {
    if (/IDENTITY|RECEIPT|LEGEND|BETRAYAL|DEBT|OFFER|PROOF/i.test(tag)) score += 0.14;
    else if (/FOLLOW|SCENE|MOMENT|RIVAL|HELPER|ALLY/i.test(tag)) score += 0.08;
    else score += 0.03;
  }
  return clamp01(score);
}

function revealPriority01(
  cue: BackendChatContinuityRevealCue,
  snapshot: BackendChatRoomContinuitySnapshot,
  strongestThreat01: number,
  toMount: BackendChatMountTarget,
  now: UnixMs,
  config: CarryoverResolverConfig,
): number {
  const msUntil = Math.max(0, Number(cue.revealAt) - Number(now));
  const imminence = clamp01(1 - (msUntil / Math.max(config.revealDeferredCeilingMs, 1)));
  const tagScore = revealTagScore(cue.tags);
  const threatBias = strongestThreat01 * 0.16;
  const mountBias = mountRevealBias01(toMount) * 0.14;
  const activeMomentBias = snapshot.activeMomentId ? config.activeMomentBoost01 : 0;
  const unresolvedBias = snapshot.unresolvedMoments.some((item) => item.channelId === asVisibleChannel(cue.channelId))
    ? config.unresolvedMomentBoost01
    : 0;

  return clamp01(
    (imminence * 0.42)
    + tagScore
    + threatBias
    + mountBias
    + activeMomentBias
    + unresolvedBias,
  );
}

function revealSurfaceTiming(
  cue: BackendChatContinuityRevealCue,
  snapshot: BackendChatRoomContinuitySnapshot,
  strongestThreat01: number,
  priority01: number,
  now: UnixMs,
  toMount: BackendChatMountTarget,
  config: CarryoverResolverConfig,
): CarryoverRevealDirective['surfaceTiming'] {
  const msUntil = Number(cue.revealAt) - Number(now);

  if (msUntil <= config.revealImmediateWindowMs) return 'IMMEDIATE';

  if (
    snapshot.temperature === 'HOSTILE'
    && strongestThreat01 >= config.shadowRevealThreatThreshold01
    && !prefersTeamCoordination(toMount)
  ) {
    return 'SHADOW_ONLY';
  }

  if (
    snapshot.temperature === 'PRESSURED'
    && cue.tags.some((tag) => /IDENTITY|RECEIPT|LEGEND|PROOF/i.test(tag))
    && priority01 >= 0.5
  ) {
    return 'DELAYED';
  }

  if (priority01 < 0.32 && snapshot.overlay.restoreCollapsed) {
    return 'SHADOW_ONLY';
  }

  return 'DELAYED';
}

function revealWindowClass(
  timing: CarryoverRevealDirective['surfaceTiming'],
  cue: BackendChatContinuityRevealCue,
  now: UnixMs,
  snapshot: BackendChatRoomContinuitySnapshot,
  priority01: number,
  config: CarryoverResolverConfig,
): CarryoverRevealWindowClass {
  const msUntil = Math.max(0, Number(cue.revealAt) - Number(now));

  if (timing === 'SHADOW_ONLY') return 'SHADOW_RESOLVE';
  if (msUntil <= config.revealImmediateWindowMs) return 'NOW';
  if (priority01 >= 0.68 || snapshot.activeMomentId) return 'NEXT_BEAT';
  if (snapshot.temperature === 'PRESSURED' || snapshot.temperature === 'HOSTILE') return 'DEFER_TO_PRESSURE';
  return 'DEFER_TO_RECOVERY';
}

function revealDelayMs(
  cue: BackendChatContinuityRevealCue,
  timing: CarryoverRevealDirective['surfaceTiming'],
  windowClass: CarryoverRevealWindowClass,
  now: UnixMs,
  config: CarryoverResolverConfig,
): number {
  const delta = Number(cue.revealAt) - Number(now);

  if (timing === 'IMMEDIATE') {
    return Math.max(0, delta);
  }

  if (timing === 'SHADOW_ONLY') {
    return clampInt(delta + 1_250, config.revealDeferredFloorMs, config.revealDeferredCeilingMs);
  }

  if (windowClass === 'NEXT_BEAT') {
    return clampInt(Math.max(delta, config.silenceFloorMs), config.silenceFloorMs, config.revealDeferredCeilingMs);
  }

  return clampInt(Math.max(delta, config.revealDeferredFloorMs), config.revealDeferredFloorMs, config.revealDeferredCeilingMs);
}

function revealTargetVisibleChannel(
  cue: BackendChatContinuityRevealCue,
  restoredChannel: ChatVisibleChannel,
  snapshot: BackendChatRoomContinuitySnapshot,
  toMount: BackendChatMountTarget,
): ChatVisibleChannel {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount];
  const cueVisible = asVisibleChannel(cue.channelId);
  if (cueVisible && preset.allowedVisibleChannels.includes(cueVisible)) {
    return cueVisible;
  }

  if (prefersPrivatePressure(toMount) && preset.allowedVisibleChannels.includes('DEAL_ROOM')) {
    return 'DEAL_ROOM';
  }

  if (prefersTeamCoordination(toMount) && preset.allowedVisibleChannels.includes('SYNDICATE')) {
    return 'SYNDICATE';
  }

  if (preset.allowedVisibleChannels.includes(restoredChannel)) {
    return restoredChannel;
  }

  if (preset.allowedVisibleChannels.includes(snapshot.preferredVisibleChannel)) {
    return snapshot.preferredVisibleChannel;
  }

  return preset.defaultVisibleChannel;
}

function revealShouldOpenOverlay(
  timing: CarryoverRevealDirective['surfaceTiming'],
  priority01: number,
  snapshot: BackendChatRoomContinuitySnapshot,
): boolean {
  if (timing === 'IMMEDIATE') return true;
  if (priority01 >= 0.7) return true;
  if (snapshot.activeMomentId && priority01 >= 0.48) return true;
  if (!snapshot.overlay.restoreCollapsed && priority01 >= 0.42) return true;
  return false;
}

function overlayStrategy(
  snapshot: BackendChatRoomContinuitySnapshot,
  restoredChannel: ChatVisibleChannel,
  escorts: readonly CarryoverEscortDirective[],
  reveals: readonly CarryoverRevealDirective[],
  toMount: BackendChatMountTarget,
  config: CarryoverResolverConfig,
): CarryoverOverlayStrategy {
  const hotEscort = escorts.some((item) => item.openWithScene && item.priority01 >= 0.55);
  const hotReveal = reveals.some((item) => item.openOverlay && item.priority01 >= 0.55);
  const pressure = Math.max(snapshot.pressure01, snapshot.urgency01, snapshot.heat01);

  if (!BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount].allowCollapse) {
    return 'REOPEN_NOW';
  }

  if (pressure >= Math.max(config.overlayOpenPressureFloor01, config.overlayOpenUrgencyFloor01)) {
    return 'REOPEN_NOW';
  }

  if (hotEscort) {
    return 'REOPEN_ON_ESCORT';
  }

  if (hotReveal) {
    return 'REOPEN_ON_REVEAL';
  }

  if (snapshot.overlay.restoreCollapsed && restoredChannel === defaultChannelForMount(toMount)) {
    return 'STAY_COLLAPSED';
  }

  return 'PRESERVE_CALM';
}

function overlayDirective(
  snapshot: BackendChatRoomContinuitySnapshot,
  restoredChannel: ChatVisibleChannel,
  escorts: readonly CarryoverEscortDirective[],
  reveals: readonly CarryoverRevealDirective[],
  toMount: BackendChatMountTarget,
  config: CarryoverResolverConfig,
): CarryoverOverlayDirective {
  const strategy = overlayStrategy(snapshot, restoredChannel, escorts, reveals, toMount, config);
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount];

  const restoreCollapsed =
    strategy === 'STAY_COLLAPSED'
      ? true
      : strategy === 'PRESERVE_CALM'
        ? (preset.allowCollapse ? snapshot.overlay.restoreCollapsed : false)
        : false;

  const restorePanelOpen =
    strategy === 'REOPEN_NOW'
      ? true
      : strategy === 'REOPEN_ON_ESCORT'
        ? escorts.some((item) => item.openWithScene)
        : strategy === 'REOPEN_ON_REVEAL'
          ? reveals.some((item) => item.openOverlay)
          : !restoreCollapsed;

  const transcriptWindowTarget = clampInt(
    Math.max(
      1,
      Math.min(
        snapshot.overlay.transcriptWindowTarget,
        Math.max(
          config.transcriptPatchCap,
          escorts.length > 0 ? 3 : 1,
        ),
      ),
    ),
    1,
    Math.max(1, config.transcriptPatchCap),
  );

  const reason = compactStrings([
    `strategy:${strategy}`,
    `restored:${restoredChannel}`,
    `source:${snapshot.overlay.preferredChannel}`,
    escorts.length > 0 ? `escorts:${escorts.length}` : '',
    reveals.length > 0 ? `reveals:${reveals.length}` : '',
    restoreCollapsed ? 'collapsed' : 'expanded',
    restorePanelOpen ? 'panel_open' : 'panel_closed',
  ]).join(' | ');

  return {
    strategy,
    restoreCollapsed,
    restorePanelOpen,
    transcriptWindowTarget,
    preferredChannel: restoredChannel,
    reason,
    sourceOverlay: snapshot.overlay,
  };
}

function continuityHealth(
  continuityScore01: number,
  snapshot: BackendChatRoomContinuitySnapshot,
  escorts: readonly CarryoverEscortDirective[],
  reveals: readonly CarryoverRevealDirective[],
): CarryoverContinuityHealth {
  if (
    continuityScore01 >= 0.8
    || snapshot.temperature === 'HOSTILE'
    || escorts.some((item) => item.priority01 >= 0.8)
    || reveals.some((item) => item.priority01 >= 0.82)
  ) {
    return 'CRITICAL';
  }

  if (
    continuityScore01 >= 0.62
    || snapshot.temperature === 'PRESSURED'
    || snapshot.unresolvedMoments.some((item) => item.intensity01 >= 0.72)
  ) {
    return 'ACTIVE';
  }

  if (continuityScore01 >= 0.42 || snapshot.hasPendingReveals) {
    return 'WATCH';
  }

  return 'STABLE';
}

function buildMetrics(
  snapshot: BackendChatRoomContinuitySnapshot,
  escorts: readonly CarryoverEscortDirective[],
  relationships: readonly CarryoverRelationshipDirective[],
  reveals: readonly CarryoverRevealDirective[],
  toMount: BackendChatMountTarget,
): CarryoverMetrics {
  const escortPressure01 = average01(escorts.map((item) => item.priority01));
  const revealPressure01 = average01(reveals.map((item) => item.priority01));
  const relationshipPressure01 = average01(relationships.map((item) => item.priority01));
  const unresolvedMomentPressure01 = average01(snapshot.unresolvedMoments.map((item) => item.intensity01));
  const transportUrgency01 = clamp01(
    (mountTransportBias01(toMount) * 0.24)
    + (snapshot.pressure01 * 0.22)
    + (snapshot.urgency01 * 0.22)
    + (escortPressure01 * 0.12)
    + (revealPressure01 * 0.12)
    + (unresolvedMomentPressure01 * 0.08),
  );
  const continuityScore01 = clamp01(
    (snapshot.pressure01 * 0.18)
    + (snapshot.urgency01 * 0.18)
    + (snapshot.heat01 * 0.1)
    + (escortPressure01 * 0.18)
    + (revealPressure01 * 0.14)
    + (relationshipPressure01 * 0.12)
    + (unresolvedMomentPressure01 * 0.1),
  );

  return {
    continuityScore01,
    escortPressure01,
    revealPressure01,
    relationshipPressure01,
    unresolvedMomentPressure01,
    transportUrgency01,
    health: continuityHealth(continuityScore01, snapshot, escorts, reveals),
  };
}

function buildWorldStatePatch(
  snapshot: BackendChatRoomContinuitySnapshot,
  restoredChannel: ChatVisibleChannel,
  overlay: CarryoverOverlayDirective,
  metrics: CarryoverMetrics,
  escorts: readonly CarryoverEscortDirective[],
  relationships: readonly CarryoverRelationshipDirective[],
  reveals: readonly CarryoverRevealDirective[],
): Readonly<Record<string, JsonValue>> {
  return {
    roomId: snapshot.roomId,
    sourceMount: snapshot.sourceMount,
    preferredVisibleChannel: snapshot.preferredVisibleChannel,
    restoredVisibleChannel: restoredChannel,
    tensionBand: snapshot.tensionBand,
    temperature: snapshot.temperature,
    pressure01: snapshot.pressure01,
    urgency01: snapshot.urgency01,
    heat01: snapshot.heat01,
    occupancy: snapshot.occupancy,
    typingCount: snapshot.typingCount,
    hasPendingReveals: snapshot.hasPendingReveals,
    activeSceneId: snapshot.activeSceneId ?? null,
    activeMomentId: snapshot.activeMomentId ?? null,
    activeLegendId: snapshot.activeLegendId ?? null,
    roomStageMood: snapshot.roomStageMood,
    continuityTags: snapshot.tags,
    escortCount: escorts.length,
    relationshipCount: relationships.length,
    revealCount: reveals.length,
    overlayStrategy: overlay.strategy,
    overlayReason: overlay.reason,
    continuityScore01: metrics.continuityScore01,
    continuityHealth: metrics.health,
    escortPressure01: metrics.escortPressure01,
    revealPressure01: metrics.revealPressure01,
    relationshipPressure01: metrics.relationshipPressure01,
    unresolvedMomentPressure01: metrics.unresolvedMomentPressure01,
    transportUrgency01: metrics.transportUrgency01,
    leadEscortActorId: escorts[0]?.actorId ?? null,
    leadRelationshipActorId: relationships[0]?.actorId ?? null,
    leadRevealId: reveals[0]?.revealId ?? null,
  };
}

function mapTranscriptPreview(
  snapshot: BackendChatRoomContinuitySnapshot,
  cap: number,
): readonly Readonly<Record<string, JsonValue>>[] {
  return snapshot.transcriptPreview.slice(0, cap).map((entry) => ({
    messageId: entry.messageId,
    channelId: entry.channelId,
    plainText: entry.plainText,
    createdAt: entry.createdAt,
    actorId: entry.actorId,
    displayName: entry.displayName,
    sourceType: entry.sourceType,
    relevance01: entry.relevance01,
    visible: entry.visible,
    tags: [...entry.tags],
  }));
}

function escortSummary(
  escorts: readonly CarryoverEscortDirective[],
): readonly Readonly<Record<string, JsonValue>>[] {
  return escorts.map((escort) => ({
    actorId: escort.actorId,
    displayName: escort.displayName,
    escortStyle: escort.escortStyle,
    visible: escort.visible,
    shadowOnly: escort.shadowOnly,
    entryMode: escort.entryMode,
    priority01: escort.priority01,
    delayMs: escort.delayMs,
    reason: escort.reason,
    transportHint: escort.transportHint,
    tags: [...escort.tags],
  }));
}

function revealSummary(
  reveals: readonly CarryoverRevealDirective[],
): readonly Readonly<Record<string, JsonValue>>[] {
  return reveals.map((reveal) => ({
    revealId: reveal.revealId,
    actorId: reveal.actorId ?? null,
    surfaceTiming: reveal.surfaceTiming,
    revealWindow: reveal.revealWindow,
    targetVisibleChannel: reveal.targetVisibleChannel,
    delayMs: reveal.delayMs,
    openOverlay: reveal.openOverlay,
    priority01: reveal.priority01,
    tags: [...reveal.tags],
    summaryLine: reveal.summaryLine,
  }));
}

function relationshipSummary(
  relationships: readonly CarryoverRelationshipDirective[],
): readonly Readonly<Record<string, JsonValue>>[] {
  return relationships.map((relationship) => ({
    actorId: relationship.actorId,
    relationshipId: relationship.relationshipId,
    stance: relationship.stance,
    intensity01: relationship.intensity01,
    threat01: relationship.threat01,
    helperBias01: relationship.helperBias01,
    priority01: relationship.priority01,
    tags: [...relationship.tags],
    axisPatch: relationship.axisPatch,
    summaryLine: relationship.summaryLine,
  }));
}

// ============================================================================
// MARK: CarryoverResolver
// ============================================================================

export class CarryoverResolver {
  private readonly ledger: CrossModeContinuityLedger;
  private readonly config: CarryoverResolverConfig;

  public constructor(
    ledger: CrossModeContinuityLedger,
    config: Partial<CarryoverResolverConfig> = {},
  ) {
    this.ledger = ledger;
    this.config = Object.freeze({
      ...DEFAULT_CARRYOVER_RESOLVER_CONFIG,
      ...config,
    });
  }

  public getConfig(): CarryoverResolverConfig {
    return { ...this.config };
  }

  public resolve(args: ResolveCarryoverArgs): CarryoverResolution | null {
    const now = args.now ?? nowUnixMs();
    const reason = args.reason ?? 'UNKNOWN';
    const continuitySnapshot = this.ensureContinuitySnapshot(
      args.state,
      args.roomId,
      args.userId,
      args.fromMount,
      now,
    );

    if (!continuitySnapshot) return null;

    const playerState = this.getPlayerState(args.userId);
    const transitionRecord = args.persistTransition !== false
      ? this.ledger.recordMountTransition({
          state: args.state,
          roomId: args.roomId,
          userId: args.userId,
          fromMount: args.fromMount,
          toMount: args.toMount,
          reason,
          now,
        }) ?? undefined
      : undefined;

    const restoredChannel = chooseRestoredChannel(
      continuitySnapshot,
      args.toMount,
      reason,
      playerState,
    );

    const escorts = this.buildEscortDirectives(continuitySnapshot, args.toMount, now);
    const relationshipDirectives = this.buildRelationshipDirectives(continuitySnapshot, args.toMount);
    const revealDirectives = this.buildRevealDirectives(
      continuitySnapshot,
      args.toMount,
      restoredChannel,
      escorts,
      now,
    );

    const overlay = overlayDirective(
      continuitySnapshot,
      restoredChannel,
      escorts,
      revealDirectives,
      args.toMount,
      this.config,
    );

    const metrics = buildMetrics(
      continuitySnapshot,
      escorts,
      relationshipDirectives,
      revealDirectives,
      args.toMount,
    );

    const transportHints = this.buildTransportHints(
      continuitySnapshot,
      args.userId,
      restoredChannel,
      overlay,
      escorts,
      relationshipDirectives,
      revealDirectives,
      metrics,
      now,
    );

    const frontendPatch = this.buildFrontendPatch(
      continuitySnapshot,
      args.fromMount,
      args.toMount,
      restoredChannel,
      overlay,
      escorts,
      relationshipDirectives,
      revealDirectives,
      metrics,
      now,
    );

    const serverEnvelope = this.buildServerEnvelope(
      continuitySnapshot,
      args.userId,
      args.fromMount,
      args.toMount,
      reason,
      restoredChannel,
      overlay,
      escorts,
      relationshipDirectives,
      revealDirectives,
      transportHints,
      metrics,
      now,
    );

    const debugNotes = this.buildDebugNotes(
      continuitySnapshot,
      playerState,
      args.fromMount,
      args.toMount,
      restoredChannel,
      overlay,
      escorts,
      revealDirectives,
      relationshipDirectives,
      metrics,
      transitionRecord,
    );

    return {
      resolutionId: `carryover_resolution:${args.userId}:${args.roomId}:${now}`,
      builtAt: now,
      roomId: args.roomId,
      userId: args.userId,
      fromMount: args.fromMount,
      toMount: args.toMount,
      reason,
      continuitySnapshot,
      playerState,
      transitionRecord,
      restoredChannel,
      overlayDirective: overlay,
      escorts,
      relationshipDirectives,
      revealDirectives,
      transportHints,
      metrics,
      frontendPatch,
      serverEnvelope,
      debugNotes,
    };
  }

  public resolveForPlayerLeadRoom(
    state: Readonly<ChatState>,
    userId: ChatUserId,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    reason: BackendChatTransitionReason = 'UNKNOWN',
    now: UnixMs = nowUnixMs(),
  ): CarryoverResolution | null {
    const playerState = this.getPlayerState(userId);
    if (!playerState?.leadRoomId) return null;

    return this.resolve({
      state,
      userId,
      roomId: playerState.leadRoomId,
      fromMount,
      toMount,
      reason,
      now,
    });
  }

  public createFrontendPatchOnly(
    state: Readonly<ChatState>,
    roomId: ChatRoomId,
    userId: ChatUserId,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    now: UnixMs = nowUnixMs(),
  ): CarryoverFrontendPatch | null {
    const resolution = this.resolve({
      state,
      roomId,
      userId,
      fromMount,
      toMount,
      reason: 'TRANSPORT_SYNC',
      now,
      persistTransition: false,
    });

    return resolution?.frontendPatch ?? null;
  }

  public createServerEnvelopeOnly(
    state: Readonly<ChatState>,
    roomId: ChatRoomId,
    userId: ChatUserId,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    reason: BackendChatTransitionReason = 'TRANSPORT_SYNC',
    now: UnixMs = nowUnixMs(),
  ): CarryoverServerEnvelope | null {
    const resolution = this.resolve({
      state,
      roomId,
      userId,
      fromMount,
      toMount,
      reason,
      now,
      persistTransition: false,
    });

    return resolution?.serverEnvelope ?? null;
  }

  public createTransportHintsOnly(
    state: Readonly<ChatState>,
    roomId: ChatRoomId,
    userId: ChatUserId,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    reason: BackendChatTransitionReason = 'TRANSPORT_SYNC',
    now: UnixMs = nowUnixMs(),
  ): readonly CarryoverTransportHint[] {
    const resolution = this.resolve({
      state,
      roomId,
      userId,
      fromMount,
      toMount,
      reason,
      now,
      persistTransition: false,
    });

    return resolution?.transportHints ?? [];
  }

  private getPlayerState(userId: ChatUserId): BackendChatPlayerContinuityState | undefined {
    return this.ledger.getPlayerState(userId) ?? undefined;
  }

  private ensureContinuitySnapshot(
    state: Readonly<ChatState>,
    roomId: ChatRoomId,
    userId: ChatUserId,
    fromMount: BackendChatMountTarget,
    now: UnixMs,
  ): BackendChatRoomContinuitySnapshot | null {
    return this.ledger.getRoomSnapshot(userId, roomId)
      ?? this.ledger.captureRoomContinuity({
        state,
        roomId,
        userId,
        sourceMount: fromMount,
        now,
      });
  }

  private buildEscortDirectives(
    snapshot: BackendChatRoomContinuitySnapshot,
    toMount: BackendChatMountTarget,
    now: UnixMs,
  ): readonly CarryoverEscortDirective[] {
    return snapshot.carriedActors
      .filter((cue) => cue.visibleFollow || cue.shadowFollow)
      .map((cue) => {
        const escortStyle = determineEscortStyle(cue, toMount);
        const priority01 = escortPriority01(cue, snapshot, toMount, now, this.config);
        const delayMs = determineEscortDelayMs(cue, toMount, now, this.config);
        const visible = cue.visibleFollow && escortStyle !== 'SHADOW_ESCORT' && escortStyle !== 'PREDATOR_STALK';
        const shadowOnly = !visible && cue.shadowFollow;
        const entryMode = escortEntryMode(cue, snapshot, escortStyle);
        const reason = escortReason(cue, snapshot, escortStyle, priority01);

        return {
          actorId: cue.actorId,
          displayName: cue.displayName,
          personaId: cue.personaId,
          sourceChannelId: cue.sourceChannelId,
          escortStyle,
          visible,
          shadowOnly,
          delayMs,
          openWithScene: escortOpenWithScene(cue, snapshot),
          entryMode,
          reason,
          threat01: cue.threat01,
          helper01: cue.helper01,
          intimacy01: cue.intimacy01,
          escortScore01: cue.escortScore01,
          priority01,
          relationshipStance: cue.relationship?.stance,
          transportHint: escortTransportHint(cue, escortStyle, visible),
          tags: cue.tags,
        } satisfies CarryoverEscortDirective;
      })
      .sort((a, b) => (b.priority01 - a.priority01) || a.actorId.localeCompare(b.actorId))
      .slice(0, this.config.maxEscortCount);
  }

  private buildRelationshipDirectives(
    snapshot: BackendChatRoomContinuitySnapshot,
    toMount: BackendChatMountTarget,
  ): readonly CarryoverRelationshipDirective[] {
    return snapshot.carriedActors
      .map((cue) => cue.relationship)
      .filter((value): value is BackendChatContinuityRelationshipDigest => Boolean(value))
      .map((relationship) => ({
        relationship,
        priority01: relationshipPriority01(relationship, toMount, snapshot, this.config),
      }))
      .sort((a, b) => (b.priority01 - a.priority01) || a.relationship.actorId.localeCompare(b.relationship.actorId))
      .slice(0, this.config.maxRelationshipDirectives)
      .map(({ relationship, priority01 }) => relationshipDirective(relationship, priority01));
  }

  private buildRevealDirectives(
    snapshot: BackendChatRoomContinuitySnapshot,
    toMount: BackendChatMountTarget,
    restoredChannel: ChatVisibleChannel,
    escorts: readonly CarryoverEscortDirective[],
    now: UnixMs,
  ): readonly CarryoverRevealDirective[] {
    const strongestThreat01 = escorts.reduce((max, item) => Math.max(max, item.threat01), 0);

    return snapshot.pendingRevealCues
      .map((cue) => {
        const priority01 = revealPriority01(
          cue,
          snapshot,
          strongestThreat01,
          toMount,
          now,
          this.config,
        );
        const timing = revealSurfaceTiming(
          cue,
          snapshot,
          strongestThreat01,
          priority01,
          now,
          toMount,
          this.config,
        );
        const window = revealWindowClass(
          timing,
          cue,
          now,
          snapshot,
          priority01,
          this.config,
        );

        return {
          revealId: cue.revealId,
          actorId: snapshot.carriedActors.find((actor) => actor.lastMessageId === cue.messageId)?.actorId,
          surfaceTiming: timing,
          revealWindow: window,
          delayMs: revealDelayMs(cue, timing, window, now, this.config),
          channelId: cue.channelId,
          targetVisibleChannel: revealTargetVisibleChannel(cue, restoredChannel, snapshot, toMount),
          summaryLine: cue.summaryLine,
          tags: cue.tags,
          openOverlay: revealShouldOpenOverlay(timing, priority01, snapshot),
          priority01,
          threatWeighted: strongestThreat01 >= this.config.shadowRevealThreatThreshold01,
        } satisfies CarryoverRevealDirective;
      })
      .sort((a, b) => (b.priority01 - a.priority01) || a.revealId.localeCompare(b.revealId))
      .slice(0, this.config.maxRevealDirectives);
  }

  private buildTransportHints(
    snapshot: BackendChatRoomContinuitySnapshot,
    userId: ChatUserId,
    restoredChannel: ChatVisibleChannel,
    overlay: CarryoverOverlayDirective,
    escorts: readonly CarryoverEscortDirective[],
    relationships: readonly CarryoverRelationshipDirective[],
    reveals: readonly CarryoverRevealDirective[],
    metrics: CarryoverMetrics,
    now: UnixMs,
  ): readonly CarryoverTransportHint[] {
    const hints: CarryoverTransportHint[] = [
      {
        hintId: `hint:${snapshot.continuityId}:restore_channel`,
        kind: 'RESTORE_CHANNEL',
        roomId: snapshot.roomId,
        userId,
        priority01: clamp01(metrics.transportUrgency01 + 0.08),
        delayMs: 0,
        visibleChannel: restoredChannel,
        payload: {
          restoredChannel,
          preferredVisibleChannel: snapshot.preferredVisibleChannel,
          sourceMount: snapshot.sourceMount,
          continuityScore01: metrics.continuityScore01,
        },
      },
      {
        hintId: `hint:${snapshot.continuityId}:overlay_policy`,
        kind: 'OVERLAY_POLICY',
        roomId: snapshot.roomId,
        userId,
        priority01: clamp01(metrics.continuityScore01 + (overlay.restorePanelOpen ? 0.08 : 0)),
        delayMs: 0,
        visibleChannel: overlay.preferredChannel,
        payload: {
          strategy: overlay.strategy,
          restoreCollapsed: overlay.restoreCollapsed,
          restorePanelOpen: overlay.restorePanelOpen,
          transcriptWindowTarget: overlay.transcriptWindowTarget,
          reason: overlay.reason,
        },
      },
      ...escorts.map((escort) => ({
        hintId: `hint:${snapshot.continuityId}:escort:${escort.actorId}`,
        kind: 'ESCORT_ENTRY' as const,
        roomId: snapshot.roomId,
        userId,
        priority01: escort.priority01,
        delayMs: escort.delayMs,
        visibleChannel: restoredChannel,
        actorId: escort.actorId,
        payload: {
          actorId: escort.actorId,
          escortStyle: escort.escortStyle,
          entryMode: escort.entryMode,
          visible: escort.visible,
          reason: escort.reason,
          transportHint: escort.transportHint,
          tags: [...escort.tags],
        },
      })),
      ...reveals.map((reveal) => ({
        hintId: `hint:${snapshot.continuityId}:reveal:${reveal.revealId}`,
        kind: 'REVEAL_WINDOW' as const,
        roomId: snapshot.roomId,
        userId,
        priority01: reveal.priority01,
        delayMs: reveal.delayMs,
        visibleChannel: reveal.targetVisibleChannel,
        revealId: reveal.revealId,
        actorId: reveal.actorId,
        payload: {
          revealId: reveal.revealId,
          surfaceTiming: reveal.surfaceTiming,
          revealWindow: reveal.revealWindow,
          targetVisibleChannel: reveal.targetVisibleChannel,
          openOverlay: reveal.openOverlay,
          summaryLine: reveal.summaryLine,
          tags: [...reveal.tags],
        },
      })),
      ...relationships.slice(0, 2).map((relationship) => ({
        hintId: `hint:${snapshot.continuityId}:relationship:${relationship.relationshipId}`,
        kind: 'RELATIONSHIP_PRESSURE' as const,
        roomId: snapshot.roomId,
        userId,
        priority01: relationship.priority01,
        delayMs: 0,
        visibleChannel: restoredChannel,
        actorId: relationship.actorId,
        payload: {
          actorId: relationship.actorId,
          relationshipId: relationship.relationshipId,
          stance: relationship.stance,
          priority01: relationship.priority01,
          summaryLine: relationship.summaryLine,
          tags: [...relationship.tags],
        },
      })),
    ];

    return hints
      .sort((a, b) => (b.priority01 - a.priority01) || (a.delayMs - b.delayMs) || a.hintId.localeCompare(b.hintId))
      .slice(0, this.config.maxTransportHints)
      .map((hint) => ({
        ...hint,
        payload: {
          ...hint.payload,
          createdAt: now,
          continuityId: snapshot.continuityId,
        },
      }));
  }

  private buildFrontendPatch(
    snapshot: BackendChatRoomContinuitySnapshot,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    restoredChannel: ChatVisibleChannel,
    overlay: CarryoverOverlayDirective,
    escorts: readonly CarryoverEscortDirective[],
    relationships: readonly CarryoverRelationshipDirective[],
    reveals: readonly CarryoverRevealDirective[],
    metrics: CarryoverMetrics,
    now: UnixMs,
  ): CarryoverFrontendPatch {
    return {
      summaryId: `frontend_patch:${snapshot.continuityId}:${toMount}`,
      builtAt: now,
      fromMount,
      toMount,
      preferredVisibleChannel: snapshot.preferredVisibleChannel,
      restoredVisibleChannel: restoredChannel,
      activeSceneId: snapshot.activeSceneId,
      activeMomentId: snapshot.activeMomentId,
      activeLegendId: snapshot.activeLegendId,
      unresolvedMomentIds: snapshot.unresolvedMoments.map((item) => item.momentId),
      carriedPersonaIds: snapshot.carriedPersonaIds,
      carriedActorIds: snapshot.carriedActors.map((cue) => cue.actorId),
      escortActorId: escorts[0]?.actorId,
      summaryLine: snapshot.summaryLine,
      shadowSummaryLine: snapshot.shadowSummaryLine,
      tensionBand: snapshot.tensionBand,
      temperature: snapshot.temperature,
      continuityScore01: metrics.continuityScore01,
      overlay: {
        strategy: overlay.strategy,
        restoreCollapsed: overlay.restoreCollapsed,
        restorePanelOpen: overlay.restorePanelOpen,
        transcriptWindowTarget: overlay.transcriptWindowTarget,
        preferredChannel: overlay.preferredChannel,
        reason: overlay.reason,
      },
      escortSummary: escortSummary(escorts),
      revealSummary: revealSummary(reveals),
      relationshipSummary: relationshipSummary(relationships),
      worldState: buildWorldStatePatch(
        snapshot,
        restoredChannel,
        overlay,
        metrics,
        escorts,
        relationships,
        reveals,
      ),
      transcriptPreview: mapTranscriptPreview(snapshot, this.config.transcriptPatchCap),
    };
  }

  private buildServerEnvelope(
    snapshot: BackendChatRoomContinuitySnapshot,
    userId: ChatUserId,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    reason: BackendChatTransitionReason,
    restoredChannel: ChatVisibleChannel,
    overlay: CarryoverOverlayDirective,
    escorts: readonly CarryoverEscortDirective[],
    relationships: readonly CarryoverRelationshipDirective[],
    reveals: readonly CarryoverRevealDirective[],
    transportHints: readonly CarryoverTransportHint[],
    metrics: CarryoverMetrics,
    now: UnixMs,
  ): CarryoverServerEnvelope {
    return {
      continuityId: snapshot.continuityId,
      roomId: snapshot.roomId,
      userId,
      eventName: 'chat_continuity_resolved',
      createdAt: now,
      payload: {
        continuityId: snapshot.continuityId,
        roomId: snapshot.roomId,
        fromMount,
        toMount,
        reason,
        restoredChannel,
        preferredVisibleChannel: snapshot.preferredVisibleChannel,
        summaryLine: snapshot.summaryLine,
        shadowSummaryLine: snapshot.shadowSummaryLine,
        tensionBand: snapshot.tensionBand,
        temperature: snapshot.temperature,
        roomStageMood: snapshot.roomStageMood,
        activeSceneId: snapshot.activeSceneId ?? null,
        activeMomentId: snapshot.activeMomentId ?? null,
        activeLegendId: snapshot.activeLegendId ?? null,
        overlayStrategy: overlay.strategy,
        overlayReason: overlay.reason,
        overlayPreferredChannel: overlay.preferredChannel,
        overlayRestorePanelOpen: overlay.restorePanelOpen,
        overlayRestoreCollapsed: overlay.restoreCollapsed,
        continuityScore01: metrics.continuityScore01,
        escortPressure01: metrics.escortPressure01,
        revealPressure01: metrics.revealPressure01,
        relationshipPressure01: metrics.relationshipPressure01,
        unresolvedMomentPressure01: metrics.unresolvedMomentPressure01,
        transportUrgency01: metrics.transportUrgency01,
        continuityHealth: metrics.health,
        escortActorIds: escorts.map((value) => value.actorId),
        escortStyles: escorts.map((value) => value.escortStyle),
        escortEntryModes: escorts.map((value) => value.entryMode),
        escortDelays: escorts.map((value) => value.delayMs),
        relationshipActorIds: relationships.map((value) => value.actorId),
        relationshipStances: relationships.map((value) => value.stance),
        revealIds: reveals.map((value) => value.revealId),
        revealTimings: reveals.map((value) => value.surfaceTiming),
        revealWindows: reveals.map((value) => value.revealWindow),
        revealChannels: reveals.map((value) => value.targetVisibleChannel),
        carriedPersonaIds: snapshot.carriedPersonaIds,
        unresolvedMomentIds: snapshot.unresolvedMoments.map((value) => value.momentId),
        transportHintIds: transportHints.map((value) => value.hintId),
        tags: snapshot.tags,
      },
    };
  }

  private buildDebugNotes(
    snapshot: BackendChatRoomContinuitySnapshot,
    playerState: BackendChatPlayerContinuityState | undefined,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    restoredChannel: ChatVisibleChannel,
    overlay: CarryoverOverlayDirective,
    escorts: readonly CarryoverEscortDirective[],
    reveals: readonly CarryoverRevealDirective[],
    relationships: readonly CarryoverRelationshipDirective[],
    metrics: CarryoverMetrics,
    transitionRecord?: BackendChatMountTransitionRecord,
  ): readonly string[] {
    const notes = unique([
      `continuity:${snapshot.continuityId}`,
      `route:${fromMount}->${toMount}`,
      `channel:${snapshot.preferredVisibleChannel}->${restoredChannel}`,
      `overlay:${overlay.strategy}/${overlay.restorePanelOpen ? 'open' : 'closed'}/${overlay.restoreCollapsed ? 'collapsed' : 'expanded'}`,
      `mood:${snapshot.roomStageMood}/${snapshot.temperature}/${snapshot.tensionBand}`,
      `scene:${snapshot.activeSceneId ?? 'none'}`,
      `moment:${snapshot.activeMomentId ?? 'none'}`,
      `legend:${snapshot.activeLegendId ?? 'none'}`,
      `scores:continuity=${metrics.continuityScore01.toFixed(2)} escort=${metrics.escortPressure01.toFixed(2)} reveal=${metrics.revealPressure01.toFixed(2)} relationship=${metrics.relationshipPressure01.toFixed(2)}`,
      `health:${metrics.health}`,
      `escorts:${escorts.map((item) => `${item.actorId}:${item.escortStyle}:${item.entryMode}`).join(',') || 'none'}`,
      `reveals:${reveals.map((item) => `${item.revealId}:${item.surfaceTiming}:${item.revealWindow}`).join(',') || 'none'}`,
      `relationships:${relationships.map((item) => `${item.actorId}:${item.stance}:${item.priority01.toFixed(2)}`).join(',') || 'none'}`,
      playerState?.leadRoomId ? `player_lead_room:${playerState.leadRoomId}` : 'player_lead_room:none',
      playerState?.lastMountTarget ? `player_last_mount:${playerState.lastMountTarget}` : 'player_last_mount:none',
      playerState?.activeEscortActorId ? `player_active_escort:${playerState.activeEscortActorId}` : 'player_active_escort:none',
      playerState?.unresolvedMomentIds?.length ? `player_unresolved:${playerState.unresolvedMomentIds.join(',')}` : 'player_unresolved:none',
      transitionRecord ? `transition_record:${transitionRecord.transitionId}` : 'transition_record:none',
    ]);

    return notes.slice(0, this.config.maxDebugNotes);
  }
}

export function createCarryoverResolver(
  ledger: CrossModeContinuityLedger,
  config: Partial<CarryoverResolverConfig> = {},
): CarryoverResolver {
  return new CarryoverResolver(ledger, config);
}
