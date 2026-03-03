/**
 * TrustSimulator — src/ml/TrustSimulator.ts
 * Point Zero One · Density6 LLC · Confidential
 *
 * Upgrade #6: GNN-lite Trust Simulator for Syndicate mode
 *
 * Models trust dynamics between Syndicate members based on
 * interaction history. Predicts defection probability and
 * generates explainable Trust Audits.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type InteractionType =
  | 'AID_CONTRACT_SIGNED'
  | 'AID_CONTRACT_FULFILLED'
  | 'AID_CONTRACT_BREACHED'
  | 'RESCUE_CONTRIBUTED'
  | 'RESCUE_IGNORED'
  | 'LOAN_REPAID'
  | 'LOAN_DEFAULTED'
  | 'CASCADE_ABSORBED'
  | 'TREASURY_DRAINED';

export interface TeamInteraction {
  tick:            number;
  fromPlayerId:    string;
  toPlayerId:      string;
  type:            InteractionType;
  value:           number;         // monetary value of the interaction
}

export interface PlayerTrustNode {
  playerId:        string;
  trustScore:      number;         // 0–1
  defectionRisk:   number;         // 0–1
  contributionNet: number;         // lifetime positive - negative contributions
  interactions:    TeamInteraction[];
}

export interface TrustAuditEntry {
  tick:      number;
  action:    string;
  impact:    'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  delta:     number;              // trust delta from this action
}

export interface TrustAudit {
  playerId:        string;
  finalTrust:      number;
  defectionRisk:   number;
  topPositives:    TrustAuditEntry[];
  topNegatives:    TrustAuditEntry[];
  verdict:         string;
  recommendation:  string;
}

// ─── Trust Weights ────────────────────────────────────────────────────────────

const TRUST_WEIGHTS: Record<InteractionType, number> = {
  AID_CONTRACT_FULFILLED: +0.12,
  RESCUE_CONTRIBUTED:     +0.10,
  LOAN_REPAID:            +0.08,
  CASCADE_ABSORBED:       +0.06,
  AID_CONTRACT_SIGNED:    +0.02,
  AID_CONTRACT_BREACHED:  -0.20,
  LOAN_DEFAULTED:         -0.18,
  TREASURY_DRAINED:       -0.25,
  RESCUE_IGNORED:         -0.12,
};

const TRUST_DECAY_PER_TICK = 0.0005; // slow passive decay without interaction

// ─── Trust Simulator ──────────────────────────────────────────────────────────

export class TrustSimulator {
  private nodes = new Map<string, PlayerTrustNode>();

  private getOrCreate(playerId: string): PlayerTrustNode {
    if (!this.nodes.has(playerId)) {
      this.nodes.set(playerId, {
        playerId,
        trustScore:      0.5,
        defectionRisk:   0.2,
        contributionNet: 0,
        interactions:    [],
      });
    }
    return this.nodes.get(playerId)!;
  }

  record(interaction: TeamInteraction): void {
    const node  = this.getOrCreate(interaction.fromPlayerId);
    const delta = TRUST_WEIGHTS[interaction.type] ?? 0;

    node.trustScore      = Math.max(0, Math.min(1, node.trustScore + delta));
    node.contributionNet += interaction.value * (delta > 0 ? 1 : -1);
    node.interactions.push(interaction);

    // Update defection risk: high value + low trust = high risk
    this.recalcDefectionRisk(node);
  }

  applyDecay(currentTick: number, lastInteractionTick: number): void {
    const tickGap = currentTick - lastInteractionTick;
    for (const node of this.nodes.values()) {
      if (tickGap > 60) {
        node.trustScore = Math.max(0.1, node.trustScore - TRUST_DECAY_PER_TICK * tickGap);
        this.recalcDefectionRisk(node);
      }
    }
  }

  private recalcDefectionRisk(node: PlayerTrustNode): void {
    // Higher defection risk when:
    //   - low trust score
    //   - negative contribution net
    //   - recent breach/drain events
    const recentBad = node.interactions
      .slice(-10)
      .filter(i =>
        i.type === 'TREASURY_DRAINED' ||
        i.type === 'AID_CONTRACT_BREACHED' ||
        i.type === 'LOAN_DEFAULTED',
      ).length;

    const contribScore = Math.max(0, Math.min(1,
      0.5 + node.contributionNet / 100_000,
    ));

    node.defectionRisk = Math.max(0, Math.min(1,
      (1 - node.trustScore) * 0.5 +
      (1 - contribScore) * 0.3 +
      (recentBad / 10) * 0.2,
    ));
  }

  predictDefection(playerId: string): number {
    return this.getOrCreate(playerId).defectionRisk;
  }

  /** Recommend optimal rescue allocation among players */
  recommendRescueAllocation(
    budget: number,
    playerIds: string[],
  ): Array<{ playerId: string; allocation: number; priority: string }> {
    const nodes = playerIds.map(id => this.getOrCreate(id));

    // Sort by trust (high trust = efficient use of rescue funds)
    const sorted = nodes.sort((a, b) => b.trustScore - a.trustScore);
    const totalTrust = sorted.reduce((s, n) => s + n.trustScore, 0);

    return sorted.map(n => ({
      playerId:   n.playerId,
      allocation: Math.round((n.trustScore / Math.max(0.01, totalTrust)) * budget),
      priority:   n.trustScore > 0.7 ? 'HIGH' : n.trustScore > 0.4 ? 'MEDIUM' : 'LOW',
    }));
  }

  generateAudit(playerId: string): TrustAudit {
    const node = this.getOrCreate(playerId);

    const entries: TrustAuditEntry[] = node.interactions.map(i => ({
      tick:   i.tick,
      action: `${i.type} (${i.value > 0 ? '+' : ''}$${Math.round(i.value).toLocaleString()})`,
      impact: (TRUST_WEIGHTS[i.type] ?? 0) > 0 ? 'POSITIVE' :
              (TRUST_WEIGHTS[i.type] ?? 0) < 0 ? 'NEGATIVE' : 'NEUTRAL',
      delta:  TRUST_WEIGHTS[i.type] ?? 0,
    }));

    const positives = entries.filter(e => e.impact === 'POSITIVE')
      .sort((a, b) => b.delta - a.delta).slice(0, 3);
    const negatives = entries.filter(e => e.impact === 'NEGATIVE')
      .sort((a, b) => a.delta - b.delta).slice(0, 3);

    const verdict = node.trustScore > 0.7
      ? 'Reliable ally — consistent contributions and zero breaches.'
      : node.trustScore > 0.4
      ? 'Mixed record — some reliability but inconsistent under pressure.'
      : 'High defection risk — history of breached contracts or treasury drains.';

    const recommendation = node.defectionRisk > 0.6
      ? 'Do not allocate large rescue funds. Monitor closely.'
      : node.defectionRisk > 0.3
      ? 'Proceed with caution. Small allocations only.'
      : 'Safe to allocate full rescue budget.';

    return {
      playerId,
      finalTrust:    node.trustScore,
      defectionRisk: node.defectionRisk,
      topPositives:  positives,
      topNegatives:  negatives,
      verdict,
      recommendation,
    };
  }
}