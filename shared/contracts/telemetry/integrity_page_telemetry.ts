/**
 * Integrity Page Telemetry Contracts
 */

export interface IntegrityPageViewEvent {
  timestamp: number;
  userId: string;
  gameVersion: string;
  platform: string;
  integrityPageType: 'leaderboard' | 'proof' | 'replay' | 'season';
}

export interface IntegrityCtaClickEvent extends IntegrityPageViewEvent {
  ctaId: string;
}

export interface IntegrityLinkSourceEvent extends IntegrityPageViewEvent {
  linkSource: 'leaderboard' | 'proof' | 'replay' | 'season';
}
