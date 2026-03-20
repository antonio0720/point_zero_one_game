/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT CONTINUITY / COMPANION CONTINUITY LEDGER
 * FILE: pzo-web/src/engines/chat/continuity/CompanionContinuity.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Maintains actor-to-player continuity across mount transitions so the same NPC,
 * rival, helper, broker, or witness can follow the player through different chat
 * surfaces without the experience feeling sticky, duplicated, or amnesiac.
 *
 * This file is intentionally frontend-local.
 * It does not replace backend authority for relationships or future continuity
 * ledgers. It gives the frontend one deterministic place to answer:
 *
 *   - who is still “with” the player right now?
 *   - which actor deserves to remain foregrounded after a mount change?
 *   - which companions are carried only as latent pressure vs visible escort?
 *   - which persona ids should remain available for the next scene handoff?
 */

import type { ChatMountTarget, ChatVisibleChannel } from '../types';
import { CHAT_MOUNT_PRESETS } from '../types';
import {
  CarryoverSceneState,
  type CarryoverActorRef,
  type CarryoverProjection,
  type CarryoverRelationshipLike,
  type CarryoverSceneMessageLike,
  type CarryoverStateLike,
  type JsonObject,
  type UnixMs,
} from './CarryoverSceneState';

export interface CompanionContinuityActorLedgerEntry {
  readonly actorId: string;
  readonly personaId?: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly archetype?: string;
  readonly firstSeenAt: UnixMs;
  readonly lastSeenAt: UnixMs;
  readonly lastMountTarget: ChatMountTarget;
  readonly lastVisibleChannel: ChatVisibleChannel;
  readonly importance01: number;
  readonly intimacy01: number;
  readonly threat01: number;
  readonly helper01: number;
  readonly unresolvedMomentum01: number;
  readonly sceneEscortScore01: number;
  readonly followPriority: number;
  readonly shouldShadowFollow: boolean;
  readonly shouldVisibleFollow: boolean;
  readonly sourceReasons: readonly string[];
  readonly relationshipSnapshot?: CompanionContinuityRelationshipDigest;
}

export interface CompanionContinuityRelationshipDigest {
  readonly relationshipId?: string;
  readonly stance?: string;
  readonly trust?: number;
  readonly fear?: number;
  readonly contempt?: number;
  readonly fascination?: number;
  readonly respect?: number;
  readonly familiarity?: number;
  readonly rivalryIntensity?: number;
  readonly rescueDebt?: number;
  readonly objective?: string;
}

export interface CompanionContinuityEscortPlan {
  readonly actorId: string;
  readonly personaId?: string;
  readonly visibleChannel: ChatVisibleChannel;
  readonly shouldOpenWithScene: boolean;
  readonly shouldDelayEntrance: boolean;
  readonly delayMs: number;
  readonly escortStyle: 'VISIBLE_ESCORT' | 'SHADOW_ESCORT' | 'SILENT_WATCH' | 'NONE';
  readonly reason: string;
}

export interface CompanionContinuityTransitionDigest {
  readonly digestId: string;
  readonly builtAt: UnixMs;
  readonly fromMount: ChatMountTarget;
  readonly toMount: ChatMountTarget;
  readonly leadActorId?: string;
  readonly escortPlan?: CompanionContinuityEscortPlan;
  readonly carriedPersonaIds: readonly string[];
  readonly visibleFollowers: readonly string[];
  readonly shadowFollowers: readonly string[];
  readonly volatileFollowers: readonly string[];
  readonly summaryLine: string;
}

export interface CompanionContinuitySnapshot {
  readonly updatedAt: UnixMs;
  readonly leadActorId?: string;
  readonly activeEscortActorId?: string;
  readonly carriedPersonaIds: readonly string[];
  readonly byActorId: Record<string, CompanionContinuityActorLedgerEntry>;
  readonly recentDigests: readonly CompanionContinuityTransitionDigest[];
}

export interface CompanionContinuityOptions {
  readonly maxLedgerSize?: number;
  readonly maxRecentDigests?: number;
  readonly visibleEscortThreshold?: number;
  readonly shadowEscortThreshold?: number;
  readonly helperVisibilityBonus?: number;
  readonly rivalryVisibilityBonus?: number;
  readonly staleActorWindowMs?: number;
}

