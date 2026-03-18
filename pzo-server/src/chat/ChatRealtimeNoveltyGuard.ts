/**
 * Server-time candidate screening using semantic similarity and novelty history.
 */
import type { NoveltyCandidateDescriptor, NoveltyRankingRequest, NoveltyRankingResult } from '../../../shared/contracts/chat/novelty';
import type { ChatSemanticDocumentInput, ChatSemanticNoveltyDecision, ChatSemanticNoveltyGuardRequest } from '../../../shared/contracts/chat/semantic-similarity';
import { ChatSemanticSimilarityIndex } from '../../../backend/src/game/engine/chat/intelligence/ChatSemanticSimilarityIndex';

export interface ChatRealtimeNoveltyGuardPorts {
  readonly noveltyService: {
    rank(request: NoveltyRankingRequest): NoveltyRankingResult;
  };
}

export class ChatRealtimeNoveltyGuard {
  private readonly semanticIndex: ChatSemanticSimilarityIndex;
  private readonly ports: ChatRealtimeNoveltyGuardPorts;

  public constructor(ports: ChatRealtimeNoveltyGuardPorts, semanticIndex: ChatSemanticSimilarityIndex = new ChatSemanticSimilarityIndex()) {
    this.ports = ports;
    this.semanticIndex = semanticIndex;
  }

  public screenSingle(request: ChatSemanticNoveltyGuardRequest): ChatSemanticNoveltyDecision {
    return this.semanticIndex.guardNovelty(request);
  }

  public screenSet(
    rankingRequest: NoveltyRankingRequest,
    semanticDocuments: readonly ChatSemanticDocumentInput[],
  ): {
    readonly novelty: NoveltyRankingResult;
    readonly semantic: readonly ChatSemanticNoveltyDecision[];
    readonly allowedCandidateIds: readonly string[];
  } {
    const novelty = this.ports.noveltyService.rank(rankingRequest);
    const indexed = semanticDocuments.map((document) => this.semanticIndex.indexDocument(document));
    const semantic = semanticDocuments.map((document) => this.semanticIndex.guardNovelty({
      requestId: `semantic:${document.documentId}`,
      candidate: document,
      now: document.createdAt,
      recentDocuments: indexed.filter((indexedDocument) => indexedDocument.documentId !== document.documentId),
    }));
    const allowedCandidateIds = semantic.filter((decision) => decision.allowed).map((decision) => decision.candidateDocument.documentId);
    return { novelty, semantic, allowedCandidateIds };
  }
}
