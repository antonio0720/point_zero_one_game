// /pzo_server/src/multiplayer/mechanics/m092.ts
// M092 — Ghost Mentor Theater: Watch + Copy Decision Ghosts
// tslint:disable:no-any

import { createHash, createHmac } from 'crypto';

export interface GhostDecision {
  ghostId: string;            // anonymized reference to source player
  tick: number;
  action: string;             // e.g. 'BUY_8PLEX', 'PASS', 'REFI'
  cashAtDecision: number;
  incomeAtDecision: number;
  outcomeAfter: 'win_path' | 'wipe_path' | 'neutral';
  runSeed: string;
  rulesetHash: string;
}

export interface GhostCopyProposal {
  applicabilityScore: number;         // [0..1]
  recommendation: string;
  warningFlags: string[];
  receiptHash: string;
}

export class M92GhostMentorTheaterWatchCopyDecisionGhosts {
  private mlEnabled = false;
  private readonly signingSecret: string;
  private auditHash = '';

  constructor(signingSecret: string = 'pzo_ghost_mentor_secret') {
    this.signingSecret = signingSecret;
  }

  public enableML(): void { this.mlEnabled = true; }
  public disableML(): void { this.mlEnabled = false; }

  /**
   * Evaluates whether a ghost's decision is applicable to the current player's situation.
   * Returns an applicability score + recommendation.
   */
  public watchCopyDecisionGhosts(
    player: { playerId: string; cash: number; passiveIncome: number; monthlyExpenses: number; currentTick: number },
    ghost: GhostDecision,
    currentRulesetHash: string,
    currentSeed: string,
  ): { success: boolean; proposal?: GhostCopyProposal; message: string } {
    // Rule 1: Rulesets must match for ghost decisions to be comparable
    if (ghost.rulesetHash !== currentRulesetHash) {
      return {
        success: false,
        message: `Ghost decision from incompatible ruleset (${ghost.rulesetHash.slice(0, 8)}…). Not applicable.`,
      };
    }

    const mlOutput = this.mlEnabled
      ? this._mlApplicabilityScore(player, ghost)
      : this._deterministicApplicabilityScore(player, ghost);

    const boundedScore = this._clamp01(mlOutput);

    if (boundedScore < 0.2) {
      return {
        success: false,
        message: `Ghost decision has low applicability (${(boundedScore * 100).toFixed(0)}%). Skipping.`,
      };
    }

    const warnings = this._buildWarnings(player, ghost);
    const receiptHash = this._buildReceiptHash(player.playerId, ghost.ghostId, player.currentTick);

    this.auditHash = createHmac('sha256', this.signingSecret)
      .update(`${player.playerId}:${ghost.ghostId}:${boundedScore}:${receiptHash}`)
      .digest('hex');

    const proposal: GhostCopyProposal = {
      applicabilityScore: boundedScore,
      recommendation: this._buildRecommendation(ghost, boundedScore),
      warningFlags: warnings,
      receiptHash,
    };

    return { success: true, proposal, message: 'Ghost decision evaluated successfully' };
  }

  public getAuditHash(): string {
    return this.auditHash;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _mlApplicabilityScore(
    player: { cash: number; passiveIncome: number; monthlyExpenses: number },
    ghost: GhostDecision,
  ): number {
    // Financial profile similarity: normalized Euclidean distance
    const cashSim = 1 - Math.min(Math.abs(player.cash - ghost.cashAtDecision) / 50_000, 1);
    const incomeSim = 1 - Math.min(Math.abs(player.passiveIncome - ghost.incomeAtDecision) / 10_000, 1);
    const outcomeBias = ghost.outcomeAfter === 'win_path' ? 0.3 : ghost.outcomeAfter === 'wipe_path' ? -0.2 : 0;

    return this._clamp01(cashSim * 0.4 + incomeSim * 0.3 + 0.3 + outcomeBias);
  }

  private _deterministicApplicabilityScore(
    player: { cash: number; passiveIncome: number; monthlyExpenses: number },
    ghost: GhostDecision,
  ): number {
    // Simpler rule: same wealth band + positive outcome
    const wealthBandMatch =
      Math.abs(player.cash - ghost.cashAtDecision) < 10_000 &&
      Math.abs(player.passiveIncome - ghost.incomeAtDecision) < 2_000;
    const positiveOutcome = ghost.outcomeAfter === 'win_path';

    if (wealthBandMatch && positiveOutcome) return 0.8;
    if (wealthBandMatch) return 0.5;
    if (positiveOutcome) return 0.4;
    return 0.2;
  }

  private _buildWarnings(
    player: { monthlyExpenses: number; cash: number },
    ghost: GhostDecision,
  ): string[] {
    const flags: string[] = [];
    if (ghost.outcomeAfter === 'wipe_path') {
      flags.push('WARNING: Ghost took this action on a wipe-path run. High risk.');
    }
    if (player.cash < player.monthlyExpenses * 2) {
      flags.push('WARNING: Your cash buffer is below 2× monthly expenses. Exercise caution.');
    }
    return flags;
  }

  private _buildRecommendation(ghost: GhostDecision, score: number): string {
    const confidence = score >= 0.7 ? 'high' : score >= 0.4 ? 'moderate' : 'low';
    return `Ghost action: "${ghost.action}" at tick ${ghost.tick}. Applicability confidence: ${confidence} (${(score * 100).toFixed(0)}%). ` +
      `Outcome in source run: ${ghost.outcomeAfter.replace('_', ' ')}.`;
  }

  private _buildReceiptHash(playerId: string, ghostId: string, tick: number): string {
    return createHash('sha256')
      .update(`${playerId}:${ghostId}:${tick}`)
      .digest('hex')
      .slice(0, 32);
  }

  private _clamp01(v: number): number {
    return Math.min(Math.max(v, 0), 1);
  }
}
