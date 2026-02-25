// pzo-server/src/modules/h2h/h2h-match.service.ts
// Sprint 4 — H2H Match Service

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface MatchRecord {
  matchId: string;
  playerAId: string;
  playerBId: string | null;
  seed: number;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETE' | 'ABANDONED';
  outcome: string | null;
  startedAt: number;
  completedAt: number | null;
  totalTicks: number;
  finalScores: { playerA: number; playerB: number } | null;
}

@Injectable()
export class H2HMatchService {
  // In-memory store — replace with DB in Sprint 7
  private matches = new Map<string, MatchRecord>();

  async createMatch(challengerId: string, seed: number): Promise<MatchRecord> {
    const matchId = uuidv4();
    const record: MatchRecord = {
      matchId, playerAId: challengerId, playerBId: null,
      seed, status: 'WAITING', outcome: null,
      startedAt: Date.now(), completedAt: null,
      totalTicks: 0, finalScores: null,
    };
    this.matches.set(matchId, record);
    return record;
  }

  async joinMatch(matchId: string, playerId: string): Promise<MatchRecord | null> {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'WAITING') return null;
    const updated = { ...match, playerBId: playerId, status: 'ACTIVE' as const };
    this.matches.set(matchId, updated);
    return updated;
  }

  async getMatch(matchId: string): Promise<MatchRecord | null> {
    return this.matches.get(matchId) ?? null;
  }

  async completeMatch(
    matchId: string,
    outcome: string,
    totalTicks: number,
    finalScores: { playerA: number; playerB: number },
  ): Promise<MatchRecord | null> {
    const match = this.matches.get(matchId);
    if (!match) return null;
    const updated = {
      ...match, status: 'COMPLETE' as const, outcome, totalTicks,
      finalScores, completedAt: Date.now(),
    };
    this.matches.set(matchId, updated);
    return updated;
  }

  async abandonMatch(matchId: string): Promise<void> {
    const match = this.matches.get(matchId);
    if (match) this.matches.set(matchId, { ...match, status: 'ABANDONED', completedAt: Date.now() });
  }
}
