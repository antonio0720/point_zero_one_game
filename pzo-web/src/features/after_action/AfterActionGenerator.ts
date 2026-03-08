/**
 * POINT ZERO ONE — AFTER ACTION GENERATOR
 * pzo-web/src/features/after_action/AfterActionGenerator.ts
 *
 * Repo-native post-wipe classifier and recommendation engine.
 *
 * PURPOSE
 * - Converts a collapse/wipe into:
 *   1) cause-of-death artifact data
 *   2) one practice-only fork recommendation
 *   3) one targeted training scenario recommendation
 *   4) one tiny action + one medium action
 *
 * DESIGN LAW
 * - Fast, deterministic, rule-based.
 * - No preachy advice.
 * - Output is UI-ready and mode-aware.
 * - Uses existing card-engine telemetry patterns (DecisionRecord / mode / phase).
 */

import { GameMode, RunPhase } from '../../engines/cards/types';
import type { DecisionRecord } from '../../engines/cards/types';

export enum FailureMode {
  CASHFLOW_COLLAPSE = 'cashflow_collapse',
  CREDIT_FREEZE_SPIRAL = 'credit_freeze_spiral',
  FORCED_LIQUIDATION = 'forced_liquidation',
  FUBAR_CASCADE = 'fubar_cascade',
  DEBT_SERVICE_BREAK = 'debt_service_break',
  MISSED_OPPORTUNITY = 'missed_opportunity',
  MACRO_SHOCK_FAILURE = 'macro_shock_failure',
  TRUST_BREAKDOWN = 'trust_breakdown',
  GHOST_DIVERGENCE = 'ghost_divergence',
}

export enum StrengthMode {
  TINY = 'tiny',
  MEDIUM = 'medium',
}

export enum VerificationState {
  PENDING = 'pending',
  VERIFIED = 'verified',
  PRACTICE_ONLY = 'practice_only',
}

export interface RecentDelta {
  readonly label: string;
  readonly amount: number;
}

export interface AfterActionDecisionRecord extends DecisionRecord {
  readonly tickIndex: number;
}

export interface TinyAction {
  readonly id: string;
  readonly description: string;
  readonly chipLabel: string;
}

export interface MediumAction {
  readonly id: string;
  readonly description: string;
  readonly chipLabel: string;
  readonly scenarioKey: string;
  readonly scenarioName: string;
}

export interface CauseOfDeathCard {
  readonly deathName: string;
  readonly triggerSentence: string;
  readonly verificationState: VerificationState;
  readonly receipts: {
    readonly cash: number;
    readonly burn: number;
    readonly largestHit: number;
  };
  readonly ledgerStrip: readonly RecentDelta[];
}

export interface PracticeForkRecommendation {
  readonly forkFromTick: number;
  readonly collapseTick: number;
  readonly practiceOnly: true;
  readonly turningPointLine: string;
  readonly replaySuggestion: string;
}

export interface TrainingRecommendation {
  readonly failureSignature: string;
  readonly scenarioKey: string;
  readonly scenarioName: string;
  readonly chips: readonly string[];
}

export interface AfterAction {
  readonly id: string;
  readonly runId: string;
  readonly gameMode: GameMode;
  readonly phase: RunPhase;
  readonly failureMode: FailureMode;
  readonly strengthMode: StrengthMode;
  readonly causeOfDeath: CauseOfDeathCard;
  readonly practiceFork: PracticeForkRecommendation;
  readonly training: TrainingRecommendation;
  readonly replaySuggestion: string;
  readonly tinyAction: TinyAction;
  readonly mediumAction: MediumAction;
}

export interface AfterActionInput {
  readonly runId: string;
  readonly gameMode: GameMode;
  readonly phase?: RunPhase;
  readonly tickAtFailure: number;
  readonly verificationState?: VerificationState;

  readonly cashAtFailure: number;
  readonly burnAtFailure: number;
  readonly largestHit: number;