const DEFAULT_OPTIONS: Required<CompanionContinuityOptions> = Object.freeze({
  maxLedgerSize: 64,
  maxRecentDigests: 24,
  visibleEscortThreshold: 0.6,
  shadowEscortThreshold: 0.36,
  helperVisibilityBonus: 0.08,
  rivalryVisibilityBonus: 0.1,
  staleActorWindowMs: 12 * 60 * 1000,
});

function nowUnixMs(): UnixMs {
  return Date.now();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function uppercase(value: string | undefined): string {
  return (value ?? '').toUpperCase();
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function stableReasonMerge(current: readonly string[], additions: readonly string[]): string[] {
  return unique([...current, ...additions].filter(Boolean));
}

function inferIntimacy01(relationship?: CarryoverRelationshipLike): number {
  if (!relationship) return 0;
  return clamp01(
    ((asNumber(relationship.trust) ?? 0) * 0.28
      + (asNumber(relationship.familiarity) ?? 0) * 0.18
      + (asNumber(relationship.respect) ?? 0) * 0.14
      + (asNumber(relationship.fascination) ?? 0) * 0.1
      + (asNumber(relationship.rescueDebt) ?? 0) * 0.3) / 100,
  );
}

function inferThreat01(relationship?: CarryoverRelationshipLike, role?: string, archetype?: string): number {
  const text = `${uppercase(role)} ${uppercase(archetype)} ${uppercase(asString(relationship?.stance))}`;
  const rivalry = asNumber(relationship?.rivalryIntensity) ?? 0;
  const fear = asNumber(relationship?.fear) ?? 0;
  const contempt = asNumber(relationship?.contempt) ?? 0;
  const base = Math.max(rivalry, fear * 0.92, contempt * 0.78) / 100;
  if (text.includes('RIVAL') || text.includes('HATER') || text.includes('PREDATOR') || text.includes('ENFORCER')) {
    return clamp01(base + 0.16);
  }
  return clamp01(base);
}

function inferHelper01(relationship?: CarryoverRelationshipLike, role?: string, archetype?: string): number {
  const text = `${uppercase(role)} ${uppercase(archetype)} ${uppercase(asString(relationship?.stance))}`;
  const trust = asNumber(relationship?.trust) ?? 0;
  const rescueDebt = asNumber(relationship?.rescueDebt) ?? 0;
  const base = Math.max(trust, rescueDebt * 0.9) / 100;
  if (text.includes('HELP') || text.includes('ALLY') || text.includes('MENTOR') || text.includes('GUIDE')) {
    return clamp01(base + 0.14);
  }
  return clamp01(base);
}

function isVisibleSupporter(entry: CompanionContinuityActorLedgerEntry): boolean {
  return entry.shouldVisibleFollow && entry.helper01 >= entry.threat01;
}

function isVisibleRival(entry: CompanionContinuityActorLedgerEntry): boolean {
  return entry.shouldVisibleFollow && entry.threat01 > entry.helper01;
}

function pickMessageActors(messages: readonly CarryoverSceneMessageLike[]): Map<string, CarryoverSceneMessageLike> {
  const map = new Map<string, CarryoverSceneMessageLike>();
  for (const message of messages) {
    const actorId = asString(message.sender?.actorId) ?? asString(message.meta?.botSource?.actorId);
    if (!actorId) continue;
    map.set(actorId, message);
  }
  return map;
}

export class CompanionContinuity {
  private readonly options: Required<CompanionContinuityOptions>;
  private readonly projector: CarryoverSceneState;
  private readonly ledger = new Map<string, CompanionContinuityActorLedgerEntry>();
  private readonly recentDigests: CompanionContinuityTransitionDigest[] = [];
  private leadActorId: string | undefined;
  private activeEscortActorId: string | undefined;
  private updatedAt: UnixMs = 0;

  public constructor(options: CompanionContinuityOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.projector = new CarryoverSceneState();
  }

  public getOptions(): Required<CompanionContinuityOptions> {
    return { ...this.options };
  }

  public ingestState(
    state: Readonly<CarryoverStateLike>,
    mountTarget?: ChatMountTarget,
    at: UnixMs = nowUnixMs(),
  ): CompanionContinuitySnapshot {
    const activeMount = mountTarget ?? (state.activeMountTarget as ChatMountTarget) ?? ('GAME_BOARD' as ChatMountTarget);
    const activeChannel = (state.activeVisibleChannel as ChatVisibleChannel) ?? CHAT_MOUNT_PRESETS[activeMount].defaultVisibleChannel;
    const messages = this.collectRecentMessages(state);
    const messageByActor = pickMessageActors(messages);

    for (const [counterpartId, relationship] of Object.entries(state.relationshipsByCounterpartId ?? {})) {
      if (!relationship) continue;
      const actorId = asString(relationship.counterpartId) ?? counterpartId;
      if (!actorId) continue;
      const message = messageByActor.get(actorId);
      this.upsertLedgerFromRelationship(actorId, relationship, message, activeMount, activeChannel, at);
    }

    for (const message of messages) {
      const actorId = asString(message.sender?.actorId) ?? asString(message.meta?.botSource?.actorId);
      if (!actorId) continue;
      const relationship = (state.relationshipsByCounterpartId ?? {})[actorId];
      this.upsertLedgerFromMessage(actorId, message, relationship, activeMount, activeChannel, at);
    }

    this.trimLedger(at);
    this.promoteLeadActor(state, activeMount, at);
    this.updatedAt = at;
    return this.getSnapshot();
  }

  public projectTransition(
    state: Readonly<CarryoverStateLike>,
    fromMount: ChatMountTarget,
    toMount: ChatMountTarget,
    at: UnixMs = nowUnixMs(),
  ): CompanionContinuityTransitionDigest {
    this.ingestState(state, fromMount, at);
    const projection = this.projector.projectTransition(state, toMount, at);
    const escortPlan = this.buildEscortPlan(projection, toMount, at);
    const visibleFollowers = [...this.ledger.values()]
      .filter((entry) => entry.shouldVisibleFollow)
      .sort((a, b) => b.followPriority - a.followPriority)
      .map((entry) => entry.actorId);
    const shadowFollowers = [...this.ledger.values()]
      .filter((entry) => !entry.shouldVisibleFollow && entry.shouldShadowFollow)
      .sort((a, b) => b.followPriority - a.followPriority)
      .map((entry) => entry.actorId);
    const volatileFollowers = [...this.ledger.values()]
      .filter((entry) => entry.unresolvedMomentum01 >= 0.65)
      .sort((a, b) => b.unresolvedMomentum01 - a.unresolvedMomentum01)
      .map((entry) => entry.actorId);

    if (escortPlan?.actorId) this.activeEscortActorId = escortPlan.actorId;
    if (escortPlan?.actorId) this.leadActorId = escortPlan.actorId;

    const digest: CompanionContinuityTransitionDigest = {
      digestId: `companion-transition:${fromMount}:${toMount}:${at}`,
      builtAt: at,
      fromMount,
      toMount,
      leadActorId: escortPlan?.actorId ?? this.leadActorId,
      escortPlan,
      carriedPersonaIds: projection.summary.carriedPersonaIds,
      visibleFollowers,
      shadowFollowers,
      volatileFollowers,
      summaryLine: this.composeDigestLine(projection, escortPlan, toMount),
    };

    this.recentDigests.push(digest);
    this.recentDigests.splice(0, Math.max(0, this.recentDigests.length - this.options.maxRecentDigests));
    this.updatedAt = at;
    return digest;
  }

  public deriveCarryoverPersonaIds(limit = 8): string[] {
    const ordered = [...this.ledger.values()]
      .filter((entry) => entry.personaId)
      .sort((a, b) => b.followPriority - a.followPriority)
      .map((entry) => entry.personaId as string);
    return unique(ordered).slice(0, limit);
  }

  public buildContinuityPatch(
    state: Readonly<CarryoverStateLike>,
    digest: Readonly<CompanionContinuityTransitionDigest>,
  ): JsonObject {
    return {
      ...(state.continuity?.carryoverSummary ?? {}),
      companionDigestId: digest.digestId,
      leadActorId: digest.leadActorId,
      activeEscortActorId: digest.escortPlan?.actorId,
      escortStyle: digest.escortPlan?.escortStyle,
      escortChannel: digest.escortPlan?.visibleChannel,
      carriedPersonaIds: [...digest.carriedPersonaIds],
      visibleFollowers: [...digest.visibleFollowers],
      shadowFollowers: [...digest.shadowFollowers],
      volatileFollowers: [...digest.volatileFollowers],
      summaryLine: digest.summaryLine,
    };
  }

  public getSnapshot(): CompanionContinuitySnapshot {
    const byActorId: Record<string, CompanionContinuityActorLedgerEntry> = {};
    for (const [actorId, entry] of this.ledger.entries()) byActorId[actorId] = entry;
    return {
      updatedAt: this.updatedAt,
      leadActorId: this.leadActorId,
      activeEscortActorId: this.activeEscortActorId,
      carriedPersonaIds: this.deriveCarryoverPersonaIds(),
      byActorId,
      recentDigests: [...this.recentDigests],
    };
  }

  private collectRecentMessages(state: Readonly<CarryoverStateLike>): CarryoverSceneMessageLike[] {
    const result: CarryoverSceneMessageLike[] = [];
    for (const messages of Object.values(state.messagesByChannel ?? {})) {
      if (!messages) continue;
      result.push(...messages.slice(-8));
    }
    return result
      .sort((a, b) => (Date.parse(a.createdAt ?? '') || 0) - (Date.parse(b.createdAt ?? '') || 0))
      .slice(-24);
  }

  private upsertLedgerFromRelationship(
    actorId: string,
    relationship: CarryoverRelationshipLike,
    message: CarryoverSceneMessageLike | undefined,
    mountTarget: ChatMountTarget,
    visibleChannel: ChatVisibleChannel,
    at: UnixMs,
  ): void {
    const current = this.ledger.get(actorId);
    const intimacy01 = inferIntimacy01(relationship);
    const threat01 = inferThreat01(relationship, message?.sender?.role, message?.sender?.archetype);
    const helper01 = inferHelper01(relationship, message?.sender?.role, message?.sender?.archetype);
    const unresolvedMomentum01 = clamp01((threat01 * 0.45) + (helper01 * 0.35) + (intimacy01 * 0.2));
    const visibleBonus = helper01 > threat01 ? this.options.helperVisibilityBonus : this.options.rivalryVisibilityBonus;
    const sceneEscortScore01 = clamp01(Math.max(intimacy01, threat01, helper01) + visibleBonus);
    const followPriority = Math.round(sceneEscortScore01 * 100);
    const next: CompanionContinuityActorLedgerEntry = {
      actorId,
      personaId: asString(relationship.counterpartPersonaId) ?? current?.personaId ?? asString(message?.sender?.personaId),
      displayName: current?.displayName ?? asString(message?.sender?.displayName),
      role: asString(message?.sender?.role) ?? current?.role,
      archetype: asString(message?.sender?.archetype) ?? current?.archetype,
      firstSeenAt: current?.firstSeenAt ?? at,
      lastSeenAt: at,
      lastMountTarget: mountTarget,
      lastVisibleChannel: visibleChannel,
      importance01: Math.max(current?.importance01 ?? 0, sceneEscortScore01),
      intimacy01,
      threat01,
      helper01,
      unresolvedMomentum01,
      sceneEscortScore01,
      followPriority,
      shouldShadowFollow: sceneEscortScore01 >= this.options.shadowEscortThreshold,
      shouldVisibleFollow: sceneEscortScore01 >= this.options.visibleEscortThreshold,
      sourceReasons: stableReasonMerge(current?.sourceReasons ?? [], ['RELATIONSHIP_LEDGER']),
      relationshipSnapshot: {
        relationshipId: asString(relationship.relationshipId),
        stance: asString(relationship.stance),
        trust: asNumber(relationship.trust),
        fear: asNumber(relationship.fear),
        contempt: asNumber(relationship.contempt),
        fascination: asNumber(relationship.fascination),
        respect: asNumber(relationship.respect),
        familiarity: asNumber(relationship.familiarity),
        rivalryIntensity: asNumber(relationship.rivalryIntensity),
        rescueDebt: asNumber(relationship.rescueDebt),
        objective: asString(relationship.objective),
      },
    };
    this.ledger.set(actorId, next);
  }

  private upsertLedgerFromMessage(
    actorId: string,
    message: CarryoverSceneMessageLike,
    relationship: CarryoverRelationshipLike | undefined,
    mountTarget: ChatMountTarget,
    visibleChannel: ChatVisibleChannel,
    at: UnixMs,
  ): void {
    const current = this.ledger.get(actorId);
    const text = `${message.text ?? message.body ?? message.content ?? ''}`;
    const recentness = clamp01(1 - ((at - (Date.parse(message.createdAt ?? '') || at)) / Math.max(1, 180_000)));
    const legendBonus = message.legend ? 0.2 : 0;
    const replayBonus = message.replay ? 0.1 : 0;
    const explicitCarry = message.meta?.carryoverEligible === true ? 0.16 : 0;
    const importance01 = clamp01(Math.max(current?.importance01 ?? 0, recentness * 0.45 + (text.length > 90 ? 0.14 : 0.06) + legendBonus + replayBonus + explicitCarry));
    const intimacy01 = Math.max(current?.intimacy01 ?? 0, inferIntimacy01(relationship));
    const threat01 = Math.max(current?.threat01 ?? 0, inferThreat01(relationship, message.sender?.role, message.sender?.archetype));
    const helper01 = Math.max(current?.helper01 ?? 0, inferHelper01(relationship, message.sender?.role, message.sender?.archetype));
    const unresolvedMomentum01 = clamp01(Math.max(current?.unresolvedMomentum01 ?? 0, importance01 + explicitCarry));
    const sceneEscortScore01 = clamp01(Math.max(importance01, intimacy01, threat01, helper01));
    const shouldVisibleFollow = sceneEscortScore01 >= this.options.visibleEscortThreshold || explicitCarry > 0;
    const next: CompanionContinuityActorLedgerEntry = {
      actorId,
      personaId: asString(message.sender?.personaId) ?? asString(message.meta?.botSource?.personaId) ?? current?.personaId,
      displayName: asString(message.sender?.displayName) ?? current?.displayName,
      role: asString(message.sender?.role) ?? current?.role,
      archetype: asString(message.sender?.archetype) ?? asString(message.meta?.botSource?.archetype) ?? current?.archetype,
      firstSeenAt: current?.firstSeenAt ?? at,
      lastSeenAt: at,
      lastMountTarget: mountTarget,
      lastVisibleChannel: normalizeMessageChannel(message, visibleChannel),
      importance01,
      intimacy01,
      threat01,
      helper01,
      unresolvedMomentum01,
      sceneEscortScore01,
      followPriority: Math.round(sceneEscortScore01 * 100),
      shouldShadowFollow: sceneEscortScore01 >= this.options.shadowEscortThreshold,
      shouldVisibleFollow,
      sourceReasons: stableReasonMerge(current?.sourceReasons ?? [], [message.legend ? 'LEGEND_MOMENT' : 'RECENT_MESSAGE', explicitCarry > 0 ? 'EXPLICIT_CARRYOVER' : '']),
      relationshipSnapshot: current?.relationshipSnapshot,
    };
    this.ledger.set(actorId, next);
  }

  private buildEscortPlan(
    projection: Readonly<CarryoverProjection>,
    targetMount: ChatMountTarget,
    at: UnixMs,
  ): CompanionContinuityEscortPlan | undefined {
    void at;
    const ordered = [...this.ledger.values()].sort((a, b) => b.followPriority - a.followPriority);
    const preferredChannel = projection.hydration.preferredChannel;
    const winner = ordered.find((entry) => entry.shouldVisibleFollow)
      ?? ordered.find((entry) => entry.shouldShadowFollow);
    if (!winner) return undefined;

    const shouldDelayEntrance = projection.summary.shouldDelayHelperReentry && isVisibleSupporter(winner);
    const escortStyle: CompanionContinuityEscortPlan['escortStyle'] = winner.shouldVisibleFollow
      ? (isVisibleRival(winner) ? 'VISIBLE_ESCORT' : 'VISIBLE_ESCORT')
      : (winner.shouldShadowFollow ? 'SHADOW_ESCORT' : 'SILENT_WATCH');

    return {
      actorId: winner.actorId,
      personaId: winner.personaId,
      visibleChannel: preferredChannel,
      shouldOpenWithScene: escortStyle === 'VISIBLE_ESCORT' && projection.hydration.panelShouldOpen,
      shouldDelayEntrance,
      delayMs: shouldDelayEntrance ? projection.hydration.helperDelayMs : 0,
      escortStyle,
      reason: winner.sourceReasons[0] ?? 'continuity_follow',
    };
  }

  private promoteLeadActor(
    state: Readonly<CarryoverStateLike>,
    mountTarget: ChatMountTarget,
    at: UnixMs,
  ): void {
    const activeSceneLead = asString(state.activeScene?.leadActorId);
    if (activeSceneLead && this.ledger.has(activeSceneLead)) {
      this.leadActorId = activeSceneLead;
      this.activeEscortActorId = activeSceneLead;
      return;
    }

    const projection = this.projector.projectTransition(state, mountTarget, at);
    const escort = this.buildEscortPlan(projection, mountTarget, at);
    if (escort?.actorId) {
      this.leadActorId = escort.actorId;
      this.activeEscortActorId = escort.actorId;
      return;
    }

    const winner = [...this.ledger.values()].sort((a, b) => b.followPriority - a.followPriority)[0];
    if (winner) {
      this.leadActorId = winner.actorId;
      this.activeEscortActorId = winner.shouldVisibleFollow ? winner.actorId : this.activeEscortActorId;
    }
  }

  private trimLedger(at: UnixMs): void {
    const staleCutoff = at - this.options.staleActorWindowMs;
    for (const [actorId, entry] of this.ledger.entries()) {
      if (entry.lastSeenAt < staleCutoff && !entry.shouldShadowFollow) this.ledger.delete(actorId);
    }
    const ordered = [...this.ledger.values()].sort((a, b) => b.followPriority - a.followPriority);
    const keep = new Set(ordered.slice(0, this.options.maxLedgerSize).map((entry) => entry.actorId));
    for (const actorId of this.ledger.keys()) {
      if (!keep.has(actorId)) this.ledger.delete(actorId);
    }
  }

  private composeDigestLine(
    projection: Readonly<CarryoverProjection>,
    escortPlan: CompanionContinuityEscortPlan | undefined,
    targetMount: ChatMountTarget,
  ): string {
    const escort = escortPlan?.actorId ? `${escortPlan.actorId} follows into ${targetMount}` : `No visible escort selected for ${targetMount}`;
    const mode = escortPlan?.escortStyle ? `style=${escortPlan.escortStyle.toLowerCase()}` : 'style=none';
    const channel = escortPlan?.visibleChannel ?? projection.summary.preferredVisibleChannel;
    return `${escort} · ${mode} · channel=${channel} · carried=${projection.summary.carriedPersonaIds.length}`;
  }
}

function normalizeMessageChannel(message: CarryoverSceneMessageLike, fallback: ChatVisibleChannel): ChatVisibleChannel {
  const channel = asString(message.channelId);
  if (channel && channel in CHAT_MOUNT_PRESETS === false) return channel as ChatVisibleChannel;
  return fallback;
}

export function createCompanionContinuity(options: CompanionContinuityOptions = {}): CompanionContinuity {
  return new CompanionContinuity(options);
}

export const CompanionContinuityModule = Object.freeze({
  displayName: 'CompanionContinuity',
  file: 'pzo-web/src/engines/chat/continuity/CompanionContinuity.ts',
  category: 'frontend-chat-continuity-runtime',
  authorities: {
    frontend: '/pzo-web/src/engines/chat/continuity',
    backend: '/backend/src/game/engine/chat/continuity',
    shared: '/shared/contracts/chat',
  },
  create: createCompanionContinuity,
});
