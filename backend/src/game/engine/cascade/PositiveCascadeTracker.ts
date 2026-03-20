
/*
 * POINT ZERO ONE — BACKEND POSITIVE CASCADE TRACKER
 * /backend/src/game/engine/cascade/PositiveCascadeTracker.ts
 *
 * Doctrine:
 * - positive cascades are earned from state, not random grants
 * - backend unlock logic must remain deterministic, additive, and snapshot-driven
 * - positive chains should be scarce, legible, and explainable under replay
 * - unlocks must respect mode doctrine rather than collapsing into one generic rule
 * - the tracker may grow richer internally, but infer(snapshot) remains the canonical surface
 */

import type {
  DecisionRecord,
  RunStateSnapshot,
} from '../core/RunStateSnapshot';
import type { CascadeTemplateId } from './types';

type PositiveCascadeId = Extract<CascadeTemplateId, 'MOMENTUM_ENGINE' | 'COMEBACK_SURGE'>;
type ModeCode = RunStateSnapshot['mode'];
type RunPhase = RunStateSnapshot['phase'];
type PressureTier = RunStateSnapshot['pressure']['tier'];

interface NumericBand {
  readonly min: number;
  readonly max: number;
}

interface MomentumThresholdProfile {
  readonly minScore: number;
  readonly minIncomeBuffer: number;
  readonly minCashBufferTicks: number;
  readonly minAvgShieldRatio: number;
  readonly minWeakestShieldRatio: number;
  readonly minNetWorthRatio: number;
  readonly maxHeat: number;
  readonly maxTension: number;
  readonly maxPendingAttacks: number;
  readonly maxNegativeActiveChains: number;
  readonly maxWarnings: number;
  readonly minDecisionAcceptanceRatio: number;
  readonly minDisciplineScore: number;
  readonly minNeutralizedBotRatio: number;
  readonly minTrustPeak?: number;
  readonly minTrustAverage?: number;
  readonly minBattleBudgetRatio?: number;
  readonly minSharedTreasuryBalance?: number;
  readonly requireLegendGapImprovement?: boolean;
  readonly requirePhaseWindows?: boolean;
}

interface ComebackThresholdProfile {
  readonly minScore: number;
  readonly stressLookbackTicks: number;
  readonly minStressEvidence: number;
  readonly minRecoveredAvgShieldRatio: number;
  readonly minRecoveredWeakestShieldRatio: number;
  readonly minCashBufferTicks: number;
  readonly maxHeatAfterRecovery: number;
  readonly maxPendingAttacks: number;
  readonly maxWarnings: number;
  readonly maxPressureTierNumeric: number;
  readonly minRecoverySignalScore: number;
  readonly minDisciplineScore: number;
  readonly minBrokenOrCompletedChains: number;
  readonly requireCurrentOrRecentHighPressure: boolean;
  readonly minTrustAverage?: number;
  readonly minSharedTreasuryBalance?: number;
  readonly minBattleBudgetRatio?: number;
  readonly minGapClosingRate?: number;
  readonly requireLegendMarkerContext?: boolean;
}

interface TemplateThresholdBook {
  readonly momentum: Readonly<Record<ModeCode, Readonly<Record<RunPhase, MomentumThresholdProfile>>>>;
  readonly comeback: Readonly<Record<ModeCode, Readonly<Record<RunPhase, ComebackThresholdProfile>>>>;
}

interface PositiveCascadeMetrics {
  readonly incomeBuffer: number;
  readonly cashBufferTicks: number;
  readonly expenseCoverageTicks: number;
  readonly avgShieldRatio: number;
  readonly weakestShieldRatio: number;
  readonly strongestShieldRatio: number;
  readonly stableShieldCount: number;
  readonly recoveredShieldCount: number;
  readonly breachedShieldCount: number;
  readonly heat: number;
  readonly heatNormalized: number;
  readonly tension: number;
  readonly pendingAttacks: number;
  readonly negativeActiveChains: number;
  readonly positiveActiveChains: number;
  readonly brokenChains: number;
  readonly completedChains: number;
  readonly warnings: number;
  readonly auditFlags: number;
  readonly emittedEvents: number;
  readonly decisionCount: number;
  readonly decisionAcceptanceRatio: number;
  readonly decisionLatencyScore: number;
  readonly disciplineScore: number;
  readonly trustPeak: number;
  readonly trustAverage: number;
  readonly trustSpread: number;
  readonly neutralizedBotRatio: number;
  readonly activeAggressorCount: number;
  readonly battleBudgetRatio: number;
  readonly sharedTreasuryBalance: number;
  readonly gapVsLegend: number;
  readonly gapClosingRate: number;
  readonly ghostMarkerCount: number;
  readonly netWorthRatio: number;
  readonly escalationRecencyTicks: number | null;
  readonly resolvedChainRecencyTicks: number | null;
  readonly highPressureEvidenceScore: number;
  readonly recoverySignalScore: number;
  readonly phaseWindowAvailable: boolean;
  readonly communityHeatModifier: number;
}

interface PositiveCascadeContext {
  readonly snapshot: RunStateSnapshot;
  readonly activePositiveIds: ReadonlySet<PositiveCascadeId>;
  readonly unlockedPositiveIds: ReadonlySet<PositiveCascadeId>;
  readonly activeNegativeTemplateIds: readonly string[];
  readonly metrics: PositiveCascadeMetrics;
}

interface GateEvaluation {
  readonly passed: boolean;
  readonly score: number;
  readonly weight: number;
  readonly summary: string;
  readonly detail: string;
}

interface TemplateEvaluation {
  readonly templateId: PositiveCascadeId;
  readonly eligible: boolean;
  readonly alreadyActive: boolean;
  readonly alreadyUnlocked: boolean;
  readonly hardGatePassed: boolean;
  readonly score: number;
  readonly threshold: number;
  readonly reasons: readonly string[];
  readonly gates: readonly GateEvaluation[];
  readonly summary: string;
}

export interface PositiveCascadeInferenceReport {
  readonly inferredIds: readonly PositiveCascadeId[];
  readonly templateEvaluations: readonly TemplateEvaluation[];
  readonly metrics: PositiveCascadeMetrics;
  readonly activePositiveIds: readonly PositiveCascadeId[];
  readonly unlockedPositiveIds: readonly PositiveCascadeId[];
}

const POSITIVE_TEMPLATE_ORDER: readonly PositiveCascadeId[] = [
  'MOMENTUM_ENGINE',
  'COMEBACK_SURGE',
] as const;

