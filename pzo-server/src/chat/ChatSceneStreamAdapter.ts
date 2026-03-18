/**
 * Scene archive -> transport packet adapter.
 */
import type { SharedChatSceneArchiveRecord } from '../../../shared/contracts/chat/scene';

export interface ChatSceneStreamPacket {
  readonly type: 'chat.scene.start' | 'chat.scene.beat' | 'chat.scene.summary';
  readonly sceneId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export class ChatSceneStreamAdapter {
  public createPackets(record: SharedChatSceneArchiveRecord): readonly ChatSceneStreamPacket[] {
    const packets: ChatSceneStreamPacket[] = [];
    packets.push({
      type: 'chat.scene.start',
      sceneId: record.scene.sceneId,
      payload: {
        archetype: record.scene.archetype,
        momentType: record.scene.momentType,
        primaryChannel: record.scene.primaryChannel,
        callbackAnchorIds: record.callbackAnchorIds,
      },
    });

    for (const beat of record.scene.beats) {
      packets.push({
        type: 'chat.scene.beat',
        sceneId: record.scene.sceneId,
        payload: {
          beatType: beat.beatType,
          sceneRole: beat.sceneRole,
          actorId: beat.actorId,
          actorKind: beat.actorKind,
          delayMs: beat.delayMs,
          semanticClusterIds: beat.semanticClusterIds,
          rhetoricalTemplateIds: beat.rhetoricalTemplateIds,
        },
      });
    }

    packets.push({
      type: 'chat.scene.summary',
      sceneId: record.scene.sceneId,
      payload: {
        outcome: record.outcome,
        tags: record.tags,
        counterpartIds: record.counterpartIds,
      },
    });
    return packets;
  }
}
