/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SCENE ARCHIVE SERVICE
 * FILE: backend/src/game/engine/chat/ChatSceneArchiveService.ts
 * VERSION: 2026.03.23-scene-archive.v2
 * ============================================================================
 *
 * Purpose
 * -------
 * Durable scene archival, carryover summary generation, analytics,
 * health monitoring, momentum scoring, and cross-scene thread tracking.
 *
 * Extended capabilities
 * ----------------------
 * - Scene outcome distribution analysis
 * - Scene arc reconstruction (multi-scene narrative threads)
 * - Counterpart participation tracking across scenes
 * - Tag cloud generation for scene theme visibility
 * - Archive health probing (stale unresolved scenes, coverage gaps)
 * - Scene carryover scoring for continuity engine
 * - Archive diff for replay and audit surfaces
 * - Batch archive operations with cap enforcement
 * - Scene momentum scoring based on recency and outcome trajectory
 * - Archive export/restore for server-side persistence
 * ============================================================================
 */
import type {
  SharedChatSceneArchiveQuery,
  SharedChatSceneArchiveRecord,
  SharedChatSceneCarryoverSummary,
  SharedChatSceneOutcome,
  SharedChatScenePlan,
} from '../../../../../shared/contracts/chat/scene';
import type {
  SharedChatSceneArchetype,
  SharedChatSceneOutcomeKind,
  SharedChatMomentType,
} from '../../../../../shared/contracts/chat/scene';

export interface ChatSceneArchiveServiceConfig {
  readonly maxScenesPerPlayer: number;
}

export const DEFAULT_CHAT_SCENE_ARCHIVE_SERVICE_CONFIG: ChatSceneArchiveServiceConfig = Object.freeze({
  maxScenesPerPlayer: 2048,
});

interface PlayerSceneBucket {
  playerId: string;
  scenes: Map<string, SharedChatSceneArchiveRecord>;
}

function now(): number { return Date.now(); }

export class ChatSceneArchiveService {
  private readonly config: ChatSceneArchiveServiceConfig;
  private readonly players = new Map<string, PlayerSceneBucket>();

  public constructor(config: Partial<ChatSceneArchiveServiceConfig> = {}) {
    this.config = Object.freeze({ ...DEFAULT_CHAT_SCENE_ARCHIVE_SERVICE_CONFIG, ...config });
  }

  private ensure(playerId: string): PlayerSceneBucket {
    const current = this.players.get(playerId);
    if (current) return current;
    const bucket: PlayerSceneBucket = { playerId, scenes: new Map() };
    this.players.set(playerId, bucket);
    return bucket;
  }

  public archiveScene(
    playerId: string,
    roomId: string,
    channelId: SharedChatSceneArchiveRecord['channelId'],
    scene: SharedChatScenePlan,
    options: {
      transcriptAnnotationIds?: readonly string[];
      counterpartIds?: readonly string[];
      callbackAnchorIds?: readonly string[];
      tags?: readonly string[];
    } = {},
  ): SharedChatSceneArchiveRecord {
    const bucket = this.ensure(playerId);
    const archiveId = `scene-archive:${scene.sceneId}`;
    const record: SharedChatSceneArchiveRecord = {
      archiveId,
      playerId,
      roomId,
      channelId,
      scene,
      transcriptAnnotationIds: [...(options.transcriptAnnotationIds ?? [])],
      counterpartIds: [...(options.counterpartIds ?? [])],
      callbackAnchorIds: [...(options.callbackAnchorIds ?? scene.callbackAnchorIds ?? [])],
      createdAt: now(),
      updatedAt: now(),
      tags: [...(options.tags ?? scene.planningTags ?? [])],
    };
    bucket.scenes.set(scene.sceneId, record);
    this.trim(bucket);
    return record;
  }

  public appendOutcome(playerId: string, sceneId: string, outcome: SharedChatSceneOutcome): SharedChatSceneArchiveRecord | undefined {
    const bucket = this.ensure(playerId);
    const current = bucket.scenes.get(sceneId);
    if (!current) return undefined;
    const next: SharedChatSceneArchiveRecord = { ...current, outcome, updatedAt: now() };
    bucket.scenes.set(sceneId, next);
    return next;
  }

