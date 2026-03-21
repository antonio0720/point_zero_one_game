/**
 * ============================================================================
 * POINT ZERO ONE — SHARED CHAT PLAYER MODEL CONTRACTS
 * FILE: shared/contracts/chat/player-model.ts
 * VERSION: 2026.03.17-phase4
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 */

export type ChatPlayerModelAxis =
  | 'IMPULSIVE'
  | 'PATIENT'
  | 'GREEDY'
  | 'DEFENSIVE'
  | 'BLUFF_HEAVY'
  | 'LITERAL'
  | 'COMEBACK_PRONE'
  | 'COLLAPSE_PRONE'
  | 'PUBLIC_PERFORMER'
  | 'SILENT_OPERATOR'
  | 'PROCEDURE_AWARE'
  | 'CARELESS'
  | 'NOVELTY_SEEKING'
  | 'STABILITY_SEEKING'
  | 'RESCUE_RELIANT';

export interface ChatPlayerModelVector {
  readonly impulsive01: number;
  readonly patient01: number;
  readonly greedy01: number;
  readonly defensive01: number;
  readonly bluffHeavy01: number;
  readonly literal01: number;
  readonly comebackProne01: number;
  readonly collapseProne01: number;
  readonly publicPerformer01: number;
  readonly silentOperator01: number;
  readonly procedureAware01: number;
  readonly careless01: number;
  readonly noveltySeeking01: number;
  readonly stabilitySeeking01: number;
  readonly rescueReliant01: number;
}

export interface ChatPlayerModelEvidence {
  readonly evidenceId: string;
  readonly source: 'TRANSCRIPT' | 'MEMORY' | 'NOVELTY' | 'RELATIONSHIP' | 'SCENE';
  readonly summary: string;
  readonly axes: readonly ChatPlayerModelAxis[];
  readonly weight01: number;
  readonly createdAt: number;
}

export interface ChatPlayerModelSnapshot {
  readonly profileId: string;
  readonly playerId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly vector: ChatPlayerModelVector;
  readonly dominantAxes: readonly ChatPlayerModelAxis[];
  readonly evidenceTail: readonly ChatPlayerModelEvidence[];
  readonly notes: readonly string[];
}