  readonly reserveMonths?: number;
  readonly debtServiceRatio?: number;
  readonly creditLineScore?: number;
  readonly opportunityPassCount?: number;
  readonly missedOpportunityStreak?: number;
  readonly cascadeChainsActive?: number;
  readonly fubarHitsRecent?: number;
  readonly macroShockActive?: boolean;
  readonly forcedLiquidation?: boolean;
  readonly assetMaintenanceOverdue?: boolean;
  readonly trustScore?: number;
  readonly divergenceGap?: number;

  readonly recentDeltas?: readonly RecentDelta[];
  readonly decisionRecords?: readonly AfterActionDecisionRecord[];
  readonly turningPointHint?: string;
}

interface FailureProfile {
  readonly failureMode: FailureMode;
  readonly failureSignature: string;
  readonly deathName: string;
  readonly triggerSentence: string;
  readonly scenarioKey: string;
  readonly scenarioName: string;
  readonly chips: readonly string[];
  readonly tinyAction: TinyAction;
  readonly mediumAction: MediumAction;
  readonly preferredStrengthMode: StrengthMode;
}

const FAILURE_PROFILES: Record<FailureMode, FailureProfile> = {
  [FailureMode.CASHFLOW_COLLAPSE]: {
    failureMode: FailureMode.CASHFLOW_COLLAPSE,
    failureSignature: 'No reserves + high burn',
    deathName: 'Cashflow Collapse',
    triggerSentence:
      'Negative net flow outran your buffer and recovery options closed.',
    scenarioKey: 'reserve_discipline',
    scenarioName: 'Reserve Discipline Drill',
    chips: ['Stabilize Burn', 'Build a Reserve Buffer', 'Recovery Under Pressure'],
    tinyAction: {
      id: 'tiny_reserve_buffer',
      description:
        'Stabilize burn first. The next run should prioritize survivability over upside.',
      chipLabel: 'Stabilize Burn',
    },
    mediumAction: {
      id: 'medium_reserve_discipline',
      description:
        'Queue the reserve discipline drill and practice surviving with tighter cash margins before chasing leverage.',
      chipLabel: 'Build a Reserve Buffer',
      scenarioKey: 'reserve_discipline',
      scenarioName: 'Reserve Discipline Drill',
    },
    preferredStrengthMode: StrengthMode.TINY,
  },

  [FailureMode.CREDIT_FREEZE_SPIRAL]: {
    failureMode: FailureMode.CREDIT_FREEZE_SPIRAL,
    failureSignature: 'Over-leverage under tight credit',
    deathName: 'Credit Freeze Spiral',
    triggerSentence:
      'Credit tightened before your position stabilized, so flexibility vanished.',
    scenarioKey: 'tight_credit_gauntlet',
    scenarioName: 'Tight Credit Gauntlet',
    chips: ['Leverage Control', 'Debt Ratio Control', 'Survive the Credit "No"'],
    tinyAction: {
      id: 'tiny_credit_control',
      description:
        'Delay leverage until the line is healthy enough to absorb a bad tick.',
      chipLabel: 'Leverage Control',
    },
    mediumAction: {
      id: 'medium_tight_credit',
      description:
        'Run the tight-credit scenario to train early stabilization before expansion.',
      chipLabel: 'Debt Ratio Control',
      scenarioKey: 'tight_credit_gauntlet',
      scenarioName: 'Tight Credit Gauntlet',
    },
    preferredStrengthMode: StrengthMode.MEDIUM,
  },

  [FailureMode.FORCED_LIQUIDATION]: {
    failureMode: FailureMode.FORCED_LIQUIDATION,
    failureSignature: 'Asset maintenance trap',
    deathName: 'Forced Liquidation',
    triggerSentence:
      'Maintenance or obligations forced a sale before the position could recover.',
    scenarioKey: 'liquidation_prevention',
    scenarioName: 'Liquidation Prevention',
    chips: ['Avoid Forced Liquidation', 'Reserve Discipline', 'Recovery Line'],
    tinyAction: {
      id: 'tiny_maintenance_awareness',
      description:
        'Respect maintenance burden. Assets that cannot survive bad timing are liabilities.',
      chipLabel: 'Avoid Forced Liquidation',
    },
    mediumAction: {
      id: 'medium_liquidation_prevention',
      description:
        'Queue the liquidation prevention drill and practice holding assets through pressure without a forced sell.',
      chipLabel: 'Liquidation Prevention',
      scenarioKey: 'liquidation_prevention',
      scenarioName: 'Liquidation Prevention',
    },
    preferredStrengthMode: StrengthMode.MEDIUM,
  },

  [FailureMode.FUBAR_CASCADE]: {
    failureMode: FailureMode.FUBAR_CASCADE,
    failureSignature: 'Shock chain exceeded stabilization threshold',
    deathName: 'FUBAR Cascade',
    triggerSentence:
      'A linked shock chain crossed the threshold before you contained it.',
    scenarioKey: 'cascade_containment',
    scenarioName: 'Cascade Containment',
    chips: ['Stop the Cascade', 'Shock Response', 'Recovery Under Pressure'],
    tinyAction: {
      id: 'tiny_cascade_interrupt',
      description:
        'Treat linked shocks as the real threat. Interrupt the chain, not just the first hit.',
      chipLabel: 'Stop the Cascade',
    },
    mediumAction: {
      id: 'medium_cascade_containment',
      description:
        'Run the cascade containment drill and practice catching the chain before it becomes unrecoverable.',
      chipLabel: 'Cascade Containment',
      scenarioKey: 'cascade_containment',
      scenarioName: 'Cascade Containment',
    },
    preferredStrengthMode: StrengthMode.MEDIUM,
  },

  [FailureMode.DEBT_SERVICE_BREAK]: {
    failureMode: FailureMode.DEBT_SERVICE_BREAK,
    failureSignature: 'Debt service blind spot',
    deathName: 'Debt Service Break',
    triggerSentence:
      'Debt service breached the safe range and locked you out of recovery lines.',
    scenarioKey: 'debt_ratio_control',
    scenarioName: 'Debt Ratio Control',
    chips: ['Debt Service Awareness', 'Debt Ratio Control', 'Leverage Timing'],
    tinyAction: {
      id: 'tiny_debt_awareness',
      description:
        'Watch debt service before opportunity size. Once the ratio breaks, your options collapse.',
      chipLabel: 'Debt Service Awareness',
    },
    mediumAction: {
      id: 'medium_debt_ratio_control',
      description:
        'Queue the debt ratio control drill and rehearse exiting leverage before it becomes the run.',
      chipLabel: 'Debt Ratio Control',
      scenarioKey: 'debt_ratio_control',
      scenarioName: 'Debt Ratio Control',
    },
    preferredStrengthMode: StrengthMode.MEDIUM,
  },

  [FailureMode.MISSED_OPPORTUNITY]: {
    failureMode: FailureMode.MISSED_OPPORTUNITY,
    failureSignature: 'Pass-pattern under opportunity pressure',
    deathName: 'Missed Opportunity Drag',
    triggerSentence:
      'Repeated passes cost tempo, then the board closed before you rebuilt momentum.',
    scenarioKey: 'opportunity_ev_lab',
    scenarioName: 'Opportunity EV Lab',
    chips: ['Opportunity Selection', 'Timing Discipline', 'Learn to Pass'],
    tinyAction: {
      id: 'tiny_opportunity_selection',
      description:
        'Differentiate between a disciplined pass and a fear-based pass. Tempo matters.',
      chipLabel: 'Opportunity Selection',
    },
    mediumAction: {
      id: 'medium_opportunity_ev',
      description:
        'Run the opportunity EV lab and practice when to commit, when to hold, and when to let the card go.',
      chipLabel: 'Timing Discipline',
      scenarioKey: 'opportunity_ev_lab',
      scenarioName: 'Opportunity EV Lab',
    },
    preferredStrengthMode: StrengthMode.TINY,
  },

  [FailureMode.MACRO_SHOCK_FAILURE]: {
    failureMode: FailureMode.MACRO_SHOCK_FAILURE,
    failureSignature: 'Late reaction to macro regime shift',
    deathName: 'Macro Shock Failure',
    triggerSentence:
      'The regime changed and your line stayed anchored to a dead assumption.',
    scenarioKey: 'macro_shock_survival',
    scenarioName: 'Macro Shock Survival',
    chips: ['Macro Shock Survival', 'Reserve Discipline', 'Recovery Under Pressure'],
    tinyAction: {
      id: 'tiny_macro_read',
      description:
        'Respect the regime shift earlier. When the environment changes, your old line loses EV.',
      chipLabel: 'Macro Shock Survival',
    },
    mediumAction: {
      id: 'medium_macro_shock',
      description:
        'Queue the macro shock survival drill and train earlier adaptation under the same pressure curve.',
      chipLabel: 'Macro Read',
      scenarioKey: 'macro_shock_survival',
      scenarioName: 'Macro Shock Survival',
    },
    preferredStrengthMode: StrengthMode.MEDIUM,
  },

  [FailureMode.TRUST_BREAKDOWN]: {
    failureMode: FailureMode.TRUST_BREAKDOWN,
    failureSignature: 'Trust breakdown under team pressure',
    deathName: 'Trust Breakdown',
    triggerSentence:
      'The team economy lost cohesion before recovery terms could hold.',
    scenarioKey: 'trust_audit',
    scenarioName: 'Trust Audit',
    chips: ['Trust Audit', 'Recovery Under Pressure', 'Debt Service Awareness'],
    tinyAction: {
      id: 'tiny_trust_stabilization',
      description:
        'Repair the team line before extending more obligation. Broken trust makes every rescue expensive.',
      chipLabel: 'Trust Audit',
    },
    mediumAction: {
      id: 'medium_trust_audit',
      description:
        'Run the trust audit scenario and practice resource transfer under fragile team conditions.',
      chipLabel: 'Trust Audit',
      scenarioKey: 'trust_audit',
      scenarioName: 'Trust Audit',
    },
    preferredStrengthMode: StrengthMode.MEDIUM,
  },

  [FailureMode.GHOST_DIVERGENCE]: {
    failureMode: FailureMode.GHOST_DIVERGENCE,
    failureSignature: 'Lost the timing war against the legend',
    deathName: 'Ghost Divergence',
    triggerSentence:
      'Your line drifted from the high-value timing windows that defined the race.',
    scenarioKey: 'recovery_line',
    scenarioName: 'Recovery Line',
    chips: ['Timing Discipline', 'Recovery Line', 'Precision Hold'],
    tinyAction: {
      id: 'tiny_precision_timing',
      description:
        'The issue was not only the card. It was the window. Beat the timing, not just the effect.',
      chipLabel: 'Timing Discipline',
    },
    mediumAction: {
      id: 'medium_recovery_line',
      description:
        'Queue the recovery line drill and replay the benchmark windows until the pattern is clean.',
      chipLabel: 'Recovery Line',
      scenarioKey: 'recovery_line',
      scenarioName: 'Recovery Line',
    },
    preferredStrengthMode: StrengthMode.MEDIUM,
  },
};

