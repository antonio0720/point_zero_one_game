// shared/contracts/pzo/h2h-match.ts

export type MatchStatus = 'WAITING' | 'ACTIVE' | 'COMPLETE' | 'ABANDONED';
export type MatchOutcome = 'PLAYER_A_WIN' | 'PLAYER_B_WIN' | 'DRAW' | 'ABANDONED';

export interface H2HMatchRecord {
  matchId: string;
  playerAId: string;
  playerBId: string;
  seed: number;
  status: MatchStatus;
  outcome: MatchOutcome | null;
  startedAt: number;
  completedAt: number | null;
  totalTicks: number;
  finalScores: { playerA: number; playerB: number } | null;
}

export interface H2HMatchCreateRequest {
  challengerUserId: string;
  opponentUserId?: string;   // null = matchmake
  seed?: number;
}

export interface H2HMatchJoinRequest {
  matchId: string;
  userId: string;
}

export interface H2HStatePatch {
  matchId: string;
  tick: number;
  playerId: string;
  cash: number;
  income: number;
  netWorth: number;
  shields: number;
  battleScore: number;
  bbCurrent: number;
}
