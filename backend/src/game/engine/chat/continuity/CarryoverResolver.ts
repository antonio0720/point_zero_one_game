/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT CARRYOVER RESOLVER
 * FILE: backend/src/game/engine/chat/continuity/CarryoverResolver.ts
 * VERSION: 2026.03.19-continuity-upgrade
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Resolve backend continuity ledgers into concrete cross-mode carryover plans.
 *
 * The ledger remembers what still matters. This resolver decides how that truth
 * should be projected into the next mount, next room surface, or next transport
 * handoff without letting frontend runtime invent continuity from thin air.
 *
 * In practice this resolver answers all of the following backend questions:
 * - Which visible channel should the next mount restore first?
 * - Which companions should remain foregrounded, shadowed, or deferred?
 * - Which unresolved moments deserve to survive the transition?
 * - Which pending reveals remain live and should be surfaced or delayed?
 * - Should the next surface reopen the overlay or preserve calm?
 * - Which relationship vectors should be exposed to the next experience lane?
 * - Which continuity payload should be mirrored into pzo-web state patches?
 * - Which transport annotations should pzo-server fan out as authoritative hints?
 *
 * Ownership doctrine
 * ------------------
 * - The resolver does not mutate ChatState.
 * - The resolver does not render UI.
 * - The resolver does not deliver transport packets directly.
 * - The resolver is pure-ish over authoritative state + durable continuity.
 * - The resolver may capture continuity on demand when a room has not been
 *   materialized into the ledger yet.
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

export interface CarryoverEscortDirective {
  readonly actorId: string;
  readonly displayName: string;
  readonly personaId?: string;
  readonly sourceChannelId: string;
  readonly escortStyle: BackendChatEscortStyle;
  readonly visible: boolean;
  readonly delayMs: number;
  readonly openWithScene: boolean;
  readonly reason: string;
  readonly threat01: number;
  readonly helper01: number;
  readonly intimacy01: number;
}

export interface CarryoverRelationshipDirective {
  readonly actorId: string;
  readonly relationshipId: string;
  readonly stance: string;
  readonly intensity01: number;
  readonly threat01: number;
  readonly helperBias01: number;
  readonly summaryLine: string;
  readonly axisPatch: Readonly<Record<string, number>>;
}

export interface CarryoverRevealDirective {
  readonly revealId: string;
  readonly actorId?: string;
  readonly surfaceTiming: 'IMMEDIATE' | 'DELAYED' | 'SHADOW_ONLY';
  readonly delayMs: number;
  readonly channelId: string;
  readonly summaryLine: string;
  readonly tags: readonly string[];
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
  readonly overlay: {
    readonly restoreCollapsed: boolean;
    readonly restorePanelOpen: boolean;
    readonly transcriptWindowTarget: number;
  };
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
  readonly transitionRecord?: BackendChatMountTransitionRecord;
  readonly restoredChannel: ChatVisibleChannel;
  readonly escorts: readonly CarryoverEscortDirective[];
  readonly relationshipDirectives: readonly CarryoverRelationshipDirective[];
  readonly revealDirectives: readonly CarryoverRevealDirective[];
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
  readonly maxDebugNotes: number;
  readonly revealImmediateWindowMs: number;
  readonly revealDeferredFloorMs: number;
  readonly revealDeferredCeilingMs: number;
  readonly shadowRevealThreatThreshold01: number;
  readonly helperDelayBiasMs: number;
  readonly rivalDelayBiasMs: number;
  readonly silenceFloorMs: number;
  readonly transcriptPatchCap: number;
}