export class AfterActionGenerator {
  public generate(input: AfterActionInput): AfterAction {
    const profile = this.classify(input);
    const phase = input.phase ?? RunPhase.ESCALATION;
    const verificationState =
      input.verificationState ?? VerificationState.PENDING;
    const turningPoint = this.resolveTurningPoint(input, profile.failureMode);
    const ledgerStrip = this.buildLedgerStrip(input);

    const causeOfDeath: CauseOfDeathCard = {
      deathName: profile.deathName,
      triggerSentence: profile.triggerSentence,
      verificationState,
      receipts: {
        cash: input.cashAtFailure,
        burn: input.burnAtFailure,
        largestHit: input.largestHit,
      },
      ledgerStrip,
    };

    const practiceFork: PracticeForkRecommendation = {
      forkFromTick: Math.max(0, turningPoint.tickIndex - 3),
      collapseTick: input.tickAtFailure,
      practiceOnly: true,
      turningPointLine: turningPoint.line,
      replaySuggestion: `Fork from Tick ${Math.max(
        0,
        turningPoint.tickIndex - 3,
      )}. Identical conditions. Choose a better line.`,
    };

    const training: TrainingRecommendation = {
      failureSignature: profile.failureSignature,
      scenarioKey: profile.scenarioKey,
      scenarioName: profile.scenarioName,
      chips: profile.chips,
    };

    return {
      id: `${input.runId}:${profile.failureMode}:${input.tickAtFailure}`,
      runId: input.runId,
      gameMode: input.gameMode,
      phase,
      failureMode: profile.failureMode,
      strengthMode: profile.preferredStrengthMode,
      causeOfDeath,
      practiceFork,
      training,
      replaySuggestion: practiceFork.replaySuggestion,
      tinyAction: profile.tinyAction,
      mediumAction: profile.mediumAction,
    };
  }

