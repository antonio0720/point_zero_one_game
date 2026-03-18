/**
 * Server bridge between transport sessions and backend memory/novelty/player-model services.
 */
import type { EpisodicMemoryCallbackRequest, EpisodicMemoryCallbackResponse } from '../../../shared/contracts/chat/memory';
import type { NoveltyEventRecord, NoveltyRankingRequest, NoveltyRankingResult } from '../../../shared/contracts/chat/novelty';
import type { ChatPlayerModelEvidence, ChatPlayerModelSnapshot } from '../../../shared/contracts/chat/player-model';
import type { SharedChatSceneArchiveRecord, SharedChatScenePlan } from '../../../shared/contracts/chat/scene';

export interface ChatSessionMemoryGatewayPorts {
  readonly memoryService: {
    selectCallbacks(request: EpisodicMemoryCallbackRequest): EpisodicMemoryCallbackResponse;
  };
  readonly noveltyService: {
    recordEvent(playerId: string, event: NoveltyEventRecord): NoveltyEventRecord;
    rank(request: NoveltyRankingRequest): NoveltyRankingResult;
  };
  readonly playerModelService: {
    ingestEvidence(playerId: string, evidence: ChatPlayerModelEvidence): ChatPlayerModelSnapshot;
    getSnapshot(playerId: string): ChatPlayerModelSnapshot;
  };
  readonly sceneArchiveService?: {
    archiveScene(playerId: string, roomId: string, channelId: SharedChatSceneArchiveRecord['channelId'], scene: SharedChatScenePlan): SharedChatSceneArchiveRecord;
  };
}

export class ChatSessionMemoryGateway {
  private readonly ports: ChatSessionMemoryGatewayPorts;
  private readonly sessionToPlayer = new Map<string, string>();

  public constructor(ports: ChatSessionMemoryGatewayPorts) {
    this.ports = ports;
  }

  public attachSession(sessionId: string, playerId: string): void {
    this.sessionToPlayer.set(sessionId, playerId);
  }

  public detachSession(sessionId: string): void {
    this.sessionToPlayer.delete(sessionId);
  }

  public rankNovelty(sessionId: string, request: Omit<NoveltyRankingRequest, 'playerId'>): NoveltyRankingResult {
    return this.ports.noveltyService.rank({ ...request, playerId: this.sessionToPlayer.get(sessionId) });
  }

  public recordNoveltyEvent(sessionId: string, event: NoveltyEventRecord): NoveltyEventRecord {
    return this.ports.noveltyService.recordEvent(this.sessionToPlayer.get(sessionId) ?? 'GLOBAL', event);
  }

  public fetchCallbacks(sessionId: string, request: Omit<EpisodicMemoryCallbackRequest, 'playerId'>): EpisodicMemoryCallbackResponse {
    return this.ports.memoryService.selectCallbacks({ ...request, playerId: this.sessionToPlayer.get(sessionId) });
  }

  public ingestPlayerEvidence(sessionId: string, evidence: Omit<ChatPlayerModelEvidence, 'createdAt'> & { createdAt?: number }): ChatPlayerModelSnapshot {
    return this.ports.playerModelService.ingestEvidence(this.sessionToPlayer.get(sessionId) ?? 'GLOBAL', {
      ...evidence,
      createdAt: evidence.createdAt ?? Date.now(),
    });
  }

  public getPlayerModel(sessionId: string): ChatPlayerModelSnapshot {
    return this.ports.playerModelService.getSnapshot(this.sessionToPlayer.get(sessionId) ?? 'GLOBAL');
  }
}