  public query(query: SharedChatSceneArchiveQuery): readonly SharedChatSceneArchiveRecord[] {
    const bucket = this.ensure(query.playerId);
    return [...bucket.scenes.values()]
      .filter((record) => !query.roomId || record.roomId === query.roomId)
      .filter((record) => !query.channelId || record.channelId === query.channelId)
      .filter((record) => !query.archetypes?.length || query.archetypes.includes(record.scene.archetype))
      .filter((record) => !query.momentTypes?.length || query.momentTypes.includes(record.scene.momentType))
      .filter((record) => !query.counterpartIds?.length || query.counterpartIds.some((id) => record.counterpartIds.includes(id)))
      .filter((record) => !query.tags?.length || query.tags.some((tag) => record.tags.includes(tag)))
      .filter((record) => !query.onlyUnresolved || !record.outcome || record.outcome.outcomeKind !== 'COMPLETED')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, query.limit ?? 24);
  }

  public buildCarryoverSummary(playerId: string): SharedChatSceneCarryoverSummary {
    const bucket = this.ensure(playerId);
    const recent = [...bucket.scenes.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
    return {
      playerId,
      generatedAt: now(),
      unresolvedSceneIds: recent.filter((record) => !record.outcome || record.outcome.outcomeKind !== 'COMPLETED').map((record) => record.scene.sceneId),
      activeCounterpartIds: [...new Set(recent.flatMap((record) => record.counterpartIds))],
      summaryLines: recent.slice(0, 5).map((record) => `${record.scene.archetype}: ${record.outcome?.summary ?? 'unresolved scene thread'}`),
      suggestedCallbackAnchorIds: [...new Set(recent.flatMap((record) => record.callbackAnchorIds))].slice(0, 16),
    };
  }

  private trim(bucket: PlayerSceneBucket): void {
    const scenes = [...bucket.scenes.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, this.config.maxScenesPerPlayer);
    bucket.scenes.clear();
    for (const record of scenes) bucket.scenes.set(record.scene.sceneId, record);
  }

  // ==========================================================================
  // MARK: Archive analytics
  // ==========================================================================

  /** Compute outcome distribution across all archived scenes for a player. */
  public computeOutcomeDistribution(playerId: string): SceneOutcomeDistribution {
    const bucket = this.ensure(playerId);
    const records = [...bucket.scenes.values()];
    const total = records.length;
    const counts: Record<SharedChatSceneOutcomeKind, number> = {
      COMPLETED: 0, INTERRUPTED: 0, CANCELLED: 0, TIMED_OUT: 0, OVERRIDDEN: 0,
    };
    const archetypeCounts = new Map<SharedChatSceneArchetype, number>();
    let unresolvedCount = 0;

    for (const record of records) {
      if (record.outcome) {
        counts[record.outcome.outcomeKind] = (counts[record.outcome.outcomeKind] ?? 0) + 1;
      } else {
        unresolvedCount += 1;
      }
      const arch = record.scene.archetype;
      archetypeCounts.set(arch, (archetypeCounts.get(arch) ?? 0) + 1);
    }

    const completionRate01 = total > 0 ? counts.COMPLETED / total : 0;
    const interruptionRate01 = total > 0 ? counts.INTERRUPTED / total : 0;
    const cancellationRate01 = total > 0 ? counts.CANCELLED / total : 0;
    const timedOutRate01 = total > 0 ? counts.TIMED_OUT / total : 0;
    const unresolvedRate01 = total > 0 ? unresolvedCount / total : 0;

    const topArchetypes: Array<{ archetype: SharedChatSceneArchetype; count: number }> = [
      ...archetypeCounts.entries(),
    ]
      .map(([archetype, count]) => ({ archetype, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return Object.freeze({
      playerId,
      generatedAt: now(),
      totalScenes: total,
      unresolvedCount,
      outcomeCounts: Object.freeze({ ...counts }),
      completionRate01,
      interruptionRate01,
      cancellationRate01,
      timedOutRate01,
      unresolvedRate01,
      topArchetypes: Object.freeze(topArchetypes),
    });
  }

  /** Build analytics summary for a player's scene archive. */
  public buildAnalytics(playerId: string): SceneArchiveAnalytics {
    const bucket = this.ensure(playerId);
    const records = [...bucket.scenes.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    const distribution = this.computeOutcomeDistribution(playerId);
    const tagFrequency = new Map<string, number>();
    const counterpartFrequency = new Map<string, number>();

    for (const record of records) {
      for (const tag of record.tags) {
        tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
      }
      for (const cpId of record.counterpartIds) {
        counterpartFrequency.set(cpId, (counterpartFrequency.get(cpId) ?? 0) + 1);
      }
    }

    const recentScene = records[0] ?? null;
    const oldestScene = records[records.length - 1] ?? null;
    const averageDurationMs = records.reduce((sum, r) => sum + r.scene.expectedDurationMs, 0) / Math.max(records.length, 1);
    const averageTagsPerScene = records.reduce((sum, r) => sum + r.tags.length, 0) / Math.max(records.length, 1);
    const averageCounterpartsPerScene = records.reduce((sum, r) => sum + r.counterpartIds.length, 0) / Math.max(records.length, 1);

    const topTags = [...tagFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, count]) => ({ tag, count }));
    const topCounterparts = [...counterpartFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([counterpartId, count]) => ({ counterpartId, count }));

    const momentTypeCounts = new Map<SharedChatMomentType, number>();
    for (const record of records) {
      const mt = record.scene.momentType;
      momentTypeCounts.set(mt, (momentTypeCounts.get(mt) ?? 0) + 1);
    }
    const topMomentTypes = [...momentTypeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([momentType, count]) => ({ momentType, count }));

    return Object.freeze({
      playerId,
      generatedAt: now(),
      totalArchived: records.length,
      distribution,
      recentSceneId: recentScene?.scene.sceneId ?? null,
      oldestSceneId: oldestScene?.scene.sceneId ?? null,
      averageDurationMs,
      averageTagsPerScene,
      averageCounterpartsPerScene,
      topTags: Object.freeze(topTags),
      topCounterparts: Object.freeze(topCounterparts),
      topMomentTypes: Object.freeze(topMomentTypes),
    });
  }

  // ==========================================================================
  // MARK: Scene carryover scoring
  // ==========================================================================

  /** Compute a carryover pressure score for a scene record (higher = more likely to carry). */
  public computeCarryoverScore(record: SharedChatSceneArchiveRecord): SceneCarryoverScore {
    const isUnresolved = !record.outcome || record.outcome.outcomeKind !== 'COMPLETED';
    const hasCallbacks = record.callbackAnchorIds.length > 0;
    const hasCounterparts = record.counterpartIds.length > 0;
    const ageMs = now() - record.updatedAt;
    const agePenalty = Math.min(ageMs / (7 * 24 * 60 * 60 * 1000), 0.5);
    const unresolvedBonus = isUnresolved ? 0.35 : 0;
    const callbackBonus = hasCallbacks ? Math.min(record.callbackAnchorIds.length * 0.05, 0.20) : 0;
    const counterpartBonus = hasCounterparts ? Math.min(record.counterpartIds.length * 0.04, 0.16) : 0;
    const tagRichness = Math.min(record.tags.length * 0.02, 0.08);
    const score01 = Math.min(1, Math.max(0, 0.20 + unresolvedBonus + callbackBonus + counterpartBonus + tagRichness - agePenalty));

    return Object.freeze({
      sceneId: record.scene.sceneId,
      score01,
      isUnresolved,
      hasCallbacks,
      hasCounterparts,
      ageMs,
      agePenalty,
      unresolvedBonus,
      callbackBonus,
      counterpartBonus,
      tagRichness,
    });
  }

  /** Compute carryover scores for all scenes of a player, sorted by score descending. */
  public computeAllCarryoverScores(playerId: string, limit = 24): readonly SceneCarryoverScore[] {
    const bucket = this.ensure(playerId);
    return [...bucket.scenes.values()]
      .map((record) => this.computeCarryoverScore(record))
      .sort((a, b) => b.score01 - a.score01)
      .slice(0, limit);
  }

  // ==========================================================================
  // MARK: Counterpart participation tracking
  // ==========================================================================

  /** Build counterpart scene participation records for a player. */
  public buildCounterpartParticipation(playerId: string): readonly SceneCounterpartParticipation[] {
    const bucket = this.ensure(playerId);
    const records = [...bucket.scenes.values()];
    const participation = new Map<string, SceneCounterpartParticipation>();

    for (const record of records) {
      for (const cpId of record.counterpartIds) {
        const existing = participation.get(cpId);
        const sceneIds = existing ? [...existing.sceneIds, record.scene.sceneId] : [record.scene.sceneId];
        const archetypes = existing ? [...existing.archetypes] : [];
        if (!archetypes.includes(record.scene.archetype)) archetypes.push(record.scene.archetype);
        const latestAt = Math.max(existing?.latestSceneAt ?? 0, record.updatedAt);
        const unresolvedCount = (existing?.unresolvedSceneCount ?? 0) + (record.outcome ? 0 : 1);

        participation.set(cpId, Object.freeze({
          counterpartId: cpId,
          sceneCount: sceneIds.length,
          sceneIds: Object.freeze(sceneIds),
          archetypes: Object.freeze(archetypes),
          latestSceneAt: latestAt,
          unresolvedSceneCount: unresolvedCount,
        }));
      }
    }

    return [...participation.values()].sort((a, b) => b.sceneCount - a.sceneCount);
  }

  /** Get scenes shared between a player and a specific counterpart. */
  public getScenesWithCounterpart(
    playerId: string,
    counterpartId: string,
    limit = 16,
  ): readonly SharedChatSceneArchiveRecord[] {
    return this.query({
      playerId,
      counterpartIds: [counterpartId],
      limit,
    });
  }

  // ==========================================================================
  // MARK: Scene arc reconstruction
  // ==========================================================================

  /** Reconstruct a narrative arc from contiguous scenes sharing counterparts or tags. */
  public buildSceneArc(
    playerId: string,
    anchorSceneId: string,
    maxDepth = 8,
  ): SceneArc | null {
    const bucket = this.ensure(playerId);
    const anchor = bucket.scenes.get(anchorSceneId);
    if (!anchor) return null;

    const visited = new Set<string>([anchorSceneId]);
    const arc: SharedChatSceneArchiveRecord[] = [anchor];
    const queue = [anchor];

    while (queue.length > 0 && arc.length < maxDepth) {
      const current = queue.shift()!;
      const linked = [...bucket.scenes.values()].filter((record) => {
        if (visited.has(record.scene.sceneId)) return false;
        const sharesCounterpart = record.counterpartIds.some((cpId) => current.counterpartIds.includes(cpId));
        const sharesTag = record.tags.some((tag) => current.tags.includes(tag));
        const timeProximity = Math.abs(record.updatedAt - current.updatedAt) < 48 * 60 * 60 * 1000;
        return (sharesCounterpart || sharesTag) && timeProximity;
      });

      for (const linked_record of linked.slice(0, 3)) {
        if (arc.length >= maxDepth) break;
        visited.add(linked_record.scene.sceneId);
        arc.push(linked_record);
        queue.push(linked_record);
      }
    }

    const arcSorted = arc.sort((a, b) => a.createdAt - b.createdAt);
    const hasResolution = arcSorted.some((r) => r.outcome?.outcomeKind === 'COMPLETED');
    const dominantCounterpartIds = [...new Set(arcSorted.flatMap((r) => r.counterpartIds))].slice(0, 6);
    const dominantTags = [...new Set(arcSorted.flatMap((r) => r.tags))].slice(0, 12);

    return Object.freeze({
      arcId: `arc:${anchorSceneId}`,
      playerId,
      generatedAt: now(),
      anchorSceneId,
      scenes: Object.freeze(arcSorted),
      sceneCount: arcSorted.length,
      hasResolution,
      dominantCounterpartIds: Object.freeze(dominantCounterpartIds),
      dominantTags: Object.freeze(dominantTags),
      earliestAt: arcSorted[0]?.createdAt ?? now(),
      latestAt: arcSorted[arcSorted.length - 1]?.updatedAt ?? now(),
    });
  }

  // ==========================================================================
  // MARK: Scene momentum scoring
  // ==========================================================================

  /** Compute the momentum score — how much narrative energy is currently active for a player. */
  public computeArchiveMomentum(playerId: string): SceneArchiveMomentumScore {
    const bucket = this.ensure(playerId);
    const records = [...bucket.scenes.values()];
    if (records.length === 0) {
      return Object.freeze({
        playerId,
        generatedAt: now(),
        momentum01: 0,
        unresolvedWeight: 0,
        recencyWeight: 0,
        counterpartPressure: 0,
        callbackPressure: 0,
        activeThreadCount: 0,
        notes: ['no_scenes'],
      });
    }

    const recent = records.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 16);
    const unresolvedWeight = recent.filter((r) => !r.outcome || r.outcome.outcomeKind !== 'COMPLETED').length / Math.max(recent.length, 1);
    const ageFactor = 1 - Math.min((now() - (recent[0]?.updatedAt ?? now())) / (3 * 24 * 60 * 60 * 1000), 1);
    const recencyWeight = ageFactor * 0.35;
    const counterpartPressure = Math.min([...new Set(recent.flatMap((r) => r.counterpartIds))].length / 8, 1) * 0.22;
    const callbackPressure = Math.min([...new Set(recent.flatMap((r) => r.callbackAnchorIds))].length / 12, 1) * 0.18;
    const activeThreadCount = recent.filter((r) => !r.outcome || r.outcome.outcomeKind !== 'COMPLETED').length;
    const momentum01 = Math.min(1, unresolvedWeight * 0.35 + recencyWeight + counterpartPressure + callbackPressure);
    const notes: string[] = [];
    if (unresolvedWeight > 0.7) notes.push('high_unresolved_ratio');
    if (activeThreadCount >= 5) notes.push('many_active_threads');
    if (counterpartPressure > 0.15) notes.push('dense_counterpart_network');
    if (callbackPressure > 0.10) notes.push('rich_callback_surface');

    return Object.freeze({
      playerId,
      generatedAt: now(),
      momentum01,
      unresolvedWeight,
      recencyWeight,
      counterpartPressure,
      callbackPressure,
      activeThreadCount,
      notes: Object.freeze(notes),
    });
  }

  // ==========================================================================
  // MARK: Tag cloud generation
  // ==========================================================================

  /** Build a tag cloud from scene archives for a player. */
  public buildTagCloud(playerId: string, limit = 32): readonly SceneArchiveTagEntry[] {
    const bucket = this.ensure(playerId);
    const tagCounts = new Map<string, { count: number; lastSeenAt: number }>();

    for (const record of bucket.scenes.values()) {
      for (const tag of record.tags) {
        const existing = tagCounts.get(tag);
        if (existing) {
          existing.count += 1;
          existing.lastSeenAt = Math.max(existing.lastSeenAt, record.updatedAt);
        } else {
          tagCounts.set(tag, { count: 1, lastSeenAt: record.updatedAt });
        }
      }
    }

    return [...tagCounts.entries()]
      .map(([tag, { count, lastSeenAt }]) => Object.freeze({ tag, count, lastSeenAt }))
      .sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt)
      .slice(0, limit);
  }

  /** Find scenes tagged with a specific tag. */
  public getScenesByTag(playerId: string, tag: string, limit = 16): readonly SharedChatSceneArchiveRecord[] {
    return this.query({ playerId, tags: [tag], limit });
  }

  // ==========================================================================
  // MARK: Archive health probing
  // ==========================================================================

  /** Probe the health of a player's scene archive. */
  public probeArchiveHealth(playerId: string): SceneArchiveHealthProbe {
    const bucket = this.ensure(playerId);
    const records = [...bucket.scenes.values()];
    const now_ = now();
    const staleCutoffMs = 7 * 24 * 60 * 60 * 1000;

    const totalScenes = records.length;
    const unresolvedScenes = records.filter((r) => !r.outcome);
    const staleUnresolvedScenes = unresolvedScenes.filter((r) => now_ - r.updatedAt > staleCutoffMs);
    const completedScenes = records.filter((r) => r.outcome?.outcomeKind === 'COMPLETED');
    const bucketCapUsage01 = totalScenes / this.config.maxScenesPerPlayer;
    const archetypeGaps: SharedChatSceneArchetype[] = [];
    const seenArchetypes = new Set(records.map((r) => r.scene.archetype));
    const KNOWN_ARCHETYPES: SharedChatSceneArchetype[] = [
      'BREACH_SCENE', 'TRAP_SCENE', 'RESCUE_SCENE', 'PUBLIC_HUMILIATION_SCENE',
      'COMEBACK_WITNESS_SCENE', 'DEAL_ROOM_PRESSURE_SCENE', 'FALSE_CALM_SCENE',
      'END_OF_RUN_RECKONING_SCENE', 'LONG_ARC_CALLBACK_SCENE', 'SEASON_EVENT_INTRUSION_SCENE',
    ];
    for (const arch of KNOWN_ARCHETYPES) {
      if (!seenArchetypes.has(arch)) archetypeGaps.push(arch);
    }

    const healthStatus: SceneArchiveHealthStatus =
      staleUnresolvedScenes.length > 10 ? 'DEGRADED' :
      bucketCapUsage01 > 0.9 ? 'NEAR_CAP' :
      unresolvedScenes.length > completedScenes.length * 2 ? 'OVERLOADED' :
      'HEALTHY';

    const issues: string[] = [];
    if (staleUnresolvedScenes.length > 0) issues.push(`${staleUnresolvedScenes.length}_stale_unresolved`);
    if (bucketCapUsage01 > 0.85) issues.push('near_cap_limit');
    if (archetypeGaps.length > 3) issues.push('archetype_coverage_gaps');

    return Object.freeze({
      playerId,
      generatedAt: now_,
      totalScenes,
      unresolvedCount: unresolvedScenes.length,
      staleUnresolvedCount: staleUnresolvedScenes.length,
      completedCount: completedScenes.length,
      bucketCapUsage01,
      archetypeGaps: Object.freeze(archetypeGaps),
      healthStatus,
      issues: Object.freeze(issues),
    });
  }

  // ==========================================================================
  // MARK: Archive diff
  // ==========================================================================

  /** Diff two sets of scene archive records (e.g., before/after a run) to find added/removed/changed scenes. */
  public diffArchiveSnapshots(
    before: readonly SharedChatSceneArchiveRecord[],
    after: readonly SharedChatSceneArchiveRecord[],
  ): SceneArchiveDiff {
    const beforeMap = new Map(before.map((r) => [r.scene.sceneId, r]));
    const afterMap = new Map(after.map((r) => [r.scene.sceneId, r]));

    const added: SharedChatSceneArchiveRecord[] = [];
    const removed: SharedChatSceneArchiveRecord[] = [];
    const resolved: Array<{ before: SharedChatSceneArchiveRecord; after: SharedChatSceneArchiveRecord }> = [];
    const updated: Array<{ before: SharedChatSceneArchiveRecord; after: SharedChatSceneArchiveRecord }> = [];

    for (const [sceneId, afterRecord] of afterMap) {
      const beforeRecord = beforeMap.get(sceneId);
      if (!beforeRecord) {
        added.push(afterRecord);
      } else if (!beforeRecord.outcome && afterRecord.outcome) {
        resolved.push({ before: beforeRecord, after: afterRecord });
      } else if (beforeRecord.updatedAt !== afterRecord.updatedAt) {
        updated.push({ before: beforeRecord, after: afterRecord });
      }
    }
    for (const [sceneId, beforeRecord] of beforeMap) {
      if (!afterMap.has(sceneId)) removed.push(beforeRecord);
    }

    return Object.freeze({
      generatedAt: now(),
      addedCount: added.length,
      removedCount: removed.length,
      resolvedCount: resolved.length,
      updatedCount: updated.length,
      added: Object.freeze(added),
      removed: Object.freeze(removed),
      resolved: Object.freeze(resolved),
      updated: Object.freeze(updated),
    });
  }

  // ==========================================================================
  // MARK: Run summary
  // ==========================================================================

  /** Build a run-scoped scene summary for a player (scenes from a specific room). */
  public buildRunSummary(playerId: string, roomId: string): SceneArchiveRunSummary {
    const scenes = this.query({ playerId, roomId, limit: 256 });
    const completed = scenes.filter((r) => r.outcome?.outcomeKind === 'COMPLETED');
    const interrupted = scenes.filter((r) => r.outcome?.outcomeKind === 'INTERRUPTED' || r.outcome?.outcomeKind === 'CANCELLED');
    const unresolved = scenes.filter((r) => !r.outcome);
    const archetypeSet = new Set(scenes.map((r) => r.scene.archetype));
    const counterpartSet = new Set(scenes.flatMap((r) => r.counterpartIds));
    const callbackSet = new Set(scenes.flatMap((r) => r.callbackAnchorIds));
    const outcomeSummaries = completed.slice(0, 5).map((r) => r.outcome?.summary ?? '').filter(Boolean);

    return Object.freeze({
      playerId,
      roomId,
      generatedAt: now(),
      totalScenes: scenes.length,
      completedCount: completed.length,
      interruptedCount: interrupted.length,
      unresolvedCount: unresolved.length,
      completionRate01: scenes.length > 0 ? completed.length / scenes.length : 0,
      uniqueArchetypes: Object.freeze([...archetypeSet]),
      uniqueCounterpartIds: Object.freeze([...counterpartSet]),
      pendingCallbackAnchorIds: Object.freeze([...callbackSet].slice(0, 16)),
      outcomeSummaries: Object.freeze(outcomeSummaries),
    });
  }

  // ==========================================================================
  // MARK: Batch archive operations
  // ==========================================================================

  /** Archive multiple scenes at once, respecting the bucket cap. */
  public archiveBatch(
    playerId: string,
    roomId: string,
    channelId: SharedChatSceneArchiveRecord['channelId'],
    plans: readonly SharedChatScenePlan[],
  ): readonly SharedChatSceneArchiveRecord[] {
    return plans.map((plan) =>
      this.archiveScene(playerId, roomId, channelId, plan),
    );
  }

  /** Append outcomes to multiple scenes at once. */
  public appendOutcomeBatch(
    playerId: string,
    updates: readonly { sceneId: string; outcome: SharedChatSceneOutcome }[],
  ): readonly SharedChatSceneArchiveRecord[] {
    return updates
      .map(({ sceneId, outcome }) => this.appendOutcome(playerId, sceneId, outcome))
      .filter((r): r is SharedChatSceneArchiveRecord => r != null);
  }

  // ==========================================================================
  // MARK: Archive export and restore
  // ==========================================================================

  /** Export all scenes for a player as a serializable snapshot. */
  public exportPlayerArchive(playerId: string): SceneArchiveExport {
    const bucket = this.ensure(playerId);
    const scenes = [...bucket.scenes.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    return Object.freeze({
      playerId,
      exportedAt: now(),
      version: CHAT_SCENE_ARCHIVE_MODULE_VERSION,
      totalScenes: scenes.length,
      scenes: Object.freeze(scenes),
    });
  }

  /** Restore a player's archive from an export. Merges with existing data. */
  public restoreFromExport(exported: SceneArchiveExport): void {
    const bucket = this.ensure(exported.playerId);
    for (const record of exported.scenes) {
      if (!bucket.scenes.has(record.scene.sceneId)) {
        bucket.scenes.set(record.scene.sceneId, record);
      }
    }
    this.trim(bucket);
  }

  /** Export a single player's scenes as NDJSON-compatible lines. */
  public exportNdjson(playerId: string): string {
    const exported = this.exportPlayerArchive(playerId);
    return exported.scenes.map((scene) => JSON.stringify(scene)).join('\n');
  }

  // ==========================================================================
  // MARK: Scene retrieval helpers
  // ==========================================================================

  /** Get the most recently archived scene for a player. */
  public getMostRecentScene(playerId: string): SharedChatSceneArchiveRecord | null {
    const bucket = this.ensure(playerId);
    const sorted = [...bucket.scenes.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted[0] ?? null;
  }

  /** Get unresolved scenes sorted by age (oldest first — highest priority to resolve). */
  public getUnresolvedScenesOldestFirst(playerId: string, limit = 16): readonly SharedChatSceneArchiveRecord[] {
    const bucket = this.ensure(playerId);
    return [...bucket.scenes.values()]
      .filter((r) => !r.outcome || r.outcome.outcomeKind !== 'COMPLETED')
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, limit);
  }

  /** Get scenes for a player containing a specific counterpart. */
  public getScenesForCounterpart(playerId: string, counterpartId: string, limit = 16): readonly SharedChatSceneArchiveRecord[] {
    return this.getScenesWithCounterpart(playerId, counterpartId, limit);
  }

  /** Get the total scene count for a player. */
  public getSceneCount(playerId: string): number {
    return this.ensure(playerId).scenes.size;
  }

  /** Check if a specific scene is archived for a player. */
  public hasScene(playerId: string, sceneId: string): boolean {
    return this.ensure(playerId).scenes.has(sceneId);
  }

  /** Retrieve a specific scene record. */
  public getScene(playerId: string, sceneId: string): SharedChatSceneArchiveRecord | undefined {
    return this.ensure(playerId).scenes.get(sceneId);
  }

  /** Delete a specific scene from a player's archive. */
  public deleteScene(playerId: string, sceneId: string): boolean {
    const bucket = this.ensure(playerId);
    return bucket.scenes.delete(sceneId);
  }

  /** Clear all scenes for a player. */
  public clearPlayer(playerId: string): void {
    this.ensure(playerId).scenes.clear();
  }

  // ==========================================================================
  // MARK: Cross-player analytics
  // ==========================================================================

  /** Get all players with archived scenes. */
  public getPlayerIds(): readonly string[] {
    return [...this.players.keys()];
  }

  /** Get total scene count across all players. */
  public getTotalSceneCount(): number {
    let total = 0;
    for (const bucket of this.players.values()) total += bucket.scenes.size;
    return total;
  }

  /** Build a coverage report across all players. */
  public buildGlobalCoverageReport(): SceneArchiveGlobalCoverageReport {
    const playerIds = this.getPlayerIds();
    const totalScenes = this.getTotalSceneCount();
    const archetypeFrequency = new Map<SharedChatSceneArchetype, number>();
    const momentTypeFrequency = new Map<SharedChatMomentType, number>();
    let totalUnresolved = 0;
    let totalCompleted = 0;

    for (const playerId of playerIds) {
      const bucket = this.ensure(playerId);
      for (const record of bucket.scenes.values()) {
        const arch = record.scene.archetype;
        archetypeFrequency.set(arch, (archetypeFrequency.get(arch) ?? 0) + 1);
        const mt = record.scene.momentType;
        momentTypeFrequency.set(mt, (momentTypeFrequency.get(mt) ?? 0) + 1);
        if (!record.outcome || record.outcome.outcomeKind !== 'COMPLETED') totalUnresolved++;
        else totalCompleted++;
      }
    }

    const topArchetypes = [...archetypeFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([archetype, count]) => ({ archetype, count }));

    const topMomentTypes = [...momentTypeFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([momentType, count]) => ({ momentType, count }));

    return Object.freeze({
      generatedAt: now(),
      totalPlayers: playerIds.length,
      totalScenes,
      totalUnresolved,
      totalCompleted,
      globalCompletionRate01: totalScenes > 0 ? totalCompleted / totalScenes : 0,
      topArchetypes: Object.freeze(topArchetypes),
      topMomentTypes: Object.freeze(topMomentTypes),
    });
  }
}

// ============================================================================
// MARK: Types
// ============================================================================

export interface SceneOutcomeDistribution {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly totalScenes: number;
  readonly unresolvedCount: number;
  readonly outcomeCounts: Readonly<Record<SharedChatSceneOutcomeKind, number>>;
  readonly completionRate01: number;
  readonly interruptionRate01: number;
  readonly cancellationRate01: number;
  readonly timedOutRate01: number;
  readonly unresolvedRate01: number;
  readonly topArchetypes: readonly { archetype: SharedChatSceneArchetype; count: number }[];
}

export interface SceneArchiveAnalytics {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly totalArchived: number;
  readonly distribution: SceneOutcomeDistribution;
  readonly recentSceneId: string | null;
  readonly oldestSceneId: string | null;
  readonly averageDurationMs: number;
  readonly averageTagsPerScene: number;
  readonly averageCounterpartsPerScene: number;
  readonly topTags: readonly { tag: string; count: number }[];
  readonly topCounterparts: readonly { counterpartId: string; count: number }[];
  readonly topMomentTypes: readonly { momentType: SharedChatMomentType; count: number }[];
}

export interface SceneCarryoverScore {
  readonly sceneId: string;
  readonly score01: number;
  readonly isUnresolved: boolean;
  readonly hasCallbacks: boolean;
  readonly hasCounterparts: boolean;
  readonly ageMs: number;
  readonly agePenalty: number;
  readonly unresolvedBonus: number;
  readonly callbackBonus: number;
  readonly counterpartBonus: number;
  readonly tagRichness: number;
}

export interface SceneCounterpartParticipation {
  readonly counterpartId: string;
  readonly sceneCount: number;
  readonly sceneIds: readonly string[];
  readonly archetypes: readonly SharedChatSceneArchetype[];
  readonly latestSceneAt: number;
  readonly unresolvedSceneCount: number;
}

export interface SceneArc {
  readonly arcId: string;
  readonly playerId: string;
  readonly generatedAt: number;
  readonly anchorSceneId: string;
  readonly scenes: readonly SharedChatSceneArchiveRecord[];
  readonly sceneCount: number;
  readonly hasResolution: boolean;
  readonly dominantCounterpartIds: readonly string[];
  readonly dominantTags: readonly string[];
  readonly earliestAt: number;
  readonly latestAt: number;
}

export interface SceneArchiveMomentumScore {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly momentum01: number;
  readonly unresolvedWeight: number;
  readonly recencyWeight: number;
  readonly counterpartPressure: number;
  readonly callbackPressure: number;
  readonly activeThreadCount: number;
  readonly notes: readonly string[];
}

export interface SceneArchiveTagEntry {
  readonly tag: string;
  readonly count: number;
  readonly lastSeenAt: number;
}

export type SceneArchiveHealthStatus = 'HEALTHY' | 'DEGRADED' | 'NEAR_CAP' | 'OVERLOADED';

export interface SceneArchiveHealthProbe {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly totalScenes: number;
  readonly unresolvedCount: number;
  readonly staleUnresolvedCount: number;
  readonly completedCount: number;
  readonly bucketCapUsage01: number;
  readonly archetypeGaps: readonly SharedChatSceneArchetype[];
  readonly healthStatus: SceneArchiveHealthStatus;
  readonly issues: readonly string[];
}

export interface SceneArchiveDiff {
  readonly generatedAt: number;
  readonly addedCount: number;
  readonly removedCount: number;
  readonly resolvedCount: number;
  readonly updatedCount: number;
  readonly added: readonly SharedChatSceneArchiveRecord[];
  readonly removed: readonly SharedChatSceneArchiveRecord[];
  readonly resolved: readonly { before: SharedChatSceneArchiveRecord; after: SharedChatSceneArchiveRecord }[];
  readonly updated: readonly { before: SharedChatSceneArchiveRecord; after: SharedChatSceneArchiveRecord }[];
}

export interface SceneArchiveRunSummary {
  readonly playerId: string;
  readonly roomId: string;
  readonly generatedAt: number;
  readonly totalScenes: number;
  readonly completedCount: number;
  readonly interruptedCount: number;
  readonly unresolvedCount: number;
  readonly completionRate01: number;
  readonly uniqueArchetypes: readonly SharedChatSceneArchetype[];
  readonly uniqueCounterpartIds: readonly string[];
  readonly pendingCallbackAnchorIds: readonly string[];
  readonly outcomeSummaries: readonly string[];
}

export interface SceneArchiveExport {
  readonly playerId: string;
  readonly exportedAt: number;
  readonly version: string;
  readonly totalScenes: number;
  readonly scenes: readonly SharedChatSceneArchiveRecord[];
}

export interface SceneArchiveGlobalCoverageReport {
  readonly generatedAt: number;
  readonly totalPlayers: number;
  readonly totalScenes: number;
  readonly totalUnresolved: number;
  readonly totalCompleted: number;
  readonly globalCompletionRate01: number;
  readonly topArchetypes: readonly { archetype: SharedChatSceneArchetype; count: number }[];
  readonly topMomentTypes: readonly { momentType: SharedChatMomentType; count: number }[];
}

// ============================================================================
// MARK: Module constants
// ============================================================================

export const CHAT_SCENE_ARCHIVE_MODULE_NAME = 'PZO_BACKEND_CHAT_SCENE_ARCHIVE' as const;
export const CHAT_SCENE_ARCHIVE_MODULE_VERSION = '2026.03.23-scene-archive.v2' as const;

export const CHAT_SCENE_ARCHIVE_MODULE_LAWS = Object.freeze([
  'Only accepted backend-authoritative scene plans may be archived.',
  'Unresolved scenes must be tracked with carryover scoring priority.',
  'Archive depth is capped per player — oldest scenes are evicted first.',
  'Scene arcs are reconstructed from counterpart and tag proximity, not explicit links.',
  'Tag clouds serve scene theme diagnostics, not policy decisions.',
  'Health probes identify structural issues without auto-resolving them.',
  'Carryover scores inform continuity engine — not gate it.',
  'Export/restore must be idempotent — duplicate import must not double-count.',
  'Global coverage reports aggregate without player-level attribution leakage.',
  'Diff surfaces serve audit and replay only — not real-time fanout.',
] as const);

export const CHAT_SCENE_ARCHIVE_DEFAULTS = Object.freeze({
  maxScenesPerPlayer: DEFAULT_CHAT_SCENE_ARCHIVE_SERVICE_CONFIG.maxScenesPerPlayer,
  staleUnresolvedCutoffMs: 7 * 24 * 60 * 60 * 1000,
  momentumWindowScenes: 16,
  arcMaxDepth: 8,
  tagCloudLimit: 32,
  carryoverScoreTopLimit: 24,
  runSummarySceneLimit: 256,
  counterpartSceneLimit: 16,
  exportNdjsonMaxScenes: 4096,
} as const);

export const CHAT_SCENE_ARCHIVE_MODULE_DESCRIPTOR = Object.freeze({
  name: CHAT_SCENE_ARCHIVE_MODULE_NAME,
  version: CHAT_SCENE_ARCHIVE_MODULE_VERSION,
  laws: CHAT_SCENE_ARCHIVE_MODULE_LAWS,
  defaults: CHAT_SCENE_ARCHIVE_DEFAULTS,
  exportedClass: 'ChatSceneArchiveService',
  capabilities: Object.freeze([
    'scene_archival',
    'outcome_recording',
    'query_surface',
    'carryover_summary',
    'outcome_distribution',
    'archive_analytics',
    'carryover_scoring',
    'counterpart_participation',
    'scene_arc_reconstruction',
    'momentum_scoring',
    'tag_cloud',
    'health_probing',
    'archive_diff',
    'run_summary',
    'batch_archival',
    'export_restore',
    'global_coverage_report',
  ]),
} as const);

// ============================================================================
// MARK: Factory
// ============================================================================

/** Create a ChatSceneArchiveService with optional config overrides. */
export function createChatSceneArchiveService(
  config: Partial<ChatSceneArchiveServiceConfig> = {},
): ChatSceneArchiveService {
  return new ChatSceneArchiveService(config);
}

/** Build a complete scene archive analytics bundle for a player. */
export function buildPlayerSceneBundle(
  service: ChatSceneArchiveService,
  playerId: string,
  roomId?: string,
): PlayerSceneBundle {
  const analytics = service.buildAnalytics(playerId);
  const momentum = service.computeArchiveMomentum(playerId);
  const health = service.probeArchiveHealth(playerId);
  const carryoverScores = service.computeAllCarryoverScores(playerId, 12);
  const topCounterparts = service.buildCounterpartParticipation(playerId).slice(0, 6);
  const tagCloud = service.buildTagCloud(playerId, 16);
  const runSummary = roomId ? service.buildRunSummary(playerId, roomId) : null;

  return Object.freeze({
    playerId,
    generatedAt: Date.now(),
    analytics,
    momentum,
    health,
    carryoverScores,
    topCounterparts,
    tagCloud,
    runSummary,
  });
}

export interface PlayerSceneBundle {
  readonly playerId: string;
  readonly generatedAt: number;
  readonly analytics: SceneArchiveAnalytics;
  readonly momentum: SceneArchiveMomentumScore;
  readonly health: SceneArchiveHealthProbe;
  readonly carryoverScores: readonly SceneCarryoverScore[];
  readonly topCounterparts: readonly SceneCounterpartParticipation[];
  readonly tagCloud: readonly SceneArchiveTagEntry[];
  readonly runSummary: SceneArchiveRunSummary | null;
}

/** Utility: Check if a scene record is stale (unresolved and older than threshold). */
export function isStaleUnresolvedScene(
  record: SharedChatSceneArchiveRecord,
  staleCutoffMs = CHAT_SCENE_ARCHIVE_DEFAULTS.staleUnresolvedCutoffMs,
): boolean {
  if (record.outcome?.outcomeKind === 'COMPLETED') return false;
  return Date.now() - record.updatedAt > staleCutoffMs;
}

/** Utility: Describe a scene archive record in a single line. */
export function describeSceneRecord(record: SharedChatSceneArchiveRecord): string {
  const outcome = record.outcome ? record.outcome.outcomeKind : 'UNRESOLVED';
  const counterparts = record.counterpartIds.length > 0 ? ` counterparts=[${record.counterpartIds.slice(0, 3).join(',')}]` : '';
  return `[scene:${record.scene.sceneId}] arch=${record.scene.archetype} outcome=${outcome}${counterparts} tags=${record.tags.length}`;
}

/** Utility: Sort scenes by carryover pressure descending. */
export function sortScenesByCarryoverPressure(
  service: ChatSceneArchiveService,
  records: readonly SharedChatSceneArchiveRecord[],
): readonly SharedChatSceneArchiveRecord[] {
  return [...records].sort((a, b) => {
    const scoreA = service.computeCarryoverScore(a);
    const scoreB = service.computeCarryoverScore(b);
    return scoreB.score01 - scoreA.score01;
  });
}

/** Utility: Get scene IDs that have callbacks in common. */
export function findScenesWithSharedCallbacks(
  records: readonly SharedChatSceneArchiveRecord[],
  callbackId: string,
): readonly SharedChatSceneArchiveRecord[] {
  return records.filter((r) => r.callbackAnchorIds.includes(callbackId));
}

/** Utility: Compute overlap ratio between two scenes (shared tags + counterparts). */
export function computeSceneOverlap(
  a: SharedChatSceneArchiveRecord,
  b: SharedChatSceneArchiveRecord,
): number {
  const sharedTags = a.tags.filter((t) => b.tags.includes(t)).length;
  const sharedCounterparts = a.counterpartIds.filter((c) => b.counterpartIds.includes(c)).length;
  const totalUnique = new Set([...a.tags, ...b.tags, ...a.counterpartIds, ...b.counterpartIds]).size;
  if (totalUnique === 0) return 0;
  return (sharedTags + sharedCounterparts) / totalUnique;
}

/** Utility: Filter scenes to only those with at least minCounterparts unique counterparts. */
export function filterScenesByCounterpartCount(
  records: readonly SharedChatSceneArchiveRecord[],
  minCounterparts: number,
): readonly SharedChatSceneArchiveRecord[] {
  return records.filter((r) => r.counterpartIds.length >= minCounterparts);
}

/** Utility: Aggregate archetype counts from a list of scene records. */
export function aggregateArchetypeCounts(
  records: readonly SharedChatSceneArchiveRecord[],
): Readonly<Partial<Record<SharedChatSceneArchetype, number>>> {
  const counts: Partial<Record<SharedChatSceneArchetype, number>> = {};
  for (const record of records) {
    counts[record.scene.archetype] = (counts[record.scene.archetype] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

/** Utility: Get unique moment types from a list of scene records. */
export function getUniqueMomentTypes(
  records: readonly SharedChatSceneArchiveRecord[],
): readonly SharedChatMomentType[] {
  return [...new Set(records.map((r) => r.scene.momentType))];
}

/** Utility: Find the scene with the highest expected duration. */
export function findLongestExpectedScene(
  records: readonly SharedChatSceneArchiveRecord[],
): SharedChatSceneArchiveRecord | null {
  return records.reduce<SharedChatSceneArchiveRecord | null>((best, r) =>
    !best || r.scene.expectedDurationMs > best.scene.expectedDurationMs ? r : best,
  null);
}

/** Utility: Partition scenes into resolved vs unresolved groups. */
export function partitionScenesByResolution(records: readonly SharedChatSceneArchiveRecord[]): {
  resolved: readonly SharedChatSceneArchiveRecord[];
  unresolved: readonly SharedChatSceneArchiveRecord[];
} {
  const resolved = records.filter((r) => r.outcome?.outcomeKind === 'COMPLETED');
  const unresolved = records.filter((r) => !r.outcome || r.outcome.outcomeKind !== 'COMPLETED');
  return { resolved, unresolved };
}

/** Utility: Build a scene summary line for display/logging. */
export function buildSceneSummaryLine(record: SharedChatSceneArchiveRecord, includeOutcome = true): string {
  const parts: string[] = [
    `arch=${record.scene.archetype}`,
    `ch=${record.channelId}`,
    `room=${record.roomId}`,
  ];
  if (includeOutcome && record.outcome) parts.push(`outcome=${record.outcome.outcomeKind}`);
  if (record.tags.length > 0) parts.push(`tags=${record.tags.slice(0, 4).join(',')}`);
  return `[${parts.join(' ')}]`;
}

/** Utility: Score a scene for overlay reveal priority (unresolved + callbacks = high priority). */
export function sceneRevealPriority01(record: SharedChatSceneArchiveRecord): number {
  let score = 0;
  if (!record.outcome) score += 0.40;
  score += Math.min(record.callbackAnchorIds.length * 0.06, 0.24);
  score += Math.min(record.counterpartIds.length * 0.04, 0.16);
  score += Math.min(record.tags.length * 0.02, 0.10);
  const ageMs = Date.now() - record.createdAt;
  const ageFactor = Math.max(0, 1 - ageMs / (72 * 60 * 60 * 1000));
  score *= ageFactor;
  return Math.min(1, score);
}

// ============================================================================
// SCENE NARRATIVE WEIGHT — Deep scoring of narrative significance
// ============================================================================

export interface SceneNarrativeWeight {
  readonly archiveId: string;
  readonly archetype: SharedChatSceneArchetype;
  readonly weight01: number;
  readonly callbackDensity01: number;
  readonly counterpartDepth01: number;
  readonly recencyBonus01: number;
  readonly outcomeWeight01: number;
  readonly tagDiversity01: number;
  readonly isSignificant: boolean;
  readonly label: string;
}

const ARCHETYPE_BASE_WEIGHT: Record<SharedChatSceneArchetype, number> = {
  'BREACH_SCENE': 0.80,
  'TRAP_SCENE': 0.75,
  'RESCUE_SCENE': 0.70,
  'PUBLIC_HUMILIATION_SCENE': 0.85,
  'COMEBACK_WITNESS_SCENE': 0.90,
  'DEAL_ROOM_PRESSURE_SCENE': 0.65,
  'FALSE_CALM_SCENE': 0.55,
  'END_OF_RUN_RECKONING_SCENE': 0.95,
  'LONG_ARC_CALLBACK_SCENE': 0.88,
  'SEASON_EVENT_INTRUSION_SCENE': 0.72,
};

const OUTCOME_WEIGHT: Record<SharedChatSceneOutcomeKind, number> = {
  'COMPLETED': 1.0,
  'INTERRUPTED': 0.65,
  'CANCELLED': 0.20,
  'TIMED_OUT': 0.30,
  'OVERRIDDEN': 0.50,
};

export function computeSceneNarrativeWeight(
  record: SharedChatSceneArchiveRecord,
  nowMs: number = Date.now(),
): SceneNarrativeWeight {
  const baseWeight = ARCHETYPE_BASE_WEIGHT[record.scene.archetype] ?? 0.5;
  const callbackDensity01 = Math.min(record.callbackAnchorIds.length / 5, 1);
  const counterpartDepth01 = Math.min(record.counterpartIds.length / 4, 1);
  const ageMs = nowMs - record.createdAt;
  const recencyBonus01 = Math.max(0, 1 - ageMs / (48 * 60 * 60 * 1000));
  const outcomeWeight01 = record.outcome ? OUTCOME_WEIGHT[record.outcome.outcomeKind] ?? 0.5 : 0.5;
  const uniqueTagPrefixes = new Set(record.tags.map((t) => t.split('_')[0]));
  const tagDiversity01 = Math.min(uniqueTagPrefixes.size / 6, 1);
  const weight01 = Math.min(
    1,
    baseWeight * 0.35 +
    callbackDensity01 * 0.20 +
    counterpartDepth01 * 0.15 +
    recencyBonus01 * 0.10 +
    outcomeWeight01 * 0.10 +
    tagDiversity01 * 0.10,
  );
  const label =
    weight01 >= 0.80 ? 'CRITICAL' :
    weight01 >= 0.60 ? 'MAJOR' :
    weight01 >= 0.40 ? 'MODERATE' :
    'MINOR';
  return Object.freeze({
    archiveId: record.archiveId,
    archetype: record.scene.archetype,
    weight01,
    callbackDensity01,
    counterpartDepth01,
    recencyBonus01,
    outcomeWeight01,
    tagDiversity01,
    isSignificant: weight01 >= 0.60,
    label,
  });
}

// ============================================================================
// SCENE THREAD GRAPH — Link related scenes into narrative threads
// ============================================================================

export interface SceneThreadNode {
  readonly archiveId: string;
  readonly archetype: SharedChatSceneArchetype;
  readonly playerId: string;
  readonly weight01: number;
  readonly linkedTo: readonly string[];
  readonly depth: number;
}

export interface SceneThreadGraph {
  readonly rootId: string;
  readonly nodes: readonly SceneThreadNode[];
  readonly edges: readonly { from: string; to: string; strength01: number }[];
  readonly totalDepth: number;
  readonly averageWeight01: number;
  readonly dominantArchetype: SharedChatSceneArchetype | null;
}

export function buildSceneThreadGraph(
  rootRecord: SharedChatSceneArchiveRecord,
  allRecords: readonly SharedChatSceneArchiveRecord[],
  maxDepth: number = 4,
  nowMs: number = Date.now(),
): SceneThreadGraph {
  const byId = new Map(allRecords.map((r) => [r.archiveId, r]));
  const nodes: SceneThreadNode[] = [];
  const edges: { from: string; to: string; strength01: number }[] = [];
  const visited = new Set<string>();

  function traverse(id: string, depth: number): void {
    if (depth > maxDepth || visited.has(id)) return;
    visited.add(id);
    const rec = byId.get(id);
    if (!rec) return;
    const weight = computeSceneNarrativeWeight(rec, nowMs);
    const linkedTo: string[] = [];

    for (const otherId of rec.callbackAnchorIds) {
      const other = byId.get(otherId);
      if (!other) continue;
      const sharedCounterparts = rec.counterpartIds.filter((c) => other.counterpartIds.includes(c));
      const sharedTags = rec.tags.filter((t) => other.tags.includes(t));
      const strength01 = Math.min(1, sharedCounterparts.length * 0.30 + sharedTags.length * 0.10 + 0.20);
      edges.push({ from: id, to: otherId, strength01 });
      linkedTo.push(otherId);
      traverse(otherId, depth + 1);
    }

    nodes.push(Object.freeze({
      archiveId: id,
      archetype: rec.scene.archetype,
      playerId: rec.playerId,
      weight01: weight.weight01,
      linkedTo: Object.freeze(linkedTo),
      depth,
    }));
  }

  traverse(rootRecord.archiveId, 0);

  const totalDepth = nodes.reduce((max, n) => Math.max(max, n.depth), 0);
  const averageWeight01 = nodes.length > 0
    ? nodes.reduce((s, n) => s + n.weight01, 0) / nodes.length
    : 0;

  const archetypeCounts = new Map<SharedChatSceneArchetype, number>();
  for (const n of nodes) {
    archetypeCounts.set(n.archetype, (archetypeCounts.get(n.archetype) ?? 0) + 1);
  }
  let dominantArchetype: SharedChatSceneArchetype | null = null;
  let maxCount = 0;
  for (const [arch, count] of archetypeCounts) {
    if (count > maxCount) { maxCount = count; dominantArchetype = arch; }
  }

  return Object.freeze({
    rootId: rootRecord.archiveId,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
    totalDepth,
    averageWeight01,
    dominantArchetype,
  });
}

// ============================================================================
// SCENE MOMENTUM DECAY — Exponential decay scoring for archive velocity
// ============================================================================

export interface SceneMomentumDecayReport {
  readonly playerId: string;
  readonly decayedMomentum01: number;
  readonly rawMomentum01: number;
  readonly halfLifeMs: number;
  readonly sampleCount: number;
  readonly latestSceneAt: number | null;
  readonly velocityLabel: 'RAPID' | 'ACTIVE' | 'SLOWING' | 'DORMANT' | 'EMPTY';
}

export function computeSceneMomentumDecay(
  playerId: string,
  records: readonly SharedChatSceneArchiveRecord[],
  halfLifeMs: number = 4 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): SceneMomentumDecayReport {
  const playerRecords = records.filter((r) => r.playerId === playerId);
  if (playerRecords.length === 0) {
    return Object.freeze({
      playerId,
      decayedMomentum01: 0,
      rawMomentum01: 0,
      halfLifeMs,
      sampleCount: 0,
      latestSceneAt: null,
      velocityLabel: 'EMPTY',
    });
  }

  const sorted = [...playerRecords].sort((a, b) => b.createdAt - a.createdAt);
  const latestSceneAt = sorted[0].createdAt;

  let rawMomentum01 = 0;
  let decayedMomentum01 = 0;

  for (const rec of sorted) {
    const weight = computeSceneNarrativeWeight(rec, nowMs);
    const ageMs = nowMs - rec.createdAt;
    const decayFactor = Math.pow(0.5, ageMs / halfLifeMs);
    rawMomentum01 += weight.weight01;
    decayedMomentum01 += weight.weight01 * decayFactor;
  }

  rawMomentum01 = Math.min(1, rawMomentum01 / playerRecords.length);
  decayedMomentum01 = Math.min(1, decayedMomentum01 / playerRecords.length);

  const velocityLabel: SceneMomentumDecayReport['velocityLabel'] =
    decayedMomentum01 >= 0.80 ? 'RAPID' :
    decayedMomentum01 >= 0.55 ? 'ACTIVE' :
    decayedMomentum01 >= 0.30 ? 'SLOWING' :
    decayedMomentum01 > 0 ? 'DORMANT' : 'EMPTY';

  return Object.freeze({
    playerId,
    decayedMomentum01,
    rawMomentum01,
    halfLifeMs,
    sampleCount: playerRecords.length,
    latestSceneAt,
    velocityLabel,
  });
}

// ============================================================================
// SCENE ARCHIVE CONTINUITY BRIDGE — Feed continuity engine with scene data
// ============================================================================

export interface SceneContinuityBridgeEntry {
  readonly archiveId: string;
  readonly playerId: string;
  readonly archetype: SharedChatSceneArchetype;
  readonly outcomeKind: SharedChatSceneOutcomeKind | null;
  readonly callbackCount: number;
  readonly counterpartCount: number;
  readonly carryoverPressure01: number;
  readonly narrativeWeight01: number;
  readonly needsCallback: boolean;
  readonly createdAt: number;
}

export function buildContinuityBridgeEntries(
  records: readonly SharedChatSceneArchiveRecord[],
  minPressure01: number = 0.3,
  nowMs: number = Date.now(),
): readonly SceneContinuityBridgeEntry[] {
  const entries: SceneContinuityBridgeEntry[] = [];
  for (const rec of records) {
    const narrativeWeight = computeSceneNarrativeWeight(rec, nowMs);
    const callbackCount = rec.callbackAnchorIds.length;
    const counterpartCount = rec.counterpartIds.length;
    const carryoverPressure01 = computeCarryoverPressure(rec, nowMs);
    if (carryoverPressure01 < minPressure01 && narrativeWeight.weight01 < 0.5) continue;
    const outcomeKind = rec.outcome?.outcomeKind ?? null;
    const needsCallback = callbackCount > 0 && !rec.outcome;
    entries.push(Object.freeze({
      archiveId: rec.archiveId,
      playerId: rec.playerId,
      archetype: rec.scene.archetype,
      outcomeKind,
      callbackCount,
      counterpartCount,
      carryoverPressure01,
      narrativeWeight01: narrativeWeight.weight01,
      needsCallback,
      createdAt: rec.createdAt,
    }));
  }
  return Object.freeze(entries.sort((a, b) => b.carryoverPressure01 - a.carryoverPressure01));
}

function computeCarryoverPressure(rec: SharedChatSceneArchiveRecord, nowMs: number): number {
  let pressure = 0;
  if (!rec.outcome) pressure += 0.40;
  pressure += Math.min(rec.callbackAnchorIds.length * 0.08, 0.32);
  pressure += Math.min(rec.counterpartIds.length * 0.05, 0.20);
  const ageMs = nowMs - rec.createdAt;
  const decayFactor = Math.max(0, 1 - ageMs / (96 * 60 * 60 * 1000));
  return Math.min(1, pressure * decayFactor);
}

// ============================================================================
// SCENE QUERY ENGINE — Advanced query operators over archive records
// ============================================================================

export interface SceneQueryFilter {
  readonly playerIds?: readonly string[];
  readonly roomIds?: readonly string[];
  readonly archetypes?: readonly SharedChatSceneArchetype[];
  readonly outcomeKinds?: readonly SharedChatSceneOutcomeKind[];
  readonly requireCallbacks?: boolean;
  readonly requireUnresolved?: boolean;
  readonly minCarryoverPressure01?: number;
  readonly minNarrativeWeight01?: number;
  readonly tags?: readonly string[];
  readonly counterpartIds?: readonly string[];
  readonly createdAfterMs?: number;
  readonly createdBeforeMs?: number;
  readonly limit?: number;
}

export function querySceneArchive(
  records: readonly SharedChatSceneArchiveRecord[],
  filter: SceneQueryFilter,
  nowMs: number = Date.now(),
): readonly SharedChatSceneArchiveRecord[] {
  let result = records as SharedChatSceneArchiveRecord[];

  if (filter.playerIds?.length) {
    const set = new Set(filter.playerIds);
    result = result.filter((r) => set.has(r.playerId));
  }
  if (filter.roomIds?.length) {
    const set = new Set(filter.roomIds);
    result = result.filter((r) => set.has(r.roomId));
  }
  if (filter.archetypes?.length) {
    const set = new Set(filter.archetypes);
    result = result.filter((r) => set.has(r.scene.archetype));
  }
  if (filter.outcomeKinds?.length) {
    const set = new Set(filter.outcomeKinds);
    result = result.filter((r) => r.outcome != null && set.has(r.outcome.outcomeKind));
  }
  if (filter.requireCallbacks) {
    result = result.filter((r) => r.callbackAnchorIds.length > 0);
  }
  if (filter.requireUnresolved) {
    result = result.filter((r) => r.outcome == null);
  }
  if (filter.tags?.length) {
    const required = filter.tags;
    result = result.filter((r) => required.some((t) => r.tags.includes(t)));
  }
  if (filter.counterpartIds?.length) {
    const required = filter.counterpartIds;
    result = result.filter((r) => required.some((c) => r.counterpartIds.includes(c)));
  }
  if (filter.createdAfterMs != null) {
    const after = filter.createdAfterMs;
    result = result.filter((r) => r.createdAt > after);
  }
  if (filter.createdBeforeMs != null) {
    const before = filter.createdBeforeMs;
    result = result.filter((r) => r.createdAt < before);
  }
  if (filter.minCarryoverPressure01 != null) {
    const min = filter.minCarryoverPressure01;
    result = result.filter((r) => computeCarryoverPressure(r, nowMs) >= min);
  }
  if (filter.minNarrativeWeight01 != null) {
    const min = filter.minNarrativeWeight01;
    result = result.filter((r) => computeSceneNarrativeWeight(r, nowMs).weight01 >= min);
  }

  const sorted = result.sort((a, b) => b.createdAt - a.createdAt);
  return Object.freeze(filter.limit != null ? sorted.slice(0, filter.limit) : sorted);
}

// ============================================================================
// SCENE PLAYBACK CURSOR — Stateful playback of archive records by room
// ============================================================================

export interface ScenePlaybackCursorState {
  readonly roomId: string;
  readonly playerId: string;
  readonly cursor: number;
  readonly totalScenes: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
  readonly currentRecord: SharedChatSceneArchiveRecord | null;
}

export class ScenePlaybackCursor {
  private cursor: number = 0;
  private records: SharedChatSceneArchiveRecord[];

  constructor(
    records: readonly SharedChatSceneArchiveRecord[],
    private readonly playerId: string,
    private readonly roomId: string,
  ) {
    this.records = [...records]
      .filter((r) => r.playerId === playerId && r.roomId === roomId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  seek(index: number): this {
    this.cursor = Math.max(0, Math.min(this.records.length - 1, index));
    return this;
  }

  seekToLatest(): this {
    this.cursor = Math.max(0, this.records.length - 1);
    return this;
  }

  seekToOldest(): this {
    this.cursor = 0;
    return this;
  }

  next(): SharedChatSceneArchiveRecord | null {
    if (this.cursor >= this.records.length - 1) return null;
    return this.records[++this.cursor] ?? null;
  }

  prev(): SharedChatSceneArchiveRecord | null {
    if (this.cursor <= 0) return null;
    return this.records[--this.cursor] ?? null;
  }

  current(): SharedChatSceneArchiveRecord | null {
    return this.records[this.cursor] ?? null;
  }

  state(): ScenePlaybackCursorState {
    return Object.freeze({
      roomId: this.roomId,
      playerId: this.playerId,
      cursor: this.cursor,
      totalScenes: this.records.length,
      hasNext: this.cursor < this.records.length - 1,
      hasPrev: this.cursor > 0,
      currentRecord: this.current(),
    });
  }

  /** Slice a window of records around the cursor. */
  window(radius: number = 2): readonly SharedChatSceneArchiveRecord[] {
    const start = Math.max(0, this.cursor - radius);
    const end = Math.min(this.records.length, this.cursor + radius + 1);
    return Object.freeze(this.records.slice(start, end));
  }

  /** Find the nearest significant scene (weight >= threshold). */
  seekToNearestSignificant(threshold: number = 0.6, nowMs: number = Date.now()): this {
    let bestIdx = this.cursor;
    let bestDist = Infinity;
    for (let i = 0; i < this.records.length; i++) {
      const w = computeSceneNarrativeWeight(this.records[i], nowMs);
      if (w.weight01 >= threshold) {
        const dist = Math.abs(i - this.cursor);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
    }
    this.cursor = bestIdx;
    return this;
  }
}

// ============================================================================
// SCENE ARCHIVE REPLAY LOG — Ordered replay of scene events for audit
// ============================================================================

export interface SceneReplayEvent {
  readonly seqNo: number;
  readonly archiveId: string;
  readonly eventType: 'ARCHIVED' | 'OUTCOME_APPENDED' | 'STALE_DETECTED' | 'EVICTED';
  readonly playerId: string;
  readonly archetype: SharedChatSceneArchetype;
  readonly timestampMs: number;
  readonly metadata: Readonly<Record<string, string>>;
}

export class SceneArchiveReplayLog {
  private readonly events: SceneReplayEvent[] = [];
  private seqNo: number = 0;

  emit(
    archiveId: string,
    eventType: SceneReplayEvent['eventType'],
    record: Pick<SharedChatSceneArchiveRecord, 'playerId' | 'scene'>,
    metadata: Record<string, string> = {},
  ): void {
    this.events.push(Object.freeze({
      seqNo: this.seqNo++,
      archiveId,
      eventType,
      playerId: record.playerId,
      archetype: record.scene.archetype,
      timestampMs: Date.now(),
      metadata: Object.freeze({ ...metadata }),
    }));
  }

  getEvents(): readonly SceneReplayEvent[] {
    return Object.freeze([...this.events]);
  }

  getEventsFor(archiveId: string): readonly SceneReplayEvent[] {
    return Object.freeze(this.events.filter((e) => e.archiveId === archiveId));
  }

  getEventsByType(eventType: SceneReplayEvent['eventType']): readonly SceneReplayEvent[] {
    return Object.freeze(this.events.filter((e) => e.eventType === eventType));
  }

  getLatestEventFor(archiveId: string): SceneReplayEvent | null {
    const evts = this.events.filter((e) => e.archiveId === archiveId);
    return evts.length > 0 ? evts[evts.length - 1] : null;
  }

  trimBefore(seqNo: number): void {
    const idx = this.events.findIndex((e) => e.seqNo >= seqNo);
    if (idx > 0) this.events.splice(0, idx);
  }

  size(): number { return this.events.length; }
  clear(): void { this.events.length = 0; }

  /** Serialize replay log to JSON string for persistence. */
  serialize(): string {
    return JSON.stringify({ seqNo: this.seqNo, events: this.events });
  }

  /** Reconstruct replay log from serialized JSON. */
  static deserialize(raw: string): SceneArchiveReplayLog {
    const log = new SceneArchiveReplayLog();
    try {
      const parsed = JSON.parse(raw) as { seqNo: number; events: SceneReplayEvent[] };
      log.seqNo = parsed.seqNo ?? 0;
      for (const e of parsed.events ?? []) log.events.push(Object.freeze(e));
    } catch {
      // malformed — return empty log
    }
    return log;
  }
}

// ============================================================================
// SCENE ARCHIVE WATCHER — Observer pattern for archive mutations
// ============================================================================

export type SceneArchiveWatchEvent =
  | { type: 'SCENE_ARCHIVED'; record: SharedChatSceneArchiveRecord }
  | { type: 'OUTCOME_APPENDED'; archiveId: string; outcome: SharedChatSceneOutcome }
  | { type: 'SCENE_EVICTED'; archiveId: string; playerId: string }
  | { type: 'BATCH_ARCHIVED'; count: number; playerIds: readonly string[] }
  | { type: 'ARCHIVE_CLEARED'; playerId: string };

export type SceneArchiveWatcher = (event: SceneArchiveWatchEvent) => void;

export class SceneArchiveWatchBus {
  private readonly watchers: Set<SceneArchiveWatcher> = new Set();

  subscribe(watcher: SceneArchiveWatcher): () => void {
    this.watchers.add(watcher);
    return () => this.watchers.delete(watcher);
  }

  emit(event: SceneArchiveWatchEvent): void {
    for (const watcher of this.watchers) {
      try { watcher(event); } catch { /* watcher must not throw */ }
    }
  }

  subscriberCount(): number { return this.watchers.size; }
  clear(): void { this.watchers.clear(); }
}

// ============================================================================
// SCENE ARCHIVE SNAPSHOT — Frozen read-only copy for transport/persistence
// ============================================================================

export interface SceneArchiveSnapshot {
  readonly snapshotId: string;
  readonly capturedAt: number;
  readonly playerIds: readonly string[];
  readonly totalRecords: number;
  readonly unresolvedCount: number;
  readonly completedCount: number;
  readonly archetypeBreakdown: Readonly<Partial<Record<SharedChatSceneArchetype, number>>>;
  readonly momentumByPlayer: Readonly<Record<string, number>>;
  readonly topCallbackAnchors: readonly string[];
}

export function captureArchiveSnapshot(
  records: readonly SharedChatSceneArchiveRecord[],
  snapshotId: string,
  nowMs: number = Date.now(),
): SceneArchiveSnapshot {
  const playerIds = [...new Set(records.map((r) => r.playerId))];
  const totalRecords = records.length;
  const unresolvedCount = records.filter((r) => r.outcome == null).length;
  const completedCount = records.filter((r) => r.outcome?.outcomeKind === 'COMPLETED').length;

  const archetypeBreakdown: Partial<Record<SharedChatSceneArchetype, number>> = {};
  for (const rec of records) {
    const arch = rec.scene.archetype;
    archetypeBreakdown[arch] = (archetypeBreakdown[arch] ?? 0) + 1;
  }

  const momentumByPlayer: Record<string, number> = {};
  for (const pid of playerIds) {
    const report = computeSceneMomentumDecay(pid, records, undefined, nowMs);
    momentumByPlayer[pid] = report.decayedMomentum01;
  }

  const callbackCounts = new Map<string, number>();
  for (const rec of records) {
    for (const cbId of rec.callbackAnchorIds) {
      callbackCounts.set(cbId, (callbackCounts.get(cbId) ?? 0) + 1);
    }
  }
  const topCallbackAnchors = [...callbackCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  return Object.freeze({
    snapshotId,
    capturedAt: nowMs,
    playerIds: Object.freeze(playerIds),
    totalRecords,
    unresolvedCount,
    completedCount,
    archetypeBreakdown: Object.freeze(archetypeBreakdown),
    momentumByPlayer: Object.freeze(momentumByPlayer),
    topCallbackAnchors: Object.freeze(topCallbackAnchors),
  });
}

// ============================================================================
// SCENE ARCHIVE COMPRESSOR — Compact old resolved scenes into summary entries
// ============================================================================

export interface SceneArchiveCompressionResult {
  readonly removedCount: number;
  readonly retainedCount: number;
  readonly compressedSummaries: readonly string[];
  readonly spaceSavedEstimateBytes: number;
}

export function compressOldResolvedScenes(
  records: SharedChatSceneArchiveRecord[],
  retainWindowMs: number = 7 * 24 * 60 * 60 * 1000,
  nowMs: number = Date.now(),
): { kept: SharedChatSceneArchiveRecord[]; result: SceneArchiveCompressionResult } {
  const cutoff = nowMs - retainWindowMs;
  const toCompress = records.filter(
    (r) => r.outcome != null && r.createdAt < cutoff && r.callbackAnchorIds.length === 0,
  );
  const toKeep = records.filter(
    (r) => !(r.outcome != null && r.createdAt < cutoff && r.callbackAnchorIds.length === 0),
  );
  const summaries = toCompress.map((r) =>
    `${r.archiveId}|${r.scene.archetype}|${r.outcome!.outcomeKind}|${r.createdAt}`,
  );
  const estimatedBytesPerRecord = 400;
  return {
    kept: toKeep,
    result: Object.freeze({
      removedCount: toCompress.length,
      retainedCount: toKeep.length,
      compressedSummaries: Object.freeze(summaries),
      spaceSavedEstimateBytes: toCompress.length * estimatedBytesPerRecord,
    }),
  };
}

// ============================================================================
// SCENE ARCHIVE MODULE EXPORTS
// ============================================================================

export const CHAT_SCENE_ARCHIVE_LAWS = Object.freeze([
  'All archetype values must come from SharedChatSceneArchetype — never raw strings.',
  'Carryover pressure must use exponential decay relative to nowMs.',
  'Thread graphs never exceed maxDepth to prevent infinite recursion.',
  'Archive snapshots are frozen and never mutated after capture.',
  'Compression only removes resolved scenes with no callbacks older than retention window.',
  'Replay log sequence numbers are monotonically increasing.',
  'Watch bus watchers must not throw — errors are silently swallowed.',
  'Narrative weights are bounded to [0, 1] at all times.',
]);

export const CHAT_SCENE_ARCHIVE_ARCHETYPE_LABELS: Readonly<Record<SharedChatSceneArchetype, string>> = Object.freeze({
  'BREACH_SCENE': 'Breach',
  'TRAP_SCENE': 'Trap',
  'RESCUE_SCENE': 'Rescue',
  'PUBLIC_HUMILIATION_SCENE': 'Public Humiliation',
  'COMEBACK_WITNESS_SCENE': 'Comeback Witness',
  'DEAL_ROOM_PRESSURE_SCENE': 'Deal Room Pressure',
  'FALSE_CALM_SCENE': 'False Calm',
  'END_OF_RUN_RECKONING_SCENE': 'End-of-Run Reckoning',
  'LONG_ARC_CALLBACK_SCENE': 'Long Arc Callback',
  'SEASON_EVENT_INTRUSION_SCENE': 'Season Event Intrusion',
});

export const CHAT_SCENE_ARCHIVE_OUTCOME_LABELS: Readonly<Record<SharedChatSceneOutcomeKind, string>> = Object.freeze({
  'COMPLETED': 'Completed',
  'INTERRUPTED': 'Interrupted',
  'CANCELLED': 'Cancelled',
  'TIMED_OUT': 'Timed Out',
  'OVERRIDDEN': 'Overridden',
});

/** Score a batch of records and return sorted entries for the continuity engine. */
export function rankScenesByNarrativePressure(
  records: readonly SharedChatSceneArchiveRecord[],
  nowMs: number = Date.now(),
): readonly { archiveId: string; pressure01: number; weight01: number; rank: number }[] {
  const scored = records.map((r) => ({
    archiveId: r.archiveId,
    pressure01: computeCarryoverPressure(r, nowMs),
    weight01: computeSceneNarrativeWeight(r, nowMs).weight01,
  }));
  scored.sort((a, b) => (b.pressure01 + b.weight01) - (a.pressure01 + a.weight01));
  return Object.freeze(scored.map((s, i) => Object.freeze({ ...s, rank: i + 1 })));
}

/** Compute the coverage ratio of archetypes seen vs. total known archetypes. */
export function computeArchetypeCoverageRatio(records: readonly SharedChatSceneArchiveRecord[]): number {
  const TOTAL_ARCHETYPES = 10; // all 10 SharedChatSceneArchetype values
  const seen = new Set(records.map((r) => r.scene.archetype));
  return seen.size / TOTAL_ARCHETYPES;
}

/** Find scenes where two specific players co-appear as counterparts. */
export function findSharedCounterpartScenes(
  records: readonly SharedChatSceneArchiveRecord[],
  playerIdA: string,
  playerIdB: string,
): readonly SharedChatSceneArchiveRecord[] {
  return Object.freeze(
    records.filter(
      (r) => r.counterpartIds.includes(playerIdA) && r.counterpartIds.includes(playerIdB),
    ),
  );
}

/** Check if a scene plan references any currently unresolved scenes (nested callbacks). */
export function detectCircularCallbackRisk(
  newRecord: Pick<SharedChatSceneArchiveRecord, 'archiveId' | 'callbackAnchorIds'>,
  existingRecords: readonly SharedChatSceneArchiveRecord[],
  depthLimit: number = 3,
): boolean {
  const unresolvedIds = new Set(
    existingRecords.filter((r) => r.outcome == null).map((r) => r.archiveId),
  );
  function hasCircular(id: string, depth: number): boolean {
    if (depth > depthLimit) return true;
    const rec = existingRecords.find((r) => r.archiveId === id);
    if (!rec) return false;
    for (const cbId of rec.callbackAnchorIds) {
      if (cbId === newRecord.archiveId) return true;
      if (unresolvedIds.has(cbId) && hasCircular(cbId, depth + 1)) return true;
    }
    return false;
  }
  return newRecord.callbackAnchorIds.some((cbId) => hasCircular(cbId, 0));
}

/** Build a per-moment-type frequency table from a set of scene records. */
export function buildMomentTypeFrequencyTable(
  records: readonly SharedChatSceneArchiveRecord[],
): Readonly<Partial<Record<SharedChatMomentType, number>>> {
  const table: Partial<Record<SharedChatMomentType, number>> = {};
  for (const rec of records) {
    const mt = rec.scene.momentType;
    table[mt] = (table[mt] ?? 0) + 1;
  }
  return Object.freeze(table);
}

/** Return the scene plan from an archive record for direct access. */
export function extractScenePlan(record: SharedChatSceneArchiveRecord): SharedChatScenePlan {
  return record.scene;
}

/** Build a carryover summary for a player from their unresolved archive records. */
export function buildCarryoverSummary(
  playerId: string,
  records: readonly SharedChatSceneArchiveRecord[],
  nowMs: number = Date.now(),
): SharedChatSceneCarryoverSummary {
  const playerRecords = records.filter((r) => r.playerId === playerId);
  const unresolved = playerRecords.filter((r) => r.outcome == null);
  const unresolvedSceneIds = unresolved.map((r) => r.archiveId);
  const activeCounterpartIds = [...new Set(unresolved.flatMap((r) => r.counterpartIds))];
  const suggestedCallbackAnchorIds = [...new Set(
    unresolved.flatMap((r) => r.callbackAnchorIds),
  )].slice(0, 8);
  const summaryLines = unresolved.slice(0, 5).map((r) => {
    const weight = computeSceneNarrativeWeight(r, nowMs);
    return `${r.scene.archetype} | weight=${weight.weight01.toFixed(2)} | callbacks=${r.callbackAnchorIds.length}`;
  });
  return Object.freeze({
    playerId,
    generatedAt: nowMs,
    unresolvedSceneIds: Object.freeze(unresolvedSceneIds),
    activeCounterpartIds: Object.freeze(activeCounterpartIds),
    summaryLines: Object.freeze(summaryLines),
    suggestedCallbackAnchorIds: Object.freeze(suggestedCallbackAnchorIds),
  });
}

/** Build a compact fingerprint string for a set of scene records (for caching/diffing). */
export function computeArchiveFingerprint(records: readonly SharedChatSceneArchiveRecord[]): string {
  const sorted = [...records].sort((a, b) => a.archiveId.localeCompare(b.archiveId));
  const parts = sorted.map((r) => `${r.archiveId}:${r.outcome?.outcomeKind ?? 'open'}:${r.createdAt}`);
  return parts.join('|');
}

/** Build a one-line trace for an archive record, suitable for server logs. */
export function traceSceneRecord(record: SharedChatSceneArchiveRecord): string {
  const outcome = record.outcome ? record.outcome.outcomeKind : 'OPEN';
  const callbacks = record.callbackAnchorIds.length;
  const counterparts = record.counterpartIds.length;
  return `[SCENE arch=${record.scene.archetype} outcome=${outcome} cb=${callbacks} cp=${counterparts} tags=${record.tags.length} room=${record.roomId} player=${record.playerId}]`;
}

/** Check if an archive record is a high-fidelity scene eligible for ML training export. */
export function isHighFidelityScene(
  record: SharedChatSceneArchiveRecord,
  nowMs: number = Date.now(),
): boolean {
  if (record.outcome == null) return false;
  if (record.outcome.outcomeKind === 'CANCELLED') return false;
  const weight = computeSceneNarrativeWeight(record, nowMs);
  return weight.weight01 >= 0.55;
}

/** Emit a structured analytics event payload for a given archive record. */
export function buildSceneAnalyticsPayload(
  record: SharedChatSceneArchiveRecord,
  nowMs: number = Date.now(),
): Readonly<Record<string, unknown>> {
  const weight = computeSceneNarrativeWeight(record, nowMs);
  const pressure = computeCarryoverPressure(record, nowMs);
  return Object.freeze({
    archiveId: record.archiveId,
    playerId: record.playerId,
    roomId: record.roomId,
    channelId: record.channelId,
    archetype: record.scene.archetype,
    outcomeKind: record.outcome?.outcomeKind ?? null,
    callbackCount: record.callbackAnchorIds.length,
    counterpartCount: record.counterpartIds.length,
    tagCount: record.tags.length,
    carryoverPressure01: pressure,
    narrativeWeight01: weight.weight01,
    weightLabel: weight.label,
    isSignificant: weight.isSignificant,
    ageMs: nowMs - record.createdAt,
    createdAt: record.createdAt,
  });
}

export interface SceneArchiveQuerySummary {
  readonly matchCount: number;
  readonly unresolvedCount: number;
  readonly completedCount: number;
  readonly averageNarrativeWeight01: number;
  readonly dominantArchetype: SharedChatSceneArchetype | null;
  readonly totalCallbacks: number;
  readonly totalCounterparts: number;
}

export function summarizeQueryResults(
  records: readonly SharedChatSceneArchiveRecord[],
  nowMs: number = Date.now(),
): SceneArchiveQuerySummary {
  if (records.length === 0) {
    return Object.freeze({
      matchCount: 0,
      unresolvedCount: 0,
      completedCount: 0,
      averageNarrativeWeight01: 0,
      dominantArchetype: null,
      totalCallbacks: 0,
      totalCounterparts: 0,
    });
  }
  const unresolvedCount = records.filter((r) => r.outcome == null).length;
  const completedCount = records.filter((r) => r.outcome?.outcomeKind === 'COMPLETED').length;
  const totalWeight = records.reduce(
    (s, r) => s + computeSceneNarrativeWeight(r, nowMs).weight01, 0,
  );
  const archetypeCounts = new Map<SharedChatSceneArchetype, number>();
  for (const r of records) {
    archetypeCounts.set(r.scene.archetype, (archetypeCounts.get(r.scene.archetype) ?? 0) + 1);
  }
  let dominantArchetype: SharedChatSceneArchetype | null = null;
  let maxCount = 0;
  for (const [arch, count] of archetypeCounts) {
    if (count > maxCount) { maxCount = count; dominantArchetype = arch; }
  }
  const totalCallbacks = records.reduce((s, r) => s + r.callbackAnchorIds.length, 0);
  const totalCounterparts = records.reduce((s, r) => s + r.counterpartIds.length, 0);
  return Object.freeze({
    matchCount: records.length,
    unresolvedCount,
    completedCount,
    averageNarrativeWeight01: totalWeight / records.length,
    dominantArchetype,
    totalCallbacks,
    totalCounterparts,
  });
}
