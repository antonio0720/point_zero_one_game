// tslint:disable:no-any strict-type-checking

import { M64ProofWeightedLeaderboard } from './m064_proof_weighted_leaderboard';
import { VerifiedRun } from '../verified_run';
import { ProofWeightedLeaderboardConfig } from './proof_weighted_leaderboard_config';
import { LeaderboardEntry } from '../leaderboard_entry';

export class M64VerifiedRunsOnlyMechanic {
  private readonly proofWeightedLeaderboards: Map<string, M64ProofWeightedLeaderboard>;

  constructor() {
    this.proofWeightedLeaderboards = new Map();
  }

  public async init(): Promise<void> {
    const config = await ProofWeightedLeaderboardConfig.load('m064_verified_runs_only');
    for (const [leaderboardId, leaderboardConfig] of Object.entries(config)) {
      const proofWeightedLeaderboard = new M64ProofWeightedLeaderboard(leaderboardId);
      this.proofWeightedLeaderboards.set(leaderboardId, proofWeightedLeaderboard);
    }
  }

  public async updateVerifiedRun(verifiedRun: VerifiedRun): Promise<void> {
    if (this.proofWeightedLeaderboards.has(verifiedRun.leaderboardId)) {
      const leaderboard = this.proofWeightedLeaderboards.get(verifiedRun.leaderboardId);
      await leaderboard.updateEntry(verifiedRun);
    }
  }

  public async getLeaderboardEntries(): Promise<LeaderboardEntry[]> {
    const entries: LeaderboardEntry[] = [];
    for (const leaderboard of this.proofWeightedLeaderboards.values()) {
      const leaderboardEntries = await leaderboard.getEntries();
      entries.push(...leaderboardEntries);
    }
    return entries;
  }

  public async getAuditHash(): Promise<string> {
    let auditHash = '';
    for (const leaderboard of this.proofWeightedLeaderboards.values()) {
      const leaderboardAuditHash = await leaderboard.getAuditHash();
      auditHash += leaderboardAuditHash;
    }
    return auditHash;
  }

  public isMlEnabled(): boolean {
    return false; // M64VerifiedRunsOnlyMechanic does not use ML models
  }

  public async getBoundedOutput(): Promise<number> {
    const entries = await this.getLeaderboardEntries();
    if (entries.length > 0) {
      return Math.min(...entries.map((entry) => entry.score));
    } else {
      return 1;
    }
  }
}
