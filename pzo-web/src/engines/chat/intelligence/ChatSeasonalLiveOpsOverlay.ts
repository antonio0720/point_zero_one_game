/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT SEASONAL + LIVEOPS OVERLAY RUNTIME
 * FILE: pzo-web/src/engines/chat/intelligence/ChatSeasonalLiveOpsOverlay.ts
 * ============================================================================
 *
 * Purpose
 * -------
 * Frontend overlay runtime for season-aware chat pressure, rival spotlights,
 * event intrusions, and world-state narrative modulation.
 *
 * This runtime is intentionally deterministic. It does not invent events. It
 * activates, ranks, and projects authored overlay definitions already known to
 * the client or streamed from server truth.
 * ============================================================================
 */

import {
  type ChatLiveOpsChannelId,
  type ChatLiveOpsIntensityBand,
  type ChatLiveOpsOverlayContext,
  type ChatLiveOpsOverlayDefinition,
  type ChatLiveOpsOverlaySnapshot,
} from '../../../../../shared/contracts/chat/liveops';
import { clamp01 } from '../../../../../shared/contracts/chat/persona-evolution';

export interface ChatSeasonalOverlayResolveRequest {
  readonly now: number;
  readonly channelId: ChatLiveOpsChannelId;
  readonly botId?: string | null;
  readonly tags?: readonly string[];
}

export class ChatSeasonalLiveOpsOverlay {
  private readonly overlays = new Map<string, ChatLiveOpsOverlayDefinition>();
  private activeSeasonId: string | null = null;

  upsert(definition: ChatLiveOpsOverlayDefinition): void {
    this.overlays.set(definition.overlayId, definition);
    if (definition.kind === 'SEASON' && this.isActive(definition, Date.now())) {
      this.activeSeasonId = definition.seasonId ?? definition.overlayId;
    }
  }

  upsertMany(definitions: readonly ChatLiveOpsOverlayDefinition[]): void {
    for (const definition of definitions) this.upsert(definition);
  }

  resolveContext(
    request: ChatSeasonalOverlayResolveRequest,
  ): readonly ChatLiveOpsOverlayContext[] {
    const active = [...this.overlays.values()].filter((overlay) => this.isActive(overlay, request.now));
    return active
      .map((overlay) => this.projectOverlay(overlay, request))
      .filter((overlay): overlay is ChatLiveOpsOverlayContext => overlay !== null)
      .sort((a, b) => this.overlayScore(b) - this.overlayScore(a));
  }

  getSnapshot(now = Date.now()): ChatLiveOpsOverlaySnapshot {
    const all = [...this.overlays.values()].sort((a, b) => a.startsAt - b.startsAt);
    const activeOverlays = all.filter((overlay) => this.isActive(overlay, now));
    const upcomingOverlays = all.filter((overlay) => overlay.startsAt > now).slice(0, 12);

    return {
      updatedAt: now,
      activeSeasonId: this.activeSeasonId,
      activeOverlays,
      upcomingOverlays,
    };
  }

  private projectOverlay(
    overlay: ChatLiveOpsOverlayDefinition,
    request: ChatSeasonalOverlayResolveRequest,
  ): ChatLiveOpsOverlayContext | null {
    const tags = new Set(request.tags ?? []);
    const matchedRules = overlay.rules.filter((rule) => {
      if (rule.appliesToBots?.length && request.botId && !rule.appliesToBots.includes(request.botId)) {
        return false;
      }
      if (rule.appliesToChannels?.length && !rule.appliesToChannels.includes(request.channelId)) {
        return false;
      }
      if (rule.requiredTags?.length) {
        for (const tag of rule.requiredTags) {
          if (!tags.has(tag)) return false;
        }
      }
      return true;
    });

    if (matchedRules.length === 0 && overlay.kind !== 'SEASON') return null;

    const transformBiases = new Set<string>();
    const notes: string[] = [];
    let pressureDelta = 0;
    let publicnessDelta = 0;
    let callbackAggressionDelta = 0;

    for (const rule of matchedRules) {
      for (const transform of rule.transformBiases) transformBiases.add(transform);
      for (const tag of rule.addedPlanningTags) notes.push(`tag:${tag}`);
      pressureDelta += rule.pressureDelta;
      publicnessDelta += rule.publicnessDelta;
      callbackAggressionDelta += rule.callbackAggressionDelta;
    }

    const hasDirectChannelPriority = (overlay.channelPriority[request.channelId] ?? 0) > 0;
    if (!hasDirectChannelPriority && matchedRules.length === 0) return null;

    return {
      now: request.now,
      overlayId: overlay.overlayId,
      displayName: overlay.displayName,
      kind: overlay.kind,
      intensity: overlay.intensity,
      seasonId: overlay.seasonId ?? null,
      headline: overlay.headline,
      tags: overlay.tags,
      transformBiases: [...transformBiases],
      pressureDelta: clamp01(pressureDelta),
      publicnessDelta: clamp01(publicnessDelta),
      callbackAggressionDelta: clamp01(callbackAggressionDelta),
      notes,
    };
  }

  private isActive(definition: ChatLiveOpsOverlayDefinition, now: number): boolean {
    return definition.startsAt <= now && now <= definition.endsAt;
  }

  private overlayScore(context: ChatLiveOpsOverlayContext): number {
    return (
      this.intensityWeight(context.intensity) +
      context.pressureDelta * 0.35 +
      context.callbackAggressionDelta * 0.20 +
      context.publicnessDelta * 0.15
    );
  }

  private intensityWeight(intensity: ChatLiveOpsIntensityBand): number {
    switch (intensity) {
      case 'WORLD_CLASS':
        return 1;
      case 'SEVERE':
        return 0.78;
      case 'ACTIVE':
        return 0.55;
      default:
        return 0.28;
    }
  }
}

export function createChatSeasonalLiveOpsOverlay(): ChatSeasonalLiveOpsOverlay {
  return new ChatSeasonalLiveOpsOverlay();
}