export const DEFAULT_CARRYOVER_RESOLVER_CONFIG: CarryoverResolverConfig = Object.freeze({
  maxEscortCount: 4,
  maxRelationshipDirectives: 6,
  maxRevealDirectives: 6,
  maxDebugNotes: 16,
  revealImmediateWindowMs: 2_400,
  revealDeferredFloorMs: 1_250,
  revealDeferredCeilingMs: 9_500,
  shadowRevealThreatThreshold01: 0.63,
  helperDelayBiasMs: 850,
  rivalDelayBiasMs: 1_450,
  silenceFloorMs: 1_200,
  transcriptPatchCap: 8,
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

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function defaultChannelForMount(target: BackendChatMountTarget): ChatVisibleChannel {
  return BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[target].defaultVisibleChannel;
}

function chooseRestoredChannel(
  snapshot: BackendChatRoomContinuitySnapshot,
  toMount: BackendChatMountTarget,
): ChatVisibleChannel {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount];
  if (preset.allowedVisibleChannels.includes(snapshot.preferredVisibleChannel)) {
    return snapshot.preferredVisibleChannel;
  }
  if (preset.allowedVisibleChannels.includes(snapshot.overlay.preferredChannel)) {
    return snapshot.overlay.preferredChannel;
  }
  return preset.defaultVisibleChannel;
}

function determineEscortDelayMs(
  cue: BackendChatContinuityActorCue,
  toMount: BackendChatMountTarget,
  config: CarryoverResolverConfig,
): number {
  const preset = BACKEND_CHAT_CONTINUITY_MOUNT_PRESETS[toMount];
  const base = cue.helper01 >= cue.threat01
    ? config.helperDelayBiasMs + ((1 - cue.helper01) * 900)
    : config.rivalDelayBiasMs + (cue.threat01 * 1_250);

  if (cue.preferredEscortStyle === 'PREDATOR_STALK') {
    return clampInt(base + 900, 650, config.revealDeferredCeilingMs);
  }
  if (cue.preferredEscortStyle === 'SILENT_WATCH' || preset.preferredEscortStyle === 'SILENT_WATCH') {
    return clampInt(base + 400, 350, config.revealDeferredCeilingMs);
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
  return false;
}

function escortReason(cue: BackendChatContinuityActorCue, snapshot: BackendChatRoomContinuitySnapshot): string {
  const reasons: string[] = [];
  if (cue.helper01 >= cue.threat01) reasons.push('helper_bias');
  if (cue.threat01 > cue.helper01) reasons.push('rival_bias');
  if (cue.visibleFollow) reasons.push('visible_follow');
  if (cue.shadowFollow) reasons.push('shadow_follow');
  if (cue.relationship?.stance) reasons.push(`stance_${cue.relationship.stance.toLowerCase()}`);
  if (snapshot.activeMomentId) reasons.push('active_moment');
  if (snapshot.hasPendingReveals) reasons.push('pending_reveal_pressure');
  return reasons.join('|') || 'continuity_escort';
}

function relationshipDirective(rel: BackendChatContinuityRelationshipDigest): CarryoverRelationshipDirective {
  return {
    actorId: rel.actorId,
    relationshipId: rel.relationshipId,
    stance: rel.stance,
    intensity01: rel.intensity01,
    threat01: rel.threat01,
    helperBias01: rel.helperBias01,
    summaryLine: `${rel.actorId}=${rel.stance.toLowerCase()} intensity:${rel.intensity01.toFixed(2)} helper:${rel.helperBias01.toFixed(2)} threat:${rel.threat01.toFixed(2)}`,
    axisPatch: {
      trust01: rel.trust01,
      fear01: rel.fear01,
      contempt01: rel.contempt01,
      fascination01: rel.fascination01,
      rivalry01: rel.rivalry01,
      rescueDebt01: rel.rescueDebt01,
    },
  };
}

function revealSurfaceTiming(
  cue: BackendChatContinuityRevealCue,
  snapshot: BackendChatRoomContinuitySnapshot,
  strongestThreat01: number,
  now: UnixMs,
  config: CarryoverResolverConfig,
): CarryoverRevealDirective['surfaceTiming'] {
  const msUntil = Number(cue.revealAt) - Number(now);
  if (msUntil <= config.revealImmediateWindowMs) return 'IMMEDIATE';
  if (snapshot.temperature === 'HOSTILE' && strongestThreat01 >= config.shadowRevealThreatThreshold01) return 'SHADOW_ONLY';
  if (snapshot.temperature === 'PRESSURED' && cue.tags.some((tag) => /IDENTITY|RECEIPT|LEGEND/i.test(tag))) return 'DELAYED';
  return 'DELAYED';
}

function revealDelayMs(
  cue: BackendChatContinuityRevealCue,
  timing: CarryoverRevealDirective['surfaceTiming'],
  now: UnixMs,
  config: CarryoverResolverConfig,
): number {
  if (timing === 'IMMEDIATE') {
    return Math.max(0, Number(cue.revealAt) - Number(now));
  }
  if (timing === 'SHADOW_ONLY') {
    return clampInt((Number(cue.revealAt) - Number(now)) + 1_250, config.revealDeferredFloorMs, config.revealDeferredCeilingMs);
  }
  return clampInt(Math.max(Number(cue.revealAt) - Number(now), config.revealDeferredFloorMs), config.revealDeferredFloorMs, config.revealDeferredCeilingMs);
}

function buildWorldStatePatch(
  snapshot: BackendChatRoomContinuitySnapshot,
  restoredChannel: ChatVisibleChannel,
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
    const continuitySnapshot = this.ensureContinuitySnapshot(args.state, args.roomId, args.userId, args.fromMount, now);
    if (!continuitySnapshot) return null;

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

    const restoredChannel = chooseRestoredChannel(continuitySnapshot, args.toMount);
    const escorts = this.buildEscortDirectives(continuitySnapshot, args.toMount);
    const relationshipDirectives = this.buildRelationshipDirectives(continuitySnapshot);
    const revealDirectives = this.buildRevealDirectives(continuitySnapshot, escorts, now);
    const frontendPatch = this.buildFrontendPatch(
      continuitySnapshot,
      args.fromMount,
      args.toMount,
      restoredChannel,
      escorts,
      now,
    );
    const serverEnvelope = this.buildServerEnvelope(
      continuitySnapshot,
      args.userId,
      args.fromMount,
      args.toMount,
      reason,
      restoredChannel,
      escorts,
      relationshipDirectives,
      revealDirectives,
      now,
    );
    const debugNotes = this.buildDebugNotes(
      continuitySnapshot,
      args.fromMount,
      args.toMount,
      restoredChannel,
      escorts,
      revealDirectives,
      relationshipDirectives,
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
      transitionRecord,
      restoredChannel,
      escorts,
      relationshipDirectives,
      revealDirectives,
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
    const playerState = this.ledger.getPlayerState(userId);
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
  ): readonly CarryoverEscortDirective[] {
    return snapshot.carriedActors
      .filter((cue) => cue.visibleFollow || cue.shadowFollow)
      .slice(0, this.config.maxEscortCount)
      .map((cue) => ({
        actorId: cue.actorId,
        displayName: cue.displayName,
        personaId: cue.personaId,
        sourceChannelId: cue.sourceChannelId,
        escortStyle: cue.preferredEscortStyle,
        visible: cue.visibleFollow,
        delayMs: determineEscortDelayMs(cue, toMount, this.config),
        openWithScene: escortOpenWithScene(cue, snapshot),
        reason: escortReason(cue, snapshot),
        threat01: cue.threat01,
        helper01: cue.helper01,
        intimacy01: cue.intimacy01,
      }));
  }

  private buildRelationshipDirectives(
    snapshot: BackendChatRoomContinuitySnapshot,
  ): readonly CarryoverRelationshipDirective[] {
    return snapshot.carriedActors
      .map((cue) => cue.relationship)
      .filter((value): value is BackendChatContinuityRelationshipDigest => Boolean(value))
      .sort((a, b) => (b.intensity01 - a.intensity01) || a.actorId.localeCompare(b.actorId))
      .slice(0, this.config.maxRelationshipDirectives)
      .map(relationshipDirective);
  }

  private buildRevealDirectives(
    snapshot: BackendChatRoomContinuitySnapshot,
    escorts: readonly CarryoverEscortDirective[],
    now: UnixMs,
  ): readonly CarryoverRevealDirective[] {
    const strongestThreat01 = escorts.reduce((max, item) => Math.max(max, item.threat01), 0);
    return snapshot.pendingRevealCues
      .slice(0, this.config.maxRevealDirectives)
      .map((cue) => {
        const timing = revealSurfaceTiming(cue, snapshot, strongestThreat01, now, this.config);
        return {
          revealId: cue.revealId,
          actorId: snapshot.carriedActors.find((actor) => actor.lastMessageId === cue.messageId)?.actorId,
          surfaceTiming: timing,
          delayMs: revealDelayMs(cue, timing, now, this.config),
          channelId: cue.channelId,
          summaryLine: cue.summaryLine,
          tags: cue.tags,
        } satisfies CarryoverRevealDirective;
      });
  }

  private buildFrontendPatch(
    snapshot: BackendChatRoomContinuitySnapshot,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    restoredChannel: ChatVisibleChannel,
    escorts: readonly CarryoverEscortDirective[],
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
      overlay: {
        restoreCollapsed: snapshot.overlay.restoreCollapsed,
        restorePanelOpen: snapshot.overlay.restorePanelOpen,
        transcriptWindowTarget: Math.min(snapshot.overlay.transcriptWindowTarget, this.config.transcriptPatchCap),
      },
      worldState: buildWorldStatePatch(snapshot, restoredChannel),
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
    escorts: readonly CarryoverEscortDirective[],
    relationships: readonly CarryoverRelationshipDirective[],
    reveals: readonly CarryoverRevealDirective[],
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
        summaryLine: snapshot.summaryLine,
        shadowSummaryLine: snapshot.shadowSummaryLine,
        tensionBand: snapshot.tensionBand,
        temperature: snapshot.temperature,
        activeSceneId: snapshot.activeSceneId ?? null,
        activeMomentId: snapshot.activeMomentId ?? null,
        activeLegendId: snapshot.activeLegendId ?? null,
        escortActorIds: escorts.map((value) => value.actorId),
        escortStyles: escorts.map((value) => value.escortStyle),
        relationshipActorIds: relationships.map((value) => value.actorId),
        revealIds: reveals.map((value) => value.revealId),
        revealTimings: reveals.map((value) => value.surfaceTiming),
        carriedPersonaIds: snapshot.carriedPersonaIds,
        unresolvedMomentIds: snapshot.unresolvedMoments.map((value) => value.momentId),
        tags: snapshot.tags,
      },
    };
  }

  private buildDebugNotes(
    snapshot: BackendChatRoomContinuitySnapshot,
    fromMount: BackendChatMountTarget,
    toMount: BackendChatMountTarget,
    restoredChannel: ChatVisibleChannel,
    escorts: readonly CarryoverEscortDirective[],
    reveals: readonly CarryoverRevealDirective[],
    relationships: readonly CarryoverRelationshipDirective[],
    transitionRecord?: BackendChatMountTransitionRecord,
  ): readonly string[] {
    const notes = unique([
      `continuity:${snapshot.continuityId}`,
      `route:${fromMount}->${toMount}`,
      `channel:${snapshot.preferredVisibleChannel}->${restoredChannel}`,
      `overlay:${snapshot.overlay.restorePanelOpen ? 'open' : 'closed'}/${snapshot.overlay.restoreCollapsed ? 'collapsed' : 'expanded'}`,
      `mood:${snapshot.roomStageMood}/${snapshot.temperature}/${snapshot.tensionBand}`,
      `scene:${snapshot.activeSceneId ?? 'none'}`,
      `moment:${snapshot.activeMomentId ?? 'none'}`,
      `legend:${snapshot.activeLegendId ?? 'none'}`,
      `escorts:${escorts.map((item) => `${item.actorId}:${item.escortStyle}`).join(',') || 'none'}`,
      `reveals:${reveals.map((item) => `${item.revealId}:${item.surfaceTiming}`).join(',') || 'none'}`,
      `relationships:${relationships.map((item) => `${item.actorId}:${item.stance}`).join(',') || 'none'}`,
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
