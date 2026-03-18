/**
 * Durable scene archival and carryover summary generation.
 */
import type {
  SharedChatSceneArchiveQuery,
  SharedChatSceneArchiveRecord,
  SharedChatSceneCarryoverSummary,
  SharedChatSceneOutcome,
  SharedChatScenePlan,
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
}