  private classify(input: AfterActionInput): FailureProfile {
    if (input.forcedLiquidation || input.assetMaintenanceOverdue) {
      return FAILURE_PROFILES[FailureMode.FORCED_LIQUIDATION];
    }

    if ((input.cascadeChainsActive ?? 0) >= 2 || (input.fubarHitsRecent ?? 0) >= 2) {
      return FAILURE_PROFILES[FailureMode.FUBAR_CASCADE];
    }

    if ((input.creditLineScore ?? 100) <= 20) {
      return FAILURE_PROFILES[FailureMode.CREDIT_FREEZE_SPIRAL];
    }

    if ((input.debtServiceRatio ?? 0) >= 0.45) {
      return FAILURE_PROFILES[FailureMode.DEBT_SERVICE_BREAK];
    }

    if (input.macroShockActive) {
      return FAILURE_PROFILES[FailureMode.MACRO_SHOCK_FAILURE];
    }

    if (
      input.gameMode === GameMode.TEAM_UP &&
      input.trustScore !== undefined &&
      input.trustScore < 40
    ) {
      return FAILURE_PROFILES[FailureMode.TRUST_BREAKDOWN];
    }

    if (
      input.gameMode === GameMode.CHASE_A_LEGEND &&
      input.divergenceGap !== undefined &&
      input.divergenceGap > 0.15
    ) {
      return FAILURE_PROFILES[FailureMode.GHOST_DIVERGENCE];
    }

    if (
      (input.missedOpportunityStreak ?? 0) >= 2 ||
      (input.opportunityPassCount ?? 0) >= 2
    ) {
      return FAILURE_PROFILES[FailureMode.MISSED_OPPORTUNITY];
    }

    return FAILURE_PROFILES[FailureMode.CASHFLOW_COLLAPSE];
  }

