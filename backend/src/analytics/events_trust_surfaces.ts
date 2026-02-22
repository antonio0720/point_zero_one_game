/**
 * Analytics events for Point Zero One Digital
 */

declare namespace Analytics {
  type Event = 'PROOF_MINTED' | 'PROOF_SHARED_DRAFT' | 'PROOF_STAMPED' | 'PROOF_SHARED_VERIFIED' | 'EXPLORER_VIEW' | 'SHOWCASE_VIEW';

  interface EventData {
    event: Event;
    timestamp: number;
    playerId?: string;
    gameInstanceId?: string;
    roundNumber?: number;
    assetId?: string;
    proofId?: string;
    explorerViewType?: 'asset' | 'proof';
  }

  function emit(event: Event, data?: EventData): void;
}

export { Analytics };