const PRESSURE_TIER_NUMERIC: Readonly<Record<PressureTier, number>> = {
  T0: 0,
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

const STABLE_SHIELD_RATIO = 0.75;
const RECOVERED_SHIELD_RATIO = 0.60;
const MOMENTUM_NEGATIVE_TEMPLATE_IDS = new Set<string>([
  'LIQUIDITY_SPIRAL',
  'CREDIT_FREEZE',
  'INCOME_SHOCK',
  'NETWORK_LOCKDOWN',
]);

const DEFAULT_TEMPLATE_THRESHOLD_BOOK: TemplateThresholdBook = {
  momentum: {
    solo: {
      FOUNDATION: {
        minScore: 0.71,
        minIncomeBuffer: 90,
        minCashBufferTicks: 2.75,
        minAvgShieldRatio: 0.77,
        minWeakestShieldRatio: 0.70,
        minNetWorthRatio: 0.12,
        maxHeat: 8,
        maxTension: 0.55,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.60,
        minDisciplineScore: 0.54,
        minNeutralizedBotRatio: 0.00,
        requirePhaseWindows: false,
      },
      ESCALATION: {
        minScore: 0.75,
        minIncomeBuffer: 110,
        minCashBufferTicks: 3.25,
        minAvgShieldRatio: 0.79,
        minWeakestShieldRatio: 0.72,
        minNetWorthRatio: 0.18,
        maxHeat: 8,
        maxTension: 0.50,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.64,
        minDisciplineScore: 0.58,
        minNeutralizedBotRatio: 0.00,
        requirePhaseWindows: false,
      },
      SOVEREIGNTY: {
        minScore: 0.79,
        minIncomeBuffer: 125,
        minCashBufferTicks: 3.75,
        minAvgShieldRatio: 0.82,
        minWeakestShieldRatio: 0.76,
        minNetWorthRatio: 0.24,
        maxHeat: 7,
        maxTension: 0.45,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.68,
        minDisciplineScore: 0.62,
        minNeutralizedBotRatio: 0.20,
        requirePhaseWindows: true,
      },
    },
    pvp: {
      FOUNDATION: {
        minScore: 0.72,
        minIncomeBuffer: 85,
        minCashBufferTicks: 2.50,
        minAvgShieldRatio: 0.75,
        minWeakestShieldRatio: 0.68,
        minNetWorthRatio: 0.10,
        maxHeat: 9,
        maxTension: 0.62,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.56,
        minDisciplineScore: 0.52,
        minNeutralizedBotRatio: 0.00,
        minBattleBudgetRatio: 0.30,
        requirePhaseWindows: false,
      },
      ESCALATION: {
        minScore: 0.76,
        minIncomeBuffer: 95,
        minCashBufferTicks: 2.90,
        minAvgShieldRatio: 0.77,
        minWeakestShieldRatio: 0.70,
        minNetWorthRatio: 0.14,
        maxHeat: 9,
        maxTension: 0.57,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.60,
        minDisciplineScore: 0.56,
        minNeutralizedBotRatio: 0.00,
        minBattleBudgetRatio: 0.35,
        requirePhaseWindows: false,
      },
      SOVEREIGNTY: {
        minScore: 0.80,
        minIncomeBuffer: 110,
        minCashBufferTicks: 3.35,
        minAvgShieldRatio: 0.80,
        minWeakestShieldRatio: 0.73,
        minNetWorthRatio: 0.20,
        maxHeat: 8,
        maxTension: 0.52,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.64,
        minDisciplineScore: 0.60,
        minNeutralizedBotRatio: 0.20,
        minBattleBudgetRatio: 0.40,
        requirePhaseWindows: true,
      },
    },
    coop: {
      FOUNDATION: {
        minScore: 0.74,
        minIncomeBuffer: 100,
        minCashBufferTicks: 2.80,
        minAvgShieldRatio: 0.78,
        minWeakestShieldRatio: 0.70,
        minNetWorthRatio: 0.10,
        maxHeat: 8,
        maxTension: 0.55,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.58,
        minDisciplineScore: 0.54,
        minNeutralizedBotRatio: 0.00,
        minTrustPeak: 68,
        minTrustAverage: 54,
        minSharedTreasuryBalance: 0,
        requirePhaseWindows: false,
      },
      ESCALATION: {
        minScore: 0.78,
        minIncomeBuffer: 115,
        minCashBufferTicks: 3.15,
        minAvgShieldRatio: 0.80,
        minWeakestShieldRatio: 0.73,
        minNetWorthRatio: 0.15,
        maxHeat: 8,
        maxTension: 0.50,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.62,
        minDisciplineScore: 0.58,
        minNeutralizedBotRatio: 0.00,
        minTrustPeak: 72,
        minTrustAverage: 58,
        minSharedTreasuryBalance: 200,
        requirePhaseWindows: false,
      },
      SOVEREIGNTY: {
        minScore: 0.82,
        minIncomeBuffer: 130,
        minCashBufferTicks: 3.60,
        minAvgShieldRatio: 0.83,
        minWeakestShieldRatio: 0.76,
        minNetWorthRatio: 0.20,
        maxHeat: 7,
        maxTension: 0.47,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.66,
        minDisciplineScore: 0.62,
        minNeutralizedBotRatio: 0.20,
        minTrustPeak: 76,
        minTrustAverage: 62,
        minSharedTreasuryBalance: 350,
        requirePhaseWindows: true,
      },
    },
    ghost: {
      FOUNDATION: {
        minScore: 0.75,
        minIncomeBuffer: 90,
        minCashBufferTicks: 2.70,
        minAvgShieldRatio: 0.78,
        minWeakestShieldRatio: 0.70,
        minNetWorthRatio: 0.10,
        maxHeat: 7,
        maxTension: 0.54,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.58,
        minDisciplineScore: 0.56,
        minNeutralizedBotRatio: 0.00,
        requireLegendGapImprovement: true,
        requirePhaseWindows: false,
      },
      ESCALATION: {
        minScore: 0.79,
        minIncomeBuffer: 105,
        minCashBufferTicks: 3.05,
        minAvgShieldRatio: 0.80,
        minWeakestShieldRatio: 0.73,
        minNetWorthRatio: 0.14,
        maxHeat: 7,
        maxTension: 0.50,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.62,
        minDisciplineScore: 0.60,
        minNeutralizedBotRatio: 0.10,
        requireLegendGapImprovement: true,
        requirePhaseWindows: false,
      },
      SOVEREIGNTY: {
        minScore: 0.83,
        minIncomeBuffer: 120,
        minCashBufferTicks: 3.40,
        minAvgShieldRatio: 0.83,
        minWeakestShieldRatio: 0.76,
        minNetWorthRatio: 0.18,
        maxHeat: 6,
        maxTension: 0.46,
        maxPendingAttacks: 1,
        maxNegativeActiveChains: 0,
        maxWarnings: 1,
        minDecisionAcceptanceRatio: 0.66,
        minDisciplineScore: 0.64,
        minNeutralizedBotRatio: 0.20,
        requireLegendGapImprovement: true,
        requirePhaseWindows: true,
      },
    },
  },
  comeback: {
    solo: {
      FOUNDATION: {
        minScore: 0.68,
        stressLookbackTicks: 6,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.62,
        minRecoveredWeakestShieldRatio: 0.55,
        minCashBufferTicks: 2.20,
        maxHeatAfterRecovery: 13,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.50,
        minDisciplineScore: 0.46,
        minBrokenOrCompletedChains: 0,
        requireCurrentOrRecentHighPressure: true,
      },
      ESCALATION: {
        minScore: 0.72,
        stressLookbackTicks: 7,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.64,
        minRecoveredWeakestShieldRatio: 0.57,
        minCashBufferTicks: 2.50,
        maxHeatAfterRecovery: 12,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.54,
        minDisciplineScore: 0.50,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
      },
      SOVEREIGNTY: {
        minScore: 0.76,
        stressLookbackTicks: 8,
        minStressEvidence: 3,
        minRecoveredAvgShieldRatio: 0.67,
        minRecoveredWeakestShieldRatio: 0.60,
        minCashBufferTicks: 2.90,
        maxHeatAfterRecovery: 11,
        maxPendingAttacks: 1,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.58,
        minDisciplineScore: 0.54,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
      },
    },
    pvp: {
      FOUNDATION: {
        minScore: 0.69,
        stressLookbackTicks: 6,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.61,
        minRecoveredWeakestShieldRatio: 0.54,
        minCashBufferTicks: 2.10,
        maxHeatAfterRecovery: 14,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.50,
        minDisciplineScore: 0.44,
        minBrokenOrCompletedChains: 0,
        requireCurrentOrRecentHighPressure: true,
        minBattleBudgetRatio: 0.25,
      },
      ESCALATION: {
        minScore: 0.73,
        stressLookbackTicks: 7,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.63,
        minRecoveredWeakestShieldRatio: 0.56,
        minCashBufferTicks: 2.35,
        maxHeatAfterRecovery: 13,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.54,
        minDisciplineScore: 0.48,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
        minBattleBudgetRatio: 0.30,
      },
      SOVEREIGNTY: {
        minScore: 0.78,
        stressLookbackTicks: 8,
        minStressEvidence: 3,
        minRecoveredAvgShieldRatio: 0.66,
        minRecoveredWeakestShieldRatio: 0.59,
        minCashBufferTicks: 2.75,
        maxHeatAfterRecovery: 12,
        maxPendingAttacks: 1,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.58,
        minDisciplineScore: 0.52,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
        minBattleBudgetRatio: 0.35,
      },
    },
    coop: {
      FOUNDATION: {
        minScore: 0.70,
        stressLookbackTicks: 6,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.62,
        minRecoveredWeakestShieldRatio: 0.55,
        minCashBufferTicks: 2.15,
        maxHeatAfterRecovery: 13,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.51,
        minDisciplineScore: 0.46,
        minBrokenOrCompletedChains: 0,
        requireCurrentOrRecentHighPressure: true,
        minTrustAverage: 42,
        minSharedTreasuryBalance: 0,
      },
      ESCALATION: {
        minScore: 0.75,
        stressLookbackTicks: 7,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.65,
        minRecoveredWeakestShieldRatio: 0.58,
        minCashBufferTicks: 2.45,
        maxHeatAfterRecovery: 12,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.56,
        minDisciplineScore: 0.50,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
        minTrustAverage: 48,
        minSharedTreasuryBalance: 150,
      },
      SOVEREIGNTY: {
        minScore: 0.79,
        stressLookbackTicks: 8,
        minStressEvidence: 3,
        minRecoveredAvgShieldRatio: 0.68,
        minRecoveredWeakestShieldRatio: 0.61,
        minCashBufferTicks: 2.85,
        maxHeatAfterRecovery: 11,
        maxPendingAttacks: 1,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.60,
        minDisciplineScore: 0.54,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
        minTrustAverage: 54,
        minSharedTreasuryBalance: 250,
      },
    },
    ghost: {
      FOUNDATION: {
        minScore: 0.71,
        stressLookbackTicks: 6,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.62,
        minRecoveredWeakestShieldRatio: 0.55,
        minCashBufferTicks: 2.15,
        maxHeatAfterRecovery: 12,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.52,
        minDisciplineScore: 0.48,
        minBrokenOrCompletedChains: 0,
        requireCurrentOrRecentHighPressure: true,
        minGapClosingRate: 0.00,
        requireLegendMarkerContext: false,
      },
      ESCALATION: {
        minScore: 0.76,
        stressLookbackTicks: 7,
        minStressEvidence: 2,
        minRecoveredAvgShieldRatio: 0.65,
        minRecoveredWeakestShieldRatio: 0.58,
        minCashBufferTicks: 2.50,
        maxHeatAfterRecovery: 11,
        maxPendingAttacks: 2,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.56,
        minDisciplineScore: 0.52,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
        minGapClosingRate: 0.00,
        requireLegendMarkerContext: false,
      },
      SOVEREIGNTY: {
        minScore: 0.81,
        stressLookbackTicks: 8,
        minStressEvidence: 3,
        minRecoveredAvgShieldRatio: 0.69,
        minRecoveredWeakestShieldRatio: 0.61,
        minCashBufferTicks: 2.95,
        maxHeatAfterRecovery: 10,
        maxPendingAttacks: 1,
        maxWarnings: 2,
        maxPressureTierNumeric: 3,
        minRecoverySignalScore: 0.61,
        minDisciplineScore: 0.56,
        minBrokenOrCompletedChains: 1,
        requireCurrentOrRecentHighPressure: true,
        minGapClosingRate: 0.01,
        requireLegendMarkerContext: true,
      },
    },
  },
};

export class PositiveCascadeTracker {
  private readonly thresholds: TemplateThresholdBook;

  constructor(thresholds: TemplateThresholdBook = DEFAULT_TEMPLATE_THRESHOLD_BOOK) {
    this.thresholds = thresholds;
  }

  /**
   * Canonical integration surface.
   * Returns only template ids and stays source-compatible with the existing backend engine.
   */
  public infer(snapshot: RunStateSnapshot): CascadeTemplateId[] {
    return [...this.inferDetailed(snapshot).inferredIds];
  }

  /**
   * Rich additive surface for testing, telemetry, replay analysis, and future chat/runtime narration.
   * Existing callers do not need this, but it keeps the tracker explainable.
   */
  public inferDetailed(snapshot: RunStateSnapshot): PositiveCascadeInferenceReport {
    const context = this.buildContext(snapshot);
    const templateEvaluations: TemplateEvaluation[] = POSITIVE_TEMPLATE_ORDER.map((templateId) =>
      this.evaluateTemplate(context, templateId),
    );

    const inferredIds = templateEvaluations
      .filter((evaluation) => evaluation.eligible)
      .map((evaluation) => evaluation.templateId);

    return {
      inferredIds,
      templateEvaluations,
      metrics: context.metrics,
      activePositiveIds: [...context.activePositiveIds],
      unlockedPositiveIds: [...context.unlockedPositiveIds],
    };
  }

  /**
   * Text-only projection that can be piped into logs or surfaced in future debug UIs.
   */
  public explain(snapshot: RunStateSnapshot): string[] {
    const report = this.inferDetailed(snapshot);

    return report.templateEvaluations.map((evaluation) => {
      const state =
        evaluation.eligible
          ? 'ELIGIBLE'
          : evaluation.alreadyActive
            ? 'ACTIVE'
            : evaluation.alreadyUnlocked
              ? 'ALREADY_UNLOCKED'
              : 'BLOCKED';

      return `${evaluation.templateId}::${state}::score=${evaluation.score.toFixed(
        3,
      )}/${evaluation.threshold.toFixed(3)}::${evaluation.summary}`;
    });
  }

  /**
   * Cheap boolean probe for fast-path systems that only care whether any positive chain
   * is available this tick.
   */
  public hasEligibleUnlock(snapshot: RunStateSnapshot): boolean {
    return this.infer(snapshot).length > 0;
  }

  private evaluateTemplate(
    context: PositiveCascadeContext,
    templateId: PositiveCascadeId,
  ): TemplateEvaluation {
    switch (templateId) {
      case 'MOMENTUM_ENGINE':
        return this.evaluateMomentum(context);
      case 'COMEBACK_SURGE':
        return this.evaluateComeback(context);
      default: {
        const exhaustiveCheck: never = templateId;
        return this.buildImpossibleTemplateEvaluation(exhaustiveCheck);
      }
    }
  }

  private evaluateMomentum(context: PositiveCascadeContext): TemplateEvaluation {
    const { snapshot, metrics } = context;
    const profile = this.thresholds.momentum[snapshot.mode][snapshot.phase];
    const alreadyActive = context.activePositiveIds.has('MOMENTUM_ENGINE');
    const alreadyUnlocked = context.unlockedPositiveIds.has('MOMENTUM_ENGINE');

    const gates: GateEvaluation[] = [
      this.passiveStateGate(
        !alreadyActive,
        0.0,
        'Momentum is not already active.',
        'Momentum is already represented by an active positive chain.',
      ),
      this.passiveStateGate(
        !alreadyUnlocked,
        0.0,
        'Momentum has not already been consumed this run.',
        'Momentum is already recorded in positiveTrackers and remains one-shot.',
      ),
      this.numericMinGate(
        metrics.incomeBuffer,
        profile.minIncomeBuffer,
        0.10,
        `Income buffer ${metrics.incomeBuffer} meets momentum floor ${profile.minIncomeBuffer}.`,
        `Income buffer ${metrics.incomeBuffer} is below momentum floor ${profile.minIncomeBuffer}.`,
      ),
      this.numericMinGate(
        metrics.cashBufferTicks,
        profile.minCashBufferTicks,
        0.12,
        `Cash buffer ${metrics.cashBufferTicks.toFixed(2)} ticks meets floor ${profile.minCashBufferTicks.toFixed(2)}.`,
        `Cash buffer ${metrics.cashBufferTicks.toFixed(2)} ticks is below floor ${profile.minCashBufferTicks.toFixed(2)}.`,
      ),
      this.numericMinGate(
        metrics.avgShieldRatio,
        profile.minAvgShieldRatio,
        0.12,
        `Average shield ratio ${metrics.avgShieldRatio.toFixed(3)} meets floor ${profile.minAvgShieldRatio.toFixed(3)}.`,
        `Average shield ratio ${metrics.avgShieldRatio.toFixed(3)} is below floor ${profile.minAvgShieldRatio.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.weakestShieldRatio,
        profile.minWeakestShieldRatio,
        0.10,
        `Weakest shield ratio ${metrics.weakestShieldRatio.toFixed(3)} meets floor ${profile.minWeakestShieldRatio.toFixed(3)}.`,
        `Weakest shield ratio ${metrics.weakestShieldRatio.toFixed(3)} is below floor ${profile.minWeakestShieldRatio.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.netWorthRatio,
        profile.minNetWorthRatio,
        0.05,
        `Net-worth ratio ${metrics.netWorthRatio.toFixed(3)} meets momentum floor ${profile.minNetWorthRatio.toFixed(3)}.`,
        `Net-worth ratio ${metrics.netWorthRatio.toFixed(3)} is below momentum floor ${profile.minNetWorthRatio.toFixed(3)}.`,
      ),
      this.numericMaxGate(
        metrics.heat,
        profile.maxHeat,
        0.08,
        `Hater heat ${metrics.heat} remains within momentum ceiling ${profile.maxHeat}.`,
        `Hater heat ${metrics.heat} exceeds momentum ceiling ${profile.maxHeat}.`,
      ),
      this.numericMaxGate(
        metrics.tension,
        profile.maxTension,
        0.06,
        `Tension ${metrics.tension.toFixed(3)} remains below ceiling ${profile.maxTension.toFixed(3)}.`,
        `Tension ${metrics.tension.toFixed(3)} exceeds ceiling ${profile.maxTension.toFixed(3)}.`,
      ),
      this.numericMaxGate(
        metrics.pendingAttacks,
        profile.maxPendingAttacks,
        0.07,
        `Pending attacks ${metrics.pendingAttacks} remain within ceiling ${profile.maxPendingAttacks}.`,
        `Pending attacks ${metrics.pendingAttacks} exceed ceiling ${profile.maxPendingAttacks}.`,
      ),
      this.numericMaxGate(
        metrics.negativeActiveChains,
        profile.maxNegativeActiveChains,
        0.10,
        `Negative active chains ${metrics.negativeActiveChains} remain within ceiling ${profile.maxNegativeActiveChains}.`,
        `Negative active chains ${metrics.negativeActiveChains} exceed ceiling ${profile.maxNegativeActiveChains}.`,
      ),
      this.numericMaxGate(
        metrics.warnings,
        profile.maxWarnings,
        0.04,
        `Warnings ${metrics.warnings} remain within ceiling ${profile.maxWarnings}.`,
        `Warnings ${metrics.warnings} exceed ceiling ${profile.maxWarnings}.`,
      ),
      this.numericMinGate(
        metrics.decisionAcceptanceRatio,
        profile.minDecisionAcceptanceRatio,
        0.04,
        `Decision acceptance ratio ${metrics.decisionAcceptanceRatio.toFixed(3)} meets floor ${profile.minDecisionAcceptanceRatio.toFixed(3)}.`,
        `Decision acceptance ratio ${metrics.decisionAcceptanceRatio.toFixed(3)} is below floor ${profile.minDecisionAcceptanceRatio.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.disciplineScore,
        profile.minDisciplineScore,
        0.05,
        `Discipline score ${metrics.disciplineScore.toFixed(3)} meets floor ${profile.minDisciplineScore.toFixed(3)}.`,
        `Discipline score ${metrics.disciplineScore.toFixed(3)} is below floor ${profile.minDisciplineScore.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.neutralizedBotRatio,
        profile.minNeutralizedBotRatio,
        0.03,
        `Neutralized-bot ratio ${metrics.neutralizedBotRatio.toFixed(3)} meets floor ${profile.minNeutralizedBotRatio.toFixed(3)}.`,
        `Neutralized-bot ratio ${metrics.neutralizedBotRatio.toFixed(3)} is below floor ${profile.minNeutralizedBotRatio.toFixed(3)}.`,
      ),
      this.optionalTrustPeakGate(metrics.trustPeak, profile.minTrustPeak),
      this.optionalTrustAverageGate(metrics.trustAverage, profile.minTrustAverage),
      this.optionalBattleBudgetGate(metrics.battleBudgetRatio, profile.minBattleBudgetRatio),
      this.optionalSharedTreasuryGate(
        metrics.sharedTreasuryBalance,
        profile.minSharedTreasuryBalance,
      ),
      this.optionalLegendGapGate(
        metrics.gapClosingRate,
        profile.requireLegendGapImprovement ?? false,
      ),
      this.optionalPhaseWindowGate(
        metrics.phaseWindowAvailable,
        profile.requirePhaseWindows ?? false,
      ),
    ];

    const hardGatePassed = gates.every((gate) => gate.passed);
    const score = this.computeWeightedScore(gates);
    const eligible = hardGatePassed && score >= profile.minScore;

    return {
      templateId: 'MOMENTUM_ENGINE',
      eligible,
      alreadyActive,
      alreadyUnlocked,
      hardGatePassed,
      score,
      threshold: profile.minScore,
      reasons: gates.map((gate) => gate.detail),
      gates,
      summary: eligible
        ? 'Stable economy, stable shields, contained heat, and mode doctrine support a positive flywheel.'
        : this.buildBlockedSummary(
            hardGatePassed,
            score,
            profile.minScore,
            'Momentum remains gated until the run stabilizes across economy, shield, and threat lanes.',
          ),
    };
  }

  private evaluateComeback(context: PositiveCascadeContext): TemplateEvaluation {
    const { snapshot, metrics } = context;
    const profile = this.thresholds.comeback[snapshot.mode][snapshot.phase];
    const alreadyActive = context.activePositiveIds.has('COMEBACK_SURGE');
    const alreadyUnlocked = context.unlockedPositiveIds.has('COMEBACK_SURGE');

    const gates: GateEvaluation[] = [
      this.passiveStateGate(
        !alreadyActive,
        0.0,
        'Comeback is not already active.',
        'Comeback is already represented by an active positive chain.',
      ),
      this.passiveStateGate(
        !alreadyUnlocked,
        0.0,
        'Comeback has not already been consumed this run.',
        'Comeback is already recorded in positiveTrackers and remains one-shot.',
      ),
      this.stressEvidenceGate(
        metrics.highPressureEvidenceScore,
        profile.minStressEvidence,
        profile.requireCurrentOrRecentHighPressure,
      ),
      this.numericMinGate(
        metrics.avgShieldRatio,
        profile.minRecoveredAvgShieldRatio,
        0.12,
        `Recovered average shield ratio ${metrics.avgShieldRatio.toFixed(3)} meets floor ${profile.minRecoveredAvgShieldRatio.toFixed(3)}.`,
        `Recovered average shield ratio ${metrics.avgShieldRatio.toFixed(3)} is below floor ${profile.minRecoveredAvgShieldRatio.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.weakestShieldRatio,
        profile.minRecoveredWeakestShieldRatio,
        0.12,
        `Recovered weakest shield ratio ${metrics.weakestShieldRatio.toFixed(3)} meets floor ${profile.minRecoveredWeakestShieldRatio.toFixed(3)}.`,
        `Recovered weakest shield ratio ${metrics.weakestShieldRatio.toFixed(3)} is below floor ${profile.minRecoveredWeakestShieldRatio.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.cashBufferTicks,
        profile.minCashBufferTicks,
        0.10,
        `Recovered cash buffer ${metrics.cashBufferTicks.toFixed(2)} ticks meets floor ${profile.minCashBufferTicks.toFixed(2)}.`,
        `Recovered cash buffer ${metrics.cashBufferTicks.toFixed(2)} ticks is below floor ${profile.minCashBufferTicks.toFixed(2)}.`,
      ),
      this.numericMaxGate(
        metrics.heat,
        profile.maxHeatAfterRecovery,
        0.08,
        `Post-recovery heat ${metrics.heat} remains within ceiling ${profile.maxHeatAfterRecovery}.`,
        `Post-recovery heat ${metrics.heat} exceeds ceiling ${profile.maxHeatAfterRecovery}.`,
      ),
      this.numericMaxGate(
        metrics.pendingAttacks,
        profile.maxPendingAttacks,
        0.07,
        `Pending attacks ${metrics.pendingAttacks} remain within comeback ceiling ${profile.maxPendingAttacks}.`,
        `Pending attacks ${metrics.pendingAttacks} exceed comeback ceiling ${profile.maxPendingAttacks}.`,
      ),
      this.numericMaxGate(
        metrics.warnings,
        profile.maxWarnings,
        0.04,
        `Warnings ${metrics.warnings} remain within comeback ceiling ${profile.maxWarnings}.`,
        `Warnings ${metrics.warnings} exceed comeback ceiling ${profile.maxWarnings}.`,
      ),
      this.numericMaxGate(
        this.pressureTierNumeric(snapshot.pressure.tier),
        profile.maxPressureTierNumeric,
        0.08,
        `Pressure tier ${snapshot.pressure.tier} remains within comeback ceiling T${profile.maxPressureTierNumeric}.`,
        `Pressure tier ${snapshot.pressure.tier} exceeds comeback ceiling T${profile.maxPressureTierNumeric}.`,
      ),
      this.numericMinGate(
        metrics.recoverySignalScore,
        profile.minRecoverySignalScore,
        0.12,
        `Recovery signal score ${metrics.recoverySignalScore.toFixed(3)} meets floor ${profile.minRecoverySignalScore.toFixed(3)}.`,
        `Recovery signal score ${metrics.recoverySignalScore.toFixed(3)} is below floor ${profile.minRecoverySignalScore.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.disciplineScore,
        profile.minDisciplineScore,
        0.05,
        `Discipline score ${metrics.disciplineScore.toFixed(3)} meets floor ${profile.minDisciplineScore.toFixed(3)}.`,
        `Discipline score ${metrics.disciplineScore.toFixed(3)} is below floor ${profile.minDisciplineScore.toFixed(3)}.`,
      ),
      this.numericMinGate(
        metrics.brokenChains + metrics.completedChains,
        profile.minBrokenOrCompletedChains,
        0.04,
        `Resolved chain count ${metrics.brokenChains + metrics.completedChains} meets floor ${profile.minBrokenOrCompletedChains}.`,
        `Resolved chain count ${metrics.brokenChains + metrics.completedChains} is below floor ${profile.minBrokenOrCompletedChains}.`,
      ),
      this.optionalTrustAverageGate(metrics.trustAverage, profile.minTrustAverage),
      this.optionalSharedTreasuryGate(
        metrics.sharedTreasuryBalance,
        profile.minSharedTreasuryBalance,
      ),
      this.optionalBattleBudgetGate(metrics.battleBudgetRatio, profile.minBattleBudgetRatio),
      this.optionalGapClosingRateGate(metrics.gapClosingRate, profile.minGapClosingRate),
      this.optionalLegendMarkerContextGate(
        metrics.ghostMarkerCount,
        profile.requireLegendMarkerContext ?? false,
      ),
    ];

    const hardGatePassed = gates.every((gate) => gate.passed);
    const score = this.computeWeightedScore(gates);
    const eligible = hardGatePassed && score >= profile.minScore;

    return {
      templateId: 'COMEBACK_SURGE',
      eligible,
      alreadyActive,
      alreadyUnlocked,
      hardGatePassed,
      score,
      threshold: profile.minScore,
      reasons: gates.map((gate) => gate.detail),
      gates,
      summary: eligible
        ? 'The run shows credible stress history plus present-time stabilization, so a comeback unlock is justified.'
        : this.buildBlockedSummary(
            hardGatePassed,
            score,
            profile.minScore,
            'Comeback remains gated until earlier distress is clearly followed by durable recovery.',
          ),
    };
  }

  private buildContext(snapshot: RunStateSnapshot): PositiveCascadeContext {
    const activePositiveIds = new Set<PositiveCascadeId>(
      snapshot.cascade.activeChains
        .filter((chain) => chain.positive)
        .map((chain) => chain.templateId)
        .filter((templateId): templateId is PositiveCascadeId => this.isPositiveCascadeId(templateId)),
    );

    const unlockedPositiveIds = new Set<PositiveCascadeId>(
      snapshot.cascade.positiveTrackers
        .filter((templateId): templateId is PositiveCascadeId => this.isPositiveCascadeId(templateId)),
    );

    const activeNegativeTemplateIds = snapshot.cascade.activeChains
      .filter((chain) => !chain.positive && chain.status === 'ACTIVE')
      .map((chain) => chain.templateId);

    return {
      snapshot,
      activePositiveIds,
      unlockedPositiveIds,
      activeNegativeTemplateIds,
      metrics: this.buildMetrics(snapshot, activeNegativeTemplateIds),
    };
  }

  private buildMetrics(
    snapshot: RunStateSnapshot,
    activeNegativeTemplateIds: readonly string[],
  ): PositiveCascadeMetrics {
    const layers = snapshot.shield.layers;
    const trustValues = Object.values(snapshot.modeState.trustScores);
    const decisions = snapshot.telemetry.decisions;
    const acceptedDecisions = decisions.filter((decision) => decision.accepted);
    const neutralizedBotCount =
      snapshot.battle.neutralizedBotIds.length > 0
        ? snapshot.battle.neutralizedBotIds.length
        : snapshot.battle.bots.filter((bot) => bot.neutralized).length;

    const avgShieldRatio = this.average(layers.map((layer) => layer.integrityRatio));
    const weakestShieldRatio = this.min(layers.map((layer) => layer.integrityRatio), 0);
    const strongestShieldRatio = this.max(layers.map((layer) => layer.integrityRatio), 0);
    const stableShieldCount = layers.filter((layer) => layer.integrityRatio >= STABLE_SHIELD_RATIO).length;
    const recoveredShieldCount = layers.filter((layer) => layer.integrityRatio >= RECOVERED_SHIELD_RATIO).length;
    const breachedShieldCount = layers.filter((layer) => layer.breached).length;

    const incomeBuffer = snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick;
    const cashBufferTicks = this.safeDivide(snapshot.economy.cash, Math.max(1, snapshot.economy.expensesPerTick));
    const expenseCoverageTicks = this.safeDivide(
      snapshot.economy.cash + Math.max(0, incomeBuffer),
      Math.max(1, snapshot.economy.expensesPerTick),
    );

    const warningCount = snapshot.telemetry.warnings.length + snapshot.sovereignty.auditFlags.length;

    const decisionAcceptanceRatio =
      decisions.length === 0 ? 1 : acceptedDecisions.length / decisions.length;
    const decisionLatencyScore = this.computeDecisionLatencyScore(decisions);
    const disciplineScore = this.computeDisciplineScore(
      decisionAcceptanceRatio,
      decisionLatencyScore,
      warningCount,
      snapshot.telemetry.outcomeReasonCode === null,
    );

    const trustPeak = trustValues.length === 0 ? 0 : this.max(trustValues, 0);
    const trustAverage = trustValues.length === 0 ? 0 : this.average(trustValues);
    const trustSpread = trustValues.length === 0 ? 0 : trustPeak - this.min(trustValues, 0);

    const battleBudgetRatio = this.safeDivide(
      snapshot.battle.battleBudget,
      Math.max(1, snapshot.battle.battleBudgetCap),
    );

    const escalationRecencyTicks = this.recency(snapshot.tick, snapshot.pressure.lastEscalationTick);
    const resolvedChainRecencyTicks = this.recency(snapshot.tick, snapshot.cascade.lastResolvedTick);

    const highPressureEvidenceScore = this.computeHighPressureEvidenceScore(snapshot, escalationRecencyTicks);
    const recoverySignalScore = this.computeRecoverySignalScore(
      snapshot,
      avgShieldRatio,
      weakestShieldRatio,
      cashBufferTicks,
      warningCount,
    );

    return {
      incomeBuffer,
      cashBufferTicks,
      expenseCoverageTicks,
      avgShieldRatio,
      weakestShieldRatio,
      strongestShieldRatio,
      stableShieldCount,
      recoveredShieldCount,
      breachedShieldCount,
      heat: snapshot.economy.haterHeat,
      heatNormalized: this.normalize(snapshot.economy.haterHeat, { min: 0, max: 20 }),
      tension: snapshot.tension.score,
      pendingAttacks: snapshot.battle.pendingAttacks.length,
      negativeActiveChains: activeNegativeTemplateIds.filter((templateId) =>
        MOMENTUM_NEGATIVE_TEMPLATE_IDS.has(templateId),
      ).length,
      positiveActiveChains: snapshot.cascade.activeChains.filter((chain) => chain.positive).length,
      brokenChains: snapshot.cascade.brokenChains,
      completedChains: snapshot.cascade.completedChains,
      warnings: warningCount,
      auditFlags: snapshot.sovereignty.auditFlags.length,
      emittedEvents: snapshot.telemetry.emittedEventCount,
      decisionCount: decisions.length,
      decisionAcceptanceRatio,
      decisionLatencyScore,
      disciplineScore,
      trustPeak,
      trustAverage,
      trustSpread,
      neutralizedBotRatio: this.safeDivide(neutralizedBotCount, 5),
      activeAggressorCount: snapshot.battle.bots.filter((bot) => this.isAggressorState(bot.state)).length,
      battleBudgetRatio,
      sharedTreasuryBalance: snapshot.modeState.sharedTreasuryBalance,
      gapVsLegend: snapshot.sovereignty.gapVsLegend,
      gapClosingRate: snapshot.sovereignty.gapClosingRate,
      ghostMarkerCount: snapshot.cards.ghostMarkers.length,
      netWorthRatio: this.safeDivide(
        snapshot.economy.netWorth,
        Math.max(1, snapshot.economy.freedomTarget),
      ),
      escalationRecencyTicks,
      resolvedChainRecencyTicks,
      highPressureEvidenceScore,
      recoverySignalScore,
      phaseWindowAvailable: snapshot.modeState.phaseBoundaryWindowsRemaining > 0,
      communityHeatModifier: snapshot.modeState.communityHeatModifier,
    };
  }

  private computeHighPressureEvidenceScore(
    snapshot: RunStateSnapshot,
    escalationRecencyTicks: number | null,
  ): number {
    let score = 0;

    if (this.pressureTierNumeric(snapshot.pressure.tier) >= 3) {
      score += 1.0;
    }

    if (snapshot.pressure.previousTier === 'T3' || snapshot.pressure.previousTier === 'T4') {
      score += 0.75;
    }

    score += Math.min(1.25, snapshot.pressure.survivedHighPressureTicks / 4);

    if (snapshot.shield.breachesThisRun > 0) {
      score += 0.75;
    }

    if (snapshot.cascade.brokenChains > 0 || snapshot.cascade.completedChains > 0) {
      score += 0.60;
    }

    if (snapshot.cascade.activeChains.some((chain) => !chain.positive)) {
      score += 0.50;
    }

    if (snapshot.telemetry.warnings.length > 0 || snapshot.sovereignty.auditFlags.length > 0) {
      score += 0.30;
    }

    if (escalationRecencyTicks !== null) {
      score += this.invertNormalizedRecency(escalationRecencyTicks, 8) * 0.90;
    }

    return score;
  }

  private computeRecoverySignalScore(
    snapshot: RunStateSnapshot,
    avgShieldRatio: number,
    weakestShieldRatio: number,
    cashBufferTicks: number,
    warnings: number,
  ): number {
    const shieldRecovery = this.average([
      avgShieldRatio,
      weakestShieldRatio,
      this.normalize(snapshot.shield.repairQueueDepth, { min: 0, max: 6 }, true),
    ]);

    const economyRecovery = this.average([
      this.normalize(cashBufferTicks, { min: 0, max: 4 }),
      this.normalize(snapshot.economy.cash, { min: 0, max: Math.max(1, snapshot.economy.expensesPerTick * 4) }),
      this.normalize(
        snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick,
        { min: -100, max: 200 },
      ),
    ]);

    const containment = this.average([
      this.normalize(snapshot.economy.haterHeat, { min: 0, max: 20 }, true),
      this.normalize(snapshot.tension.score, { min: 0, max: 1 }, true),
      this.normalize(snapshot.battle.pendingAttacks.length, { min: 0, max: 3 }, true),
    ]);

    const integrity = this.average([
      this.normalize(snapshot.sovereignty.auditFlags.length, { min: 0, max: 3 }, true),
      this.normalize(warnings, { min: 0, max: 4 }, true),
      snapshot.outcome === null ? 1 : 0,
    ]);

    return this.weightedAverage([
      { value: shieldRecovery, weight: 0.34 },
      { value: economyRecovery, weight: 0.28 },
      { value: containment, weight: 0.24 },
      { value: integrity, weight: 0.14 },
    ]);
  }

  private computeDecisionLatencyScore(decisions: readonly DecisionRecord[]): number {
    if (decisions.length === 0) {
      return 1;
    }

    const avgLatency = this.average(decisions.map((decision) => decision.latencyMs));

    if (avgLatency <= 1500) {
      return 1;
    }

    if (avgLatency >= 12000) {
      return 0;
    }

    return 1 - (avgLatency - 1500) / (12000 - 1500);
  }

  private computeDisciplineScore(
    decisionAcceptanceRatio: number,
    decisionLatencyScore: number,
    warnings: number,
    noOutcomeReasonCode: boolean,
  ): number {
    return this.weightedAverage([
      { value: decisionAcceptanceRatio, weight: 0.44 },
      { value: decisionLatencyScore, weight: 0.26 },
      { value: this.normalize(warnings, { min: 0, max: 4 }, true), weight: 0.18 },
      { value: noOutcomeReasonCode ? 1 : 0.5, weight: 0.12 },
    ]);
  }

  private computeWeightedScore(gates: readonly GateEvaluation[]): number {
    if (gates.length === 0) {
      return 0;
    }

    return this.weightedAverage(
      gates.map((gate) => ({
        value: gate.score,
        weight: gate.weight,
      })),
    );
  }

  private passiveStateGate(
    passed: boolean,
    failedScore: number,
    passedDetail: string,
    failedDetail: string,
    weight = 0.02,
  ): GateEvaluation {
    return {
      passed,
      score: passed ? 1 : failedScore,
      weight,
      summary: passed ? 'pass' : 'fail',
      detail: passed ? passedDetail : failedDetail,
    };
  }

  private numericMinGate(
    value: number,
    min: number,
    weight: number,
    passedDetail: string,
    failedDetail: string,
  ): GateEvaluation {
    const normalizationMax = this.resolveMinGateNormalizationMax(min);
    const normalized = this.normalize(value, { min, max: normalizationMax });
    const passed = value >= min;

    return {
      passed,
      score: normalized,
      weight,
      summary: passed ? 'pass' : 'fail',
      detail: passed ? passedDetail : failedDetail,
    };
  }

  private numericMaxGate(
    value: number,
    max: number,
    weight: number,
    passedDetail: string,
    failedDetail: string,
  ): GateEvaluation {
    const normalized = this.normalize(
      value,
      {
        min: 0,
        max: Math.max(1, max),
      },
      true,
    );
    const passed = value <= max;

    return {
      passed,
      score: normalized,
      weight,
      summary: passed ? 'pass' : 'fail',
      detail: passed ? passedDetail : failedDetail,
    };
  }

  private stressEvidenceGate(
    evidenceScore: number,
    minStressEvidence: number,
    required: boolean,
    weight = 0.12,
  ): GateEvaluation {
    if (!required) {
      return {
        passed: true,
        score: 1,
        weight: 0,
        summary: 'pass',
        detail: 'Recent stress evidence is optional in this profile.',
      };
    }

    const passed = evidenceScore >= minStressEvidence;

    return {
      passed,
      score: this.normalize(evidenceScore, {
        min: minStressEvidence,
        max: Math.max(minStressEvidence + 1.5, minStressEvidence),
      }),
      weight,
      summary: passed ? 'pass' : 'fail',
      detail: passed
        ? `Stress evidence score ${evidenceScore.toFixed(3)} meets floor ${minStressEvidence.toFixed(3)}.`
        : `Stress evidence score ${evidenceScore.toFixed(3)} is below floor ${minStressEvidence.toFixed(3)}.`,
    };
  }

  private optionalTrustPeakGate(value: number, min: number | undefined): GateEvaluation {
    if (min === undefined) {
      return this.notApplicableGate('Trust-peak requirement is not active for this profile.');
    }

    return this.numericMinGate(
      value,
      min,
      0.03,
      `Trust peak ${value.toFixed(2)} meets floor ${min.toFixed(2)}.`,
      `Trust peak ${value.toFixed(2)} is below floor ${min.toFixed(2)}.`,
    );
  }

  private optionalTrustAverageGate(value: number, min: number | undefined): GateEvaluation {
    if (min === undefined) {
      return this.notApplicableGate('Trust-average requirement is not active for this profile.');
    }

    return this.numericMinGate(
      value,
      min,
      0.03,
      `Trust average ${value.toFixed(2)} meets floor ${min.toFixed(2)}.`,
      `Trust average ${value.toFixed(2)} is below floor ${min.toFixed(2)}.`,
    );
  }

  private optionalBattleBudgetGate(value: number, min: number | undefined): GateEvaluation {
    if (min === undefined) {
      return this.notApplicableGate('Battle-budget requirement is not active for this profile.');
    }

    return this.numericMinGate(
      value,
      min,
      0.03,
      `Battle-budget ratio ${value.toFixed(3)} meets floor ${min.toFixed(3)}.`,
      `Battle-budget ratio ${value.toFixed(3)} is below floor ${min.toFixed(3)}.`,
    );
  }

  private optionalSharedTreasuryGate(value: number, min: number | undefined): GateEvaluation {
    if (min === undefined) {
      return this.notApplicableGate('Shared-treasury requirement is not active for this profile.');
    }

    return this.numericMinGate(
      value,
      min,
      0.03,
      `Shared treasury ${value} meets floor ${min}.`,
      `Shared treasury ${value} is below floor ${min}.`,
    );
  }

  private optionalLegendGapGate(
    gapClosingRate: number,
    required: boolean,
  ): GateEvaluation {
    if (!required) {
      return this.notApplicableGate('Legend-gap improvement is not required for this profile.');
    }

    const passed = gapClosingRate >= 0;

    return {
      passed,
      score: passed ? this.normalize(gapClosingRate, { min: 0, max: 0.05 }) : 0,
      weight: 0.03,
      summary: passed ? 'pass' : 'fail',
      detail: passed
        ? `Gap-closing rate ${gapClosingRate.toFixed(4)} is non-negative and supports momentum against the legend.`
        : `Gap-closing rate ${gapClosingRate.toFixed(4)} is negative, so ghost momentum is not justified.`,
    };
  }

  private optionalGapClosingRateGate(
    gapClosingRate: number,
    min: number | undefined,
  ): GateEvaluation {
    if (min === undefined) {
      return this.notApplicableGate('Gap-closing-rate requirement is not active for this profile.');
    }

    return this.numericMinGate(
      gapClosingRate,
      min,
      0.03,
      `Gap-closing rate ${gapClosingRate.toFixed(4)} meets floor ${min.toFixed(4)}.`,
      `Gap-closing rate ${gapClosingRate.toFixed(4)} is below floor ${min.toFixed(4)}.`,
    );
  }

  private optionalLegendMarkerContextGate(
    ghostMarkerCount: number,
    required: boolean,
  ): GateEvaluation {
    if (!required) {
      return this.notApplicableGate('Legend-marker context is not required for this profile.');
    }

    const passed = ghostMarkerCount > 0;

    return {
      passed,
      score: passed ? 1 : 0,
      weight: 0.03,
      summary: passed ? 'pass' : 'fail',
      detail: passed
        ? `Ghost marker context is present (${ghostMarkerCount} markers).`
        : 'Ghost marker context is absent, so ghost comeback is not justified.',
    };
  }

  private optionalPhaseWindowGate(
    phaseWindowAvailable: boolean,
    required: boolean,
  ): GateEvaluation {
    if (!required) {
      return this.notApplicableGate('Phase-boundary window is not required for this profile.');
    }

    return {
      passed: phaseWindowAvailable,
      score: phaseWindowAvailable ? 1 : 0,
      weight: 0.03,
      summary: phaseWindowAvailable ? 'pass' : 'fail',
      detail: phaseWindowAvailable
        ? 'Phase-boundary window remains available, so the run still has premium momentum timing.'
        : 'Phase-boundary window is exhausted, so premium late momentum timing is not justified.',
    };
  }

  private notApplicableGate(detail: string): GateEvaluation {
    return {
      passed: true,
      score: 1,
      weight: 0,
      summary: 'n/a',
      detail,
    };
  }

  private buildBlockedSummary(
    hardGatePassed: boolean,
    score: number,
    threshold: number,
    fallback: string,
  ): string {
    if (!hardGatePassed) {
      return `${fallback} One or more hard gates remain unmet.`;
    }

    return `${fallback} Soft score ${score.toFixed(3)} remains below threshold ${threshold.toFixed(3)}.`;
  }

  private buildImpossibleTemplateEvaluation(templateId: never): TemplateEvaluation {
    return {
      templateId,
      eligible: false,
      alreadyActive: false,
      alreadyUnlocked: false,
      hardGatePassed: false,
      score: 0,
      threshold: 1,
      reasons: ['Unsupported positive cascade id.'],
      gates: [],
      summary: 'Unsupported positive cascade id.',
    };
  }

  private pressureTierNumeric(tier: PressureTier): number {
    return PRESSURE_TIER_NUMERIC[tier];
  }

  private resolveMinGateNormalizationMax(min: number): number {
    if (min <= 0) {
      return 1;
    }

    if (min <= 1) {
      return 1;
    }

    return Math.max(min * 1.25, min + 1);
  }

  private normalize(value: number, band: NumericBand, invert = false): number {
    const denominator = band.max - band.min;

    if (denominator <= 0) {
      return invert ? 1 : 0;
    }

    const normalized = (value - band.min) / denominator;
    const clamped = Math.max(0, Math.min(1, normalized));

    return invert ? 1 - clamped : clamped;
  }

  private invertNormalizedRecency(recencyTicks: number, window: number): number {
    return this.normalize(recencyTicks, { min: 0, max: Math.max(1, window) }, true);
  }

  private safeDivide(a: number, b: number): number {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
      return 0;
    }

    return a / b;
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private weightedAverage(
    pairs: readonly { readonly value: number; readonly weight: number }[],
  ): number {
    if (pairs.length === 0) {
      return 0;
    }

    const denominator = pairs.reduce((sum, pair) => sum + pair.weight, 0);

    if (denominator <= 0) {
      return 0;
    }

    const numerator = pairs.reduce(
      (sum, pair) => sum + Math.max(0, Math.min(1, pair.value)) * pair.weight,
      0,
    );

    return numerator / denominator;
  }

  private min(values: readonly number[], fallback: number): number {
    if (values.length === 0) {
      return fallback;
    }

    return values.reduce((acc, value) => (value < acc ? value : acc), values[0] ?? fallback);
  }

  private max(values: readonly number[], fallback: number): number {
    if (values.length === 0) {
      return fallback;
    }

    return values.reduce((acc, value) => (value > acc ? value : acc), values[0] ?? fallback);
  }

  private recency(currentTick: number, previousTick: number | null): number | null {
    if (previousTick === null) {
      return null;
    }

    return Math.max(0, currentTick - previousTick);
  }

  private isAggressorState(state: RunStateSnapshot['battle']['bots'][number]['state']): boolean {
    return state === 'TARGETING' || state === 'ATTACKING';
  }

  private isPositiveCascadeId(templateId: string): templateId is PositiveCascadeId {
    return templateId === 'MOMENTUM_ENGINE' || templateId === 'COMEBACK_SURGE';
  }
}