  private resolveTurningPoint(
    input: AfterActionInput,
    failureMode: FailureMode,
  ): { tickIndex: number; line: string } {
    const decisionRecords = input.decisionRecords ?? [];

    if (decisionRecords.length === 0) {
      return {
        tickIndex: Math.max(0, input.tickAtFailure - 3),
        line: input.turningPointHint ?? this.defaultTurningPointLine(failureMode),
      };
    }

    let best = decisionRecords[0];
    let bestScore = this.turningPointScore(best, input.tickAtFailure);

    for (const record of decisionRecords.slice(1)) {
      const score = this.turningPointScore(record, input.tickAtFailure);
      if (score > bestScore) {
        best = record;
        bestScore = score;
      }
    }

    return {
      tickIndex: best.tickIndex,
      line: this.buildTurningPointLine(failureMode, best, input),
    };
  }

  private turningPointScore(
    record: AfterActionDecisionRecord,
    collapseTick: number,
  ): number {
    const lowerCompositeIsWorse = 1 - this.clamp(record.compositeScore, 0, 1);
    const autoResolvePenalty = record.wasAutoResolved ? 0.75 : 0;
    const negativeCordPenalty =
      record.cordContribution < 0 ? Math.min(Math.abs(record.cordContribution), 1) : 0;
    const recencyWeight =
      collapseTick > 0
        ? 1 - Math.min(Math.abs(collapseTick - record.tickIndex) / collapseTick, 1)
        : 0;

    return lowerCompositeIsWorse * 2 + autoResolvePenalty + negativeCordPenalty + recencyWeight;
  }

