// tslint:disable:no-any strict-type-checking no-object-literal-keys-are-number

import { M64aConfig } from './M64a_config';
import { LeaderboardTrustReverifySchedulerProofWeighted } from './LeaderboardTrustReverifySchedulerProofWeighted';

export class M64a {
  private config: M64aConfig;
  private leaderboardTrustReverifySchedulerProofWeighted: LeaderboardTrustReverifySchedulerProofWeighted;

  constructor(config: M64aConfig) {
    this.config = config;
    this.leaderboardTrustReverifySchedulerProofWeighted = new LeaderboardTrustReverifySchedulerProofWeighted();
  }

  public getAuditHash(): string {
    return this.leaderboardTrustReverifySchedulerProofWeighted.getAuditHash(this.config);
  }

  public isMLEnabled(): boolean {
    return this.config.ml_enabled;
  }

  public scheduleNudge(playerId: number, nudgeAmount: number): [number, number] | null {
    if (!this.isMLEnabled()) {
      return null;
    }
    const boundedNudge = Math.min(Math.max(nudgeAmount, 0), 1);
    const scheduledNudge = this.leaderboardTrustReverifySchedulerProofWeighted.scheduleNudge(playerId, boundedNudge);
    return scheduledNudge;
  }

  public getRanking(): number[] {
    if (!this.isMLEnabled()) {
      return [];
    }
    const ranking = this.leaderboardTrustReverifySchedulerProofWeighted.getRanking(this.config);
    return ranking;
  }
}

export class M64aConfig {
  ml_enabled: boolean;
  audit_hash: string;

  constructor(config?: { [key: string]: any }) {
    if (config) {
      Object.assign(this, config);
    }
  }
}