  private buildTurningPointLine(
    failureMode: FailureMode,
    record: AfterActionDecisionRecord,
    input: AfterActionInput,
  ): string {
    switch (failureMode) {
      case FailureMode.CASHFLOW_COLLAPSE:
        return `Tick ${record.tickIndex} — burn was already unstable and the line still failed to prioritize liquidity.`;

      case FailureMode.CREDIT_FREEZE_SPIRAL:
        return `Tick ${record.tickIndex} — leverage stayed on while credit flexibility was already compromised.`;

      case FailureMode.FORCED_LIQUIDATION:
        return `Tick ${record.tickIndex} — the run committed to an asset line without enough maintenance cushion.`;

      case FailureMode.FUBAR_CASCADE:
        return `Tick ${record.tickIndex} — the chain was still live and the run chose reaction over containment.`;

      case FailureMode.DEBT_SERVICE_BREAK:
        return `Tick ${record.tickIndex} — debt load crossed the safe threshold before the board stabilized.`;

      case FailureMode.MISSED_OPPORTUNITY:
        return `Tick ${record.tickIndex} — another pass surrendered tempo while the board still offered recovery routes.`;

      case FailureMode.MACRO_SHOCK_FAILURE:
        return `Tick ${record.tickIndex} — the macro state had already shifted, but the line did not adapt.`;

      case FailureMode.TRUST_BREAKDOWN:
        return `Tick ${record.tickIndex} — team stability deteriorated before the transfer terms were repaired.`;

      case FailureMode.GHOST_DIVERGENCE:
        return `Tick ${record.tickIndex} — the timing window was missed and the ghost gained the gap.`;

      default:
        return input.turningPointHint ?? `Tick ${record.tickIndex} — the run crossed its point of no return here.`;
    }
  }

  private defaultTurningPointLine(failureMode: FailureMode): string {
    switch (failureMode) {
      case FailureMode.CASHFLOW_COLLAPSE:
        return 'Burn exceeded safe range after the reserve floor was already gone.';
      case FailureMode.CREDIT_FREEZE_SPIRAL:
        return 'Credit tightened before the position was stable enough to absorb it.';
      case FailureMode.FORCED_LIQUIDATION:
        return 'Maintenance burden forced the asset line into a bad exit.';
      case FailureMode.FUBAR_CASCADE:
        return 'The shock chain was allowed to compound instead of being contained.';
      case FailureMode.DEBT_SERVICE_BREAK:
        return 'Debt service ratio breached the recovery band and locked the run out.';
      case FailureMode.MISSED_OPPORTUNITY:
        return 'Repeated passes bled tempo until the board stopped offering recovery.';
      case FailureMode.MACRO_SHOCK_FAILURE:
        return 'The line reacted too late to a regime shift.';
      case FailureMode.TRUST_BREAKDOWN:
        return 'Team trust decayed before the run restored coordination.';
      case FailureMode.GHOST_DIVERGENCE:
        return 'The run drifted from the benchmark timing windows that mattered.';
      default:
        return 'The run crossed the threshold and could not recover.';
    }
  }

  private buildLedgerStrip(input: AfterActionInput): readonly RecentDelta[] {
    const deltas = input.recentDeltas ?? [];

    if (deltas.length >= 3) {
      return deltas.slice(-3);
    }

    const fallback: RecentDelta[] = [
      {
        label: 'Cash at failure',
        amount: input.cashAtFailure,
      },
      {
        label: 'Burn at failure',
        amount: -Math.abs(input.burnAtFailure),
      },
      {
        label: 'Largest hit',
        amount: -Math.abs(input.largestHit),
      },
    ];

    return fallback;
  }

  private clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
}