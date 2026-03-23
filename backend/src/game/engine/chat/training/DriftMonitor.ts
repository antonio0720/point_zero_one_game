/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DRIFT MONITOR
 * FILE: backend/src/game/engine/chat/training/DriftMonitor.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic drift detection for the authoritative backend chat learning
 * lane. This file compares a trained baseline policy bundle against newly
 * labeled authoritative corpora and surfaces:
 *
 * - label-space drift,
 * - scalar feature population drift,
 * - boolean-rate drift,
 * - categorical-value drift,
 * - sequence vocabulary drift,
 * - conversation-shape drift,
 * - deployment risk and retraining pressure,
 * - task-level and feature-level recommendations.
 *
 * Drift doctrine
 * --------------
 * 1. Drift is measured only against authoritative backend examples.
 * 2. Drift is not a vanity dashboard. It is a gate on whether existing policy
 *    artifacts still reflect current player behavior and current social combat
 *    conditions.
 * 3. Drift never rewrites transcript truth and never suppresses replay truth.
 * 4. Drift must be explainable. Every elevated result includes concrete
 *    contributing features and interpretable math.
 * 5. Drift must operate across both classical feature populations and sequence
 *    language populations because Point Zero One chat is both tactical and
 *    dramaturgical.
 *
 * Canonical lane fit
 * ------------------
 * /backend/src/game/engine/chat/training
 *   DatasetBuilder.ts
 *   LabelAssembler.ts
 *   PolicyTrainer.ts
 *   DriftMonitor.ts   <-- this file
 *
 * Runtime role
 * ------------
 * This file is intended for offline monitoring / scheduled jobs / release
 * gates. It can be used:
 * - pre-deploy for artifact acceptance,
 * - post-run for batch monitoring,
 * - after LiveOps shifts,
 * - during season changes,
 * - after major channel/presence/invasion tuning.
 */

import type {
  JsonValue,
  TrainingTaskKey,
  TrainingExample,
  TrainingExampleFeatures,
  TrainingTaskDatasetStats,
} from './DatasetBuilder';

import type {
  LabeledTrainingCorpus,
  LabeledTaskDataset,
  LabeledTrainingExample,
} from './LabelAssembler';

import type {
  TrainedPolicyBundle,
  TrainedTaskPolicy,
  TaskDriftBaseline,
  HistogramProfile,
  HistogramBin,
  BaselineShapeProfile,
} from './PolicyTrainer';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type DriftSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DriftDisposition = 'STABLE' | 'WATCH' | 'REVIEW' | 'RETRAIN' | 'BLOCK_DEPLOY';

export interface DriftMonitorOptions {
  readonly labelJsLow?: number;
  readonly labelJsMedium?: number;
  readonly labelJsHigh?: number;
  readonly scalarPsiLow?: number;
  readonly scalarPsiMedium?: number;
  readonly scalarPsiHigh?: number;
  readonly booleanDeltaLow?: number;
  readonly booleanDeltaMedium?: number;
  readonly booleanDeltaHigh?: number;
  readonly categoricalJsLow?: number;
  readonly categoricalJsMedium?: number;
  readonly categoricalJsHigh?: number;
  readonly sequenceNovelTokenLow?: number;
  readonly sequenceNovelTokenMedium?: number;
  readonly sequenceNovelTokenHigh?: number;
  readonly shapeDeltaLow?: number;
  readonly shapeDeltaMedium?: number;
  readonly shapeDeltaHigh?: number;
  readonly minimumExamplesForJudgment?: number;
  readonly topDriftFeaturesPerTask?: number;
  readonly topChangedLabelsPerTask?: number;
  readonly sequenceTopTokenWindow?: number;
  readonly epsilon?: number;
}

export interface NormalizedDriftMonitorOptions {
  readonly labelJsLow: number;
  readonly labelJsMedium: number;
  readonly labelJsHigh: number;
  readonly scalarPsiLow: number;
  readonly scalarPsiMedium: number;
  readonly scalarPsiHigh: number;
  readonly booleanDeltaLow: number;
  readonly booleanDeltaMedium: number;
  readonly booleanDeltaHigh: number;
  readonly categoricalJsLow: number;
  readonly categoricalJsMedium: number;
  readonly categoricalJsHigh: number;
  readonly sequenceNovelTokenLow: number;
  readonly sequenceNovelTokenMedium: number;
  readonly sequenceNovelTokenHigh: number;
  readonly shapeDeltaLow: number;
  readonly shapeDeltaMedium: number;
  readonly shapeDeltaHigh: number;
  readonly minimumExamplesForJudgment: number;
  readonly topDriftFeaturesPerTask: number;
  readonly topChangedLabelsPerTask: number;
  readonly sequenceTopTokenWindow: number;
  readonly epsilon: number;
}

export interface DriftMonitorManifest {
  readonly version: string;
  readonly analyzedAt: number;
  readonly monitorSignature: string;
  readonly trainerVersion: string;
  readonly sourceLabelerVersion: string;
  readonly sourceCorpusVersion: string;
  readonly options: NormalizedDriftMonitorOptions;
}

export interface DriftReport {
  readonly manifest: DriftMonitorManifest;
  readonly overall: OverallDriftSummary;
  readonly tasks: Readonly<Record<TrainingTaskKey, TaskDriftReport>>;
}

export interface OverallDriftSummary {
  readonly disposition: DriftDisposition;
  readonly severity: DriftSeverity;
  readonly stableTaskCount: number;
  readonly watchTaskCount: number;
  readonly retrainTaskCount: number;
  readonly blockTaskCount: number;
  readonly averageTaskDrift01: number;
  readonly highestTaskDrift01: number;
  readonly summaryLines: readonly string[];
}

export interface TaskDriftReport {
  readonly task: TrainingTaskKey;
  readonly severity: DriftSeverity;
  readonly disposition: DriftDisposition;
  readonly driftScore01: number;
  readonly exampleCount: number;
  readonly labelSpaceCoverage01: number;
  readonly labelDrift: LabelDriftReport;
  readonly scalarDrift: ScalarDriftSummary;
  readonly booleanDrift: BooleanDriftSummary;
  readonly categoricalDrift: CategoricalDriftSummary;
  readonly sequenceDrift: SequenceDriftSummary;
  readonly shapeDrift: ShapeDriftSummary;
  readonly triggeredReasons: readonly string[];
  readonly recommendations: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface LabelDriftReport {
  readonly jsDivergence01: number;
  readonly baselineHistogram: Readonly<Record<string, number>>;
  readonly currentHistogram: Readonly<Record<string, number>>;
  readonly changedLabels: readonly LabelShift[];
}

export interface LabelShift {
  readonly label: string;
  readonly baselineProbability01: number;
  readonly currentProbability01: number;
  readonly absoluteDelta01: number;
}

export interface ScalarDriftSummary {
  readonly aggregatePsi01: number;
  readonly changedFeatures: readonly ScalarFeatureDrift[];
}

export interface ScalarFeatureDrift {
  readonly feature: string;
  readonly psi01: number;
  readonly meanDelta: number;
  readonly stdDelta: number;
  readonly baselineMean: number;
  readonly currentMean: number;
  readonly baselineStdDev: number;
  readonly currentStdDev: number;
}

export interface BooleanDriftSummary {
  readonly aggregateDelta01: number;
  readonly changedFeatures: readonly BooleanFeatureDrift[];
}

export interface BooleanFeatureDrift {
  readonly feature: string;
  readonly baselineTrueRate01: number;
  readonly currentTrueRate01: number;
  readonly absoluteDelta01: number;
}

export interface CategoricalDriftSummary {
  readonly aggregateJs01: number;
  readonly changedFeatures: readonly CategoricalFeatureDrift[];
}

export interface CategoricalFeatureDrift {
  readonly feature: string;
  readonly jsDivergence01: number;
  readonly changedCategories: readonly CategoryShift[];
}

export interface CategoryShift {
  readonly category: string;
  readonly baselineProbability01: number;
  readonly currentProbability01: number;
  readonly absoluteDelta01: number;
}

export interface SequenceDriftSummary {
  readonly aggregateNovelty01: number;
  readonly changedFeatures: readonly SequenceFeatureDrift[];
}

export interface SequenceFeatureDrift {
  readonly feature: string;
  readonly novelTokenRate01: number;
  readonly vanishedTokenRate01: number;
  readonly overlapRate01: number;
  readonly newTokens: readonly string[];
  readonly vanishedTokens: readonly string[];
}

export interface ShapeDriftSummary {
  readonly aggregateDelta01: number;
  readonly changedMetrics: readonly ShapeMetricShift[];
}

export interface ShapeMetricShift {
  readonly metric: keyof BaselineShapeProfile;
  readonly baselineValue: number;
  readonly currentValue: number;
  readonly absoluteDelta01: number;
}

const DRIFT_MONITOR_VERSION = '2026.03.14' as const;

const DEFAULT_OPTIONS: NormalizedDriftMonitorOptions = Object.freeze({
  labelJsLow: 0.04,
  labelJsMedium: 0.1,
  labelJsHigh: 0.2,
  scalarPsiLow: 0.08,
  scalarPsiMedium: 0.16,
  scalarPsiHigh: 0.28,
  booleanDeltaLow: 0.06,
  booleanDeltaMedium: 0.12,
  booleanDeltaHigh: 0.22,
  categoricalJsLow: 0.04,
  categoricalJsMedium: 0.09,
  categoricalJsHigh: 0.18,
  sequenceNovelTokenLow: 0.12,
  sequenceNovelTokenMedium: 0.24,
  sequenceNovelTokenHigh: 0.4,
  shapeDeltaLow: 0.06,
  shapeDeltaMedium: 0.14,
  shapeDeltaHigh: 0.26,
  minimumExamplesForJudgment: 20,
  topDriftFeaturesPerTask: 12,
  topChangedLabelsPerTask: 8,
  sequenceTopTokenWindow: 48,
  epsilon: 1e-9,
});

// ============================================================================
// MARK: Drift monitor
// ============================================================================

export class DriftMonitor {
  private readonly options: NormalizedDriftMonitorOptions;

  public constructor(options: DriftMonitorOptions = {}) {
    this.options = Object.freeze({
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }

  public analyzeAgainstBundle(bundle: TrainedPolicyBundle, corpus: LabeledTrainingCorpus): DriftReport {
    const taskKeys = Object.keys(bundle.tasks) as TrainingTaskKey[];
    const tasks = {} as Record<TrainingTaskKey, TaskDriftReport>;

    for (const task of taskKeys) {
      const policy = bundle.tasks[task];
      const dataset = corpus.tasks[task];
      tasks[task] = this.analyzeTask(policy, dataset);
    }

    return Object.freeze({
      manifest: Object.freeze({
        version: DRIFT_MONITOR_VERSION,
        analyzedAt: Date.now(),
        monitorSignature: 'backend/src/game/engine/chat/training/DriftMonitor.ts',
        trainerVersion: bundle.manifest.version,
        sourceLabelerVersion: corpus.manifest.version,
        sourceCorpusVersion: corpus.manifest.sourceCorpusVersion,
        options: this.options,
      }),
      overall: this.buildOverallSummary(tasks),
      tasks: Object.freeze(tasks),
    });
  }

  public analyzeTask(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): TaskDriftReport {
    const exampleCount = dataset.examples.length;
    const baseline = policy.driftBaseline;

    const labelDrift = this.measureLabelDrift(policy, dataset);
    const scalarDrift = this.measureScalarDrift(policy, dataset);
    const booleanDrift = this.measureBooleanDrift(policy, dataset);
    const categoricalDrift = this.measureCategoricalDrift(policy, dataset);
    const sequenceDrift = this.measureSequenceDrift(policy, dataset);
    const shapeDrift = this.measureShapeDrift(policy, dataset);

    const componentScores = [
      labelDrift.jsDivergence01 / Math.max(this.options.labelJsHigh, this.options.epsilon),
      scalarDrift.aggregatePsi01 / Math.max(this.options.scalarPsiHigh, this.options.epsilon),
      booleanDrift.aggregateDelta01 / Math.max(this.options.booleanDeltaHigh, this.options.epsilon),
      categoricalDrift.aggregateJs01 / Math.max(this.options.categoricalJsHigh, this.options.epsilon),
      sequenceDrift.aggregateNovelty01 / Math.max(this.options.sequenceNovelTokenHigh, this.options.epsilon),
      shapeDrift.aggregateDelta01 / Math.max(this.options.shapeDeltaHigh, this.options.epsilon),
    ];

    const volumePenalty = exampleCount < this.options.minimumExamplesForJudgment
      ? 0.25
      : 0;

    const driftScore01 = clamp01((mean(componentScores) / 1.5) + volumePenalty);
    const severity = severityFromScore(driftScore01);
    const coverage = labelSpaceCoverage(policy, dataset);

    const triggeredReasons = buildTriggeredReasons(this.options, labelDrift, scalarDrift, booleanDrift, categoricalDrift, sequenceDrift, shapeDrift, exampleCount);
    const disposition = dispositionFromTask(this.options, severity, exampleCount, triggeredReasons.length);
    const recommendations = buildTaskRecommendations(policy, severity, disposition, coverage, triggeredReasons, exampleCount);

    return Object.freeze({
      task: policy.task,
      severity,
      disposition,
      driftScore01,
      exampleCount,
      labelSpaceCoverage01: coverage,
      labelDrift,
      scalarDrift,
      booleanDrift,
      categoricalDrift,
      sequenceDrift,
      shapeDrift,
      triggeredReasons: Object.freeze(triggeredReasons),
      recommendations: Object.freeze(recommendations),
      metadata: Object.freeze({
        baseline_labels: baseline.labelHistogram as unknown as JsonValue,
        current_stats: dataset.stats as unknown as JsonValue,
      }),
    });
  }

  // ==========================================================================
  // MARK: Label drift
  // ==========================================================================

  private measureLabelDrift(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): LabelDriftReport {
    const baselineHistogram = policy.driftBaseline.labelHistogram;
    const currentHistogram = normalizeHistogram(
      histogram(dataset.examples.map((example) => example.labels.primaryLabel)),
    );
    const keys = mergeKeys(baselineHistogram, currentHistogram);
    const jsDivergence01 = jensenShannonDivergence(baselineHistogram, currentHistogram, keys, this.options.epsilon);

    const changedLabels = keys
      .map((label) => {
        const baselineProbability01 = baselineHistogram[label] ?? 0;
        const currentProbability01 = currentHistogram[label] ?? 0;
        return Object.freeze({
          label,
          baselineProbability01,
          currentProbability01,
          absoluteDelta01: Math.abs(currentProbability01 - baselineProbability01),
        });
      })
      .sort((a, b) => compareNumbers(b.absoluteDelta01, a.absoluteDelta01) || compareStrings(a.label, b.label))
      .slice(0, this.options.topChangedLabelsPerTask);

    return Object.freeze({
      jsDivergence01,
      baselineHistogram: Object.freeze(sortRecord(baselineHistogram)),
      currentHistogram: Object.freeze(sortRecord(currentHistogram)),
      changedLabels: Object.freeze(changedLabels),
    });
  }

  // ==========================================================================
  // MARK: Scalar drift
  // ==========================================================================

  private measureScalarDrift(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): ScalarDriftSummary {
    const changedFeatures: ScalarFeatureDrift[] = [];

    for (const [feature, histogramProfile] of Object.entries(policy.driftBaseline.scalarHistograms)) {
      const values = dataset.examples
        .map((example) => example.features.scalar[feature])
        .filter(isFiniteNumber);

      if (values.length === 0) {
        continue;
      }

      const currentHistogram = projectHistogramToBaseline(values, histogramProfile);
      const psi01 = populationStabilityIndex(histogramProfile, currentHistogram, this.options.epsilon);
      const currentMean = mean(values);
      const currentStdDev = safeStdDev(values, currentMean);
      const baselineMean = histogramMean(histogramProfile);
      const baselineStdDev = histogramStdDev(histogramProfile, baselineMean);

      changedFeatures.push(
        Object.freeze({
          feature,
          psi01,
          meanDelta: currentMean - baselineMean,
          stdDelta: currentStdDev - baselineStdDev,
          baselineMean,
          currentMean,
          baselineStdDev,
          currentStdDev,
        }),
      );
    }

    const ordered = changedFeatures
      .sort((a, b) => compareNumbers(b.psi01, a.psi01) || compareStrings(a.feature, b.feature))
      .slice(0, this.options.topDriftFeaturesPerTask);

    return Object.freeze({
      aggregatePsi01: mean(changedFeatures.map((feature) => feature.psi01)),
      changedFeatures: Object.freeze(ordered),
    });
  }

  // ==========================================================================
  // MARK: Boolean drift
  // ==========================================================================

  private measureBooleanDrift(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): BooleanDriftSummary {
    const changedFeatures: BooleanFeatureDrift[] = [];

    for (const [feature, baselineTrueRate01] of Object.entries(policy.driftBaseline.booleanRates)) {
      const currentTrueRate01 = proportion(
        dataset.examples.map((example) => Boolean(example.features.boolean[feature])),
      );
      changedFeatures.push(
        Object.freeze({
          feature,
          baselineTrueRate01,
          currentTrueRate01,
          absoluteDelta01: Math.abs(currentTrueRate01 - baselineTrueRate01),
        }),
      );
    }

    const ordered = changedFeatures
      .sort((a, b) => compareNumbers(b.absoluteDelta01, a.absoluteDelta01) || compareStrings(a.feature, b.feature))
      .slice(0, this.options.topDriftFeaturesPerTask);

    return Object.freeze({
      aggregateDelta01: mean(changedFeatures.map((feature) => feature.absoluteDelta01)),
      changedFeatures: Object.freeze(ordered),
    });
  }

  // ==========================================================================
  // MARK: Categorical drift
  // ==========================================================================

  private measureCategoricalDrift(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): CategoricalDriftSummary {
    const changedFeatures: CategoricalFeatureDrift[] = [];

    for (const [feature, baselineHistogram] of Object.entries(policy.driftBaseline.categoricalHistograms)) {
      const currentHistogram = normalizeHistogram(
        histogram(
          dataset.examples
            .map((example) => normalizeCategory(example.features.categorical[feature]))
            .filter(isNonEmptyString),
        ),
      );

      const keys = mergeKeys(baselineHistogram, currentHistogram);
      const jsDivergence01 = jensenShannonDivergence(baselineHistogram, currentHistogram, keys, this.options.epsilon);

      const changedCategories = keys
        .map((category) =>
          Object.freeze({
            category,
            baselineProbability01: baselineHistogram[category] ?? 0,
            currentProbability01: currentHistogram[category] ?? 0,
            absoluteDelta01: Math.abs((currentHistogram[category] ?? 0) - (baselineHistogram[category] ?? 0)),
          }),
        )
        .sort((a, b) => compareNumbers(b.absoluteDelta01, a.absoluteDelta01) || compareStrings(a.category, b.category))
        .slice(0, Math.max(8, this.options.topDriftFeaturesPerTask));

      changedFeatures.push(
        Object.freeze({
          feature,
          jsDivergence01,
          changedCategories: Object.freeze(changedCategories),
        }),
      );
    }

    const ordered = changedFeatures
      .sort((a, b) => compareNumbers(b.jsDivergence01, a.jsDivergence01) || compareStrings(a.feature, b.feature))
      .slice(0, this.options.topDriftFeaturesPerTask);

    return Object.freeze({
      aggregateJs01: mean(changedFeatures.map((feature) => feature.jsDivergence01)),
      changedFeatures: Object.freeze(ordered),
    });
  }

  // ==========================================================================
  // MARK: Sequence drift
  // ==========================================================================

  private measureSequenceDrift(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): SequenceDriftSummary {
    const changedFeatures: SequenceFeatureDrift[] = [];

    for (const [feature, baselineTokens] of Object.entries(policy.driftBaseline.sequenceTopTokens)) {
      const currentTokens = topSequenceTokens(
        dataset.examples.flatMap((example) => tokenizeSequence(example.features.sequence[feature] ?? [])),
        this.options.sequenceTopTokenWindow,
      );

      const baselineSet = new Set(baselineTokens);
      const currentSet = new Set(currentTokens);

      const newTokens = currentTokens.filter((token) => !baselineSet.has(token));
      const vanishedTokens = baselineTokens.filter((token) => !currentSet.has(token));
      const overlapCount = currentTokens.filter((token) => baselineSet.has(token)).length;
      const overlapRate01 = overlapCount / Math.max(1, Math.max(baselineSet.size, currentSet.size));
      const novelTokenRate01 = newTokens.length / Math.max(1, currentSet.size);
      const vanishedTokenRate01 = vanishedTokens.length / Math.max(1, baselineSet.size);

      changedFeatures.push(
        Object.freeze({
          feature,
          novelTokenRate01,
          vanishedTokenRate01,
          overlapRate01,
          newTokens: Object.freeze(newTokens.slice(0, this.options.sequenceTopTokenWindow)),
          vanishedTokens: Object.freeze(vanishedTokens.slice(0, this.options.sequenceTopTokenWindow)),
        }),
      );
    }

    const ordered = changedFeatures
      .sort((a, b) => compareNumbers(b.novelTokenRate01, a.novelTokenRate01) || compareStrings(a.feature, b.feature))
      .slice(0, this.options.topDriftFeaturesPerTask);

    return Object.freeze({
      aggregateNovelty01: mean(changedFeatures.map((feature) => feature.novelTokenRate01)),
      changedFeatures: Object.freeze(ordered),
    });
  }

  // ==========================================================================
  // MARK: Shape drift
  // ==========================================================================

  private measureShapeDrift(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): ShapeDriftSummary {
    const baselineShape = policy.driftBaseline.shape;
    const currentShape = computeCurrentShape(dataset.examples);

    const changedMetrics = Object.keys(baselineShape).map((key) => {
      const metric = key as keyof BaselineShapeProfile;
      const baselineValue = baselineShape[metric];
      const currentValue = currentShape[metric];
      const scale = Math.max(0.001, Math.abs(baselineValue));
      return Object.freeze({
        metric,
        baselineValue,
        currentValue,
        absoluteDelta01: Math.abs(currentValue - baselineValue) / scale,
      });
    });

    const ordered = changedMetrics
      .sort((a, b) => compareNumbers(b.absoluteDelta01, a.absoluteDelta01) || compareStrings(a.metric, b.metric))
      .slice(0, this.options.topDriftFeaturesPerTask);

    return Object.freeze({
      aggregateDelta01: mean(changedMetrics.map((metric) => metric.absoluteDelta01)),
      changedMetrics: Object.freeze(ordered),
    });
  }

  // ==========================================================================
  // MARK: Overall summary
  // ==========================================================================

  private buildOverallSummary(tasks: Readonly<Record<TrainingTaskKey, TaskDriftReport>>): OverallDriftSummary {
    const values = Object.values(tasks);
    const stableTaskCount = values.filter((task) => task.disposition === 'STABLE').length;
    const watchTaskCount = values.filter((task) => task.disposition === 'WATCH' || task.disposition === 'REVIEW').length;
    const retrainTaskCount = values.filter((task) => task.disposition === 'RETRAIN').length;
    const blockTaskCount = values.filter((task) => task.disposition === 'BLOCK_DEPLOY').length;
    const averageTaskDrift01 = mean(values.map((task) => task.driftScore01));
    const highestTaskDrift01 = values.length > 0 ? Math.max(...values.map((task) => task.driftScore01)) : 0;

    const severity = severityFromScore(highestTaskDrift01);
    const disposition: DriftDisposition =
      blockTaskCount > 0 ? 'BLOCK_DEPLOY'
      : retrainTaskCount > 0 ? 'RETRAIN'
      : watchTaskCount > 0 ? 'REVIEW'
      : 'STABLE';

    const summaryLines = [
      `Average task drift=${round(averageTaskDrift01, 4)}.`,
      `Highest task drift=${round(highestTaskDrift01, 4)}.`,
      `${stableTaskCount} stable tasks, ${watchTaskCount} watch/review tasks, ${retrainTaskCount} retrain tasks, ${blockTaskCount} block tasks.`,
    ];

    return Object.freeze({
      disposition,
      severity,
      stableTaskCount,
      watchTaskCount,
      retrainTaskCount,
      blockTaskCount,
      averageTaskDrift01,
      highestTaskDrift01,
      summaryLines: Object.freeze(summaryLines),
    });
  }
}

// ============================================================================
// MARK: Helper utilities — reasons and recommendations
// ============================================================================

function buildTriggeredReasons(
  options: NormalizedDriftMonitorOptions,
  labelDrift: LabelDriftReport,
  scalarDrift: ScalarDriftSummary,
  booleanDrift: BooleanDriftSummary,
  categoricalDrift: CategoricalDriftSummary,
  sequenceDrift: SequenceDriftSummary,
  shapeDrift: ShapeDriftSummary,
  exampleCount: number,
): string[] {
  const reasons: string[] = [];

  if (exampleCount < options.minimumExamplesForJudgment) {
    reasons.push('Current corpus volume is below the minimum judgment threshold.');
  }

  if (labelDrift.jsDivergence01 >= options.labelJsHigh) {
    reasons.push('Label distribution has materially shifted against the trained baseline.');
  }

  if (scalarDrift.aggregatePsi01 >= options.scalarPsiHigh) {
    reasons.push('Scalar feature populations show strong PSI drift.');
  }

  if (booleanDrift.aggregateDelta01 >= options.booleanDeltaHigh) {
    reasons.push('Boolean feature rates have shifted materially.');
  }

  if (categoricalDrift.aggregateJs01 >= options.categoricalJsHigh) {
    reasons.push('Categorical channel / state distributions have diverged.');
  }

  if (sequenceDrift.aggregateNovelty01 >= options.sequenceNovelTokenHigh) {
    reasons.push('Sequence vocabulary novelty is elevated; current language differs from baseline.');
  }

  if (shapeDrift.aggregateDelta01 >= options.shapeDeltaHigh) {
    reasons.push('Conversation shape metrics materially differ from baseline.');
  }

  return reasons;
}

function buildTaskRecommendations(
  policy: TrainedTaskPolicy,
  severity: DriftSeverity,
  disposition: DriftDisposition,
  labelCoverage01: number,
  reasons: readonly string[],
  exampleCount: number,
): string[] {
  const recommendations: string[] = [];

  if (disposition === 'BLOCK_DEPLOY') {
    recommendations.push('Block artifact promotion until retraining and validation are rerun.');
  }

  if (disposition === 'RETRAIN') {
    recommendations.push('Rebuild dataset, rerun label assembly, retrain policy, and compare validation curves.');
  }

  if (severity === 'MEDIUM' || severity === 'HIGH' || severity === 'CRITICAL') {
    recommendations.push('Shadow current runtime scoring against newly retrained candidate artifacts.');
  }

  if (labelCoverage01 < 0.85) {
    recommendations.push('Review label-space coverage; current corpus does not fully represent baseline labels.');
  }

  if (policy.task === 'RESPONSE_RANKING' || policy.task === 'SEQUENCE_MEMORY') {
    recommendations.push('Re-evaluate retrieval context windows and sequence vocabulary pruning.');
  }

  if (policy.task === 'CHANNEL_AFFINITY' || policy.task === 'INTERVENTION_POLICY') {
    recommendations.push('Check LiveOps / mode / channel rule changes that may have altered current decision contexts.');
  }

  if (reasons.some((reason) => reason.includes('Label distribution'))) {
    recommendations.push('Audit labeler assumptions and post-anchor evidence windows for shifted outcomes.');
  }

  if (reasons.some((reason) => reason.includes('Sequence vocabulary'))) {
    recommendations.push('Inspect new player slang, helper cadence phrasing, and hater taunt changes.');
  }

  if (exampleCount < 50) {
    recommendations.push('Collect additional authoritative examples before hardening thresholds.');
  }

  if (recommendations.length === 0) {
    recommendations.push('No major action required; continue scheduled monitoring.');
  }

  return recommendations;
}

function labelSpaceCoverage(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): number {
  const currentLabels = new Set(dataset.examples.map((example) => example.labels.primaryLabel));
  const matched = policy.labelSpace.filter((label) => currentLabels.has(label)).length;
  return matched / Math.max(1, policy.labelSpace.length);
}

function severityFromScore(score01: number): DriftSeverity {
  if (score01 >= 0.9) {
    return 'CRITICAL';
  }
  if (score01 >= 0.7) {
    return 'HIGH';
  }
  if (score01 >= 0.45) {
    return 'MEDIUM';
  }
  if (score01 >= 0.2) {
    return 'LOW';
  }
  return 'NONE';
}

function dispositionFromTask(
  options: NormalizedDriftMonitorOptions,
  severity: DriftSeverity,
  exampleCount: number,
  reasonCount: number,
): DriftDisposition {
  if (severity === 'CRITICAL') {
    return 'BLOCK_DEPLOY';
  }

  if (severity === 'HIGH') {
    return 'RETRAIN';
  }

  if (severity === 'MEDIUM') {
    return exampleCount >= options.minimumExamplesForJudgment ? 'REVIEW' : 'WATCH';
  }

  if (reasonCount > 0) {
    return 'WATCH';
  }

  return 'STABLE';
}

// ============================================================================
// MARK: Helper utilities — histogram math
// ============================================================================

function histogram(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function normalizeHistogram(counts: Record<string, number>): Record<string, number> {
  const total = sum(Object.values(counts));
  if (total <= 0) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) {
    normalized[key] = value / total;
  }
  return normalized;
}

function mergeKeys(a: Record<string, number>, b: Record<string, number>): readonly string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(compareStrings);
}

function jensenShannonDivergence(
  a: Record<string, number>,
  b: Record<string, number>,
  keys: readonly string[],
  epsilon: number,
): number {
  const midpoint: Record<string, number> = {};
  for (const key of keys) {
    midpoint[key] = ((a[key] ?? 0) + (b[key] ?? 0)) / 2;
  }

  return (klDivergence(a, midpoint, keys, epsilon) + klDivergence(b, midpoint, keys, epsilon)) / 2;
}

function klDivergence(
  p: Record<string, number>,
  q: Record<string, number>,
  keys: readonly string[],
  epsilon: number,
): number {
  let total = 0;
  for (const key of keys) {
    const pv = Math.max(epsilon, p[key] ?? 0);
    const qv = Math.max(epsilon, q[key] ?? 0);
    total += pv * Math.log(pv / qv);
  }
  return total;
}

function populationStabilityIndex(
  baseline: HistogramProfile,
  current: HistogramProfile,
  epsilon: number,
): number {
  const binCount = Math.min(baseline.bins.length, current.bins.length);
  const parts: number[] = [];

  for (let index = 0; index < binCount; index += 1) {
    const expected = Math.max(epsilon, baseline.bins[index]?.probability01 ?? 0);
    const actual = Math.max(epsilon, current.bins[index]?.probability01 ?? 0);
    parts.push((actual - expected) * Math.log(actual / expected));
  }

  return sum(parts);
}

function projectHistogramToBaseline(values: readonly number[], baseline: HistogramProfile): HistogramProfile {
  if (baseline.bins.length === 0 || values.length === 0) {
    return Object.freeze({
      min: baseline.min,
      max: baseline.max,
      bins: Object.freeze(baseline.bins.map((bin) => Object.freeze({ ...bin, probability01: 0 }))),
    });
  }

  const counts = new Array<number>(baseline.bins.length).fill(0);

  for (const value of values) {
    const index = baseline.bins.findIndex((bin, binIndex) =>
      value >= bin.lowerBoundInclusive &&
      (value < bin.upperBoundExclusive || binIndex === baseline.bins.length - 1),
    );
    const safeIndex = index >= 0 ? index : baseline.bins.length - 1;
    counts[safeIndex] += 1;
  }

  return Object.freeze({
    min: baseline.min,
    max: baseline.max,
    bins: Object.freeze(
      baseline.bins.map((bin, index) =>
        Object.freeze({
          lowerBoundInclusive: bin.lowerBoundInclusive,
          upperBoundExclusive: bin.upperBoundExclusive,
          probability01: counts[index] / values.length,
        }),
      ),
    ),
  });
}

function histogramMean(histogramProfile: HistogramProfile): number {
  const parts = histogramProfile.bins.map((bin) => {
    const midpoint = (bin.lowerBoundInclusive + bin.upperBoundExclusive) / 2;
    return midpoint * bin.probability01;
  });
  return sum(parts);
}

function histogramStdDev(histogramProfile: HistogramProfile, meanValue: number): number {
  const parts = histogramProfile.bins.map((bin) => {
    const midpoint = (bin.lowerBoundInclusive + bin.upperBoundExclusive) / 2;
    return ((midpoint - meanValue) ** 2) * bin.probability01;
  });
  return Math.sqrt(Math.max(0, sum(parts)));
}

// ============================================================================
// MARK: Helper utilities — shape
// ============================================================================

function computeCurrentShape(examples: readonly LabeledTrainingExample[]): BaselineShapeProfile {
  return Object.freeze({
    featureDensity01: mean(examples.map((example) => featureDensity(example.features))),
    averageEvidenceRefs: mean(examples.map((example) => example.window.evidence.length)),
    averagePreMessages: mean(examples.map((example) => example.window.preMessages.length)),
    averageAnchorMessages: mean(examples.map((example) => example.window.anchorMessages.length)),
    averagePostMessages: mean(examples.map((example) => example.window.postMessages.length)),
    averageTelemetryRecords: mean(examples.map((example) => example.window.telemetry.length)),
    averageReplayArtifacts: mean(examples.map((example) => example.window.replayArtifacts.length)),
    averageInferenceSnapshots: mean(examples.map((example) => example.window.inferenceSnapshots.length)),
  });
}

function featureDensity(features: TrainingExampleFeatures): number {
  const scalar = Object.values(features.scalar).filter(isFiniteNumber).length;
  const boolean = Object.keys(features.boolean).length;
  const categorical = Object.values(features.categorical).filter((value) => value !== null && value !== '').length;
  const sequence = Object.values(features.sequence).reduce((acc, values) => acc + values.length, 0);
  const present = scalar + boolean + categorical + sequence;
  const possible = Math.max(
    1,
    Object.keys(features.scalar).length +
      Object.keys(features.boolean).length +
      Object.keys(features.categorical).length +
      Object.keys(features.sequence).length,
  );
  return clamp01(present / possible);
}

// ============================================================================
// MARK: Helper utilities — sequence vocab
// ============================================================================

function tokenizeSequence(values: readonly string[]): readonly string[] {
  const tokens: string[] = [];

  for (const raw of values) {
    const normalized = raw
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s]+/g, ' ')
      .split(/\s+/g)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const token of normalized) {
      if (token.length >= 2) {
        tokens.push(token);
      }
    }
  }

  return Object.freeze(tokens);
}

function topSequenceTokens(tokens: readonly string[], limit: number): readonly string[] {
  const counts = histogram(tokens);
  return Object.freeze(
    Object.entries(counts)
      .sort((a, b) => compareNumbers(b[1], a[1]) || compareStrings(a[0], b[0]))
      .slice(0, limit)
      .map(([token]) => token),
  );
}

// ============================================================================
// MARK: Helper utilities — stats / general math
// ============================================================================

function proportion(values: readonly boolean[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.filter(Boolean).length / values.length;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function safeStdDev(values: readonly number[], meanValue?: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const avg = meanValue ?? mean(values);
  const variance = values.reduce((acc, value) => acc + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort((a, b) => compareStrings(a[0], b[0]))) as Record<string, T>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeCategory(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// ============================================================================
// MARK: Drift trend tracking
// ============================================================================

export interface DriftTrendPoint {
  readonly analyzedAt: number;
  readonly task: TrainingTaskKey;
  readonly driftScore01: number;
  readonly severity: DriftSeverity;
  readonly disposition: DriftDisposition;
  readonly exampleCount: number;
  readonly labelJsDivergence01: number;
  readonly scalarAggregratePsi01: number;
  readonly sequenceNovelty01: number;
}

export interface DriftTrendReport {
  readonly task: TrainingTaskKey;
  readonly points: readonly DriftTrendPoint[];
  readonly latestDrift01: number;
  readonly peakDrift01: number;
  readonly averageDrift01: number;
  readonly trend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INSUFFICIENT_DATA';
  readonly velocityPerCycle: number;
  readonly recommendation: string;
}

export function buildDriftTrendReport(
  task: TrainingTaskKey,
  history: readonly TaskDriftReport[],
): DriftTrendReport {
  if (history.length === 0) {
    return Object.freeze({
      task,
      points: Object.freeze([]),
      latestDrift01: 0,
      peakDrift01: 0,
      averageDrift01: 0,
      trend: 'INSUFFICIENT_DATA',
      velocityPerCycle: 0,
      recommendation: 'No drift history available — run first drift analysis.',
    });
  }

  const points: DriftTrendPoint[] = history.map((report, index) => Object.freeze({
    analyzedAt: Date.now() - (history.length - index) * 86_400_000,
    task: report.task,
    driftScore01: report.driftScore01,
    severity: report.severity,
    disposition: report.disposition,
    exampleCount: report.exampleCount,
    labelJsDivergence01: report.labelDrift.jsDivergence01,
    scalarAggregratePsi01: report.scalarDrift.aggregatePsi01,
    sequenceNovelty01: report.sequenceDrift.aggregateNovelty01,
  }));

  const scores = points.map((p) => p.driftScore01);
  const latestDrift01 = scores[scores.length - 1] ?? 0;
  const peakDrift01 = Math.max(...scores);
  const averageDrift01 = mean(scores);

  let trend: DriftTrendReport['trend'] = 'STABLE';
  let velocityPerCycle = 0;
  if (scores.length >= 2) {
    const recent = mean(scores.slice(-3));
    const older = mean(scores.slice(0, Math.max(1, scores.length - 3)));
    velocityPerCycle = recent - older;
    if (velocityPerCycle > 0.04) trend = 'WORSENING';
    else if (velocityPerCycle < -0.04) trend = 'IMPROVING';
  } else {
    trend = 'INSUFFICIENT_DATA';
  }

  const recommendation =
    trend === 'WORSENING' ? 'Drift is accelerating — schedule retraining before next release cycle.'
    : trend === 'IMPROVING' ? 'Drift is decreasing — current policy is adapting well to current behavior.'
    : 'Drift is stable — continue monitoring on schedule.';

  return Object.freeze({
    task,
    points: Object.freeze(points),
    latestDrift01,
    peakDrift01,
    averageDrift01,
    trend,
    velocityPerCycle: round(velocityPerCycle, 4),
    recommendation,
  });
}

export function buildAllDriftTrendReports(
  historyByTask: Readonly<Record<TrainingTaskKey, readonly TaskDriftReport[]>>,
): Readonly<Record<TrainingTaskKey, DriftTrendReport>> {
  const result = {} as Record<TrainingTaskKey, DriftTrendReport>;
  for (const task of Object.keys(historyByTask) as TrainingTaskKey[]) {
    result[task] = buildDriftTrendReport(task, historyByTask[task]);
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Drift alert policy
// ============================================================================

export interface DriftAlertThresholds {
  readonly warnDrift01: number;
  readonly criticalDrift01: number;
  readonly warnVelocityPerCycle: number;
  readonly criticalVelocityPerCycle: number;
  readonly warnLabelJs01: number;
  readonly criticalLabelJs01: number;
  readonly minimumPointsForVelocity: number;
}

export type DriftAlertLevel = 'NONE' | 'WARN' | 'CRITICAL';

export interface DriftAlertEvent {
  readonly task: TrainingTaskKey;
  readonly alertLevel: DriftAlertLevel;
  readonly triggeredAt: number;
  readonly driftScore01: number;
  readonly severity: DriftSeverity;
  readonly velocity: number;
  readonly labelJs01: number;
  readonly reasons: readonly string[];
}

export const DEFAULT_DRIFT_ALERT_THRESHOLDS: DriftAlertThresholds = Object.freeze({
  warnDrift01: 0.35,
  criticalDrift01: 0.65,
  warnVelocityPerCycle: 0.04,
  criticalVelocityPerCycle: 0.1,
  warnLabelJs01: 0.08,
  criticalLabelJs01: 0.18,
  minimumPointsForVelocity: 2,
});

export function evaluateDriftAlert(
  trend: DriftTrendReport,
  thresholds: DriftAlertThresholds = DEFAULT_DRIFT_ALERT_THRESHOLDS,
): DriftAlertEvent {
  const reasons: string[] = [];
  let alertLevel: DriftAlertLevel = 'NONE';

  if (trend.latestDrift01 >= thresholds.criticalDrift01) {
    alertLevel = 'CRITICAL';
    reasons.push(`Drift score ${round(trend.latestDrift01, 3)} exceeds critical threshold.`);
  } else if (trend.latestDrift01 >= thresholds.warnDrift01) {
    alertLevel = 'WARN';
    reasons.push(`Drift score ${round(trend.latestDrift01, 3)} exceeds warning threshold.`);
  }

  if (trend.points.length >= thresholds.minimumPointsForVelocity) {
    if (trend.velocityPerCycle >= thresholds.criticalVelocityPerCycle) {
      alertLevel = 'CRITICAL';
      reasons.push(`Drift velocity ${round(trend.velocityPerCycle, 4)}/cycle exceeds critical threshold.`);
    } else if (trend.velocityPerCycle >= thresholds.warnVelocityPerCycle) {
      if (alertLevel !== 'CRITICAL') alertLevel = 'WARN';
      reasons.push(`Drift velocity ${round(trend.velocityPerCycle, 4)}/cycle is elevated.`);
    }
  }

  const latestLabel = trend.points[trend.points.length - 1]?.labelJsDivergence01 ?? 0;
  if (latestLabel >= thresholds.criticalLabelJs01) {
    alertLevel = 'CRITICAL';
    reasons.push(`Label JS divergence ${round(latestLabel, 3)} exceeds critical threshold.`);
  } else if (latestLabel >= thresholds.warnLabelJs01) {
    if (alertLevel !== 'CRITICAL') alertLevel = 'WARN';
    reasons.push(`Label JS divergence ${round(latestLabel, 3)} is elevated.`);
  }

  const latestPoint = trend.points[trend.points.length - 1];
  return Object.freeze({
    task: trend.task,
    alertLevel,
    triggeredAt: Date.now(),
    driftScore01: trend.latestDrift01,
    severity: latestPoint?.severity ?? 'NONE',
    velocity: trend.velocityPerCycle,
    labelJs01: latestLabel,
    reasons: Object.freeze(reasons),
  });
}

// ============================================================================
// MARK: Drift budget state — uses TrainingTaskDatasetStats
// ============================================================================

export interface DriftBudgetEntry {
  readonly task: TrainingTaskKey;
  readonly allowedDrift01: number;
  readonly currentDrift01: number;
  readonly remainingBudget01: number;
  readonly budgetConsumed01: number;
  readonly isOverBudget: boolean;
  readonly datasetExampleCount: number;
  readonly datasetAverageConfidence01: number;
}

export interface DriftBudgetState {
  readonly evaluatedAt: number;
  readonly tasks: Readonly<Record<TrainingTaskKey, DriftBudgetEntry>>;
  readonly overBudgetTasks: readonly TrainingTaskKey[];
  readonly overallBudgetConsumed01: number;
}

export function buildDriftBudgetState(
  driftReport: DriftReport,
  datasetStats: Readonly<Record<TrainingTaskKey, TrainingTaskDatasetStats>>,
  allowedDriftPerTask: Readonly<Record<TrainingTaskKey, number>> = {} as Readonly<Record<TrainingTaskKey, number>>,
): DriftBudgetState {
  const tasks = Object.keys(driftReport.tasks) as TrainingTaskKey[];
  const entries = {} as Record<TrainingTaskKey, DriftBudgetEntry>;
  const overBudgetTasks: TrainingTaskKey[] = [];
  let totalBudgetConsumed = 0;

  for (const task of tasks) {
    const taskReport = driftReport.tasks[task];
    const stats = datasetStats[task];
    const allowed = allowedDriftPerTask[task] ?? 0.5;
    const current = taskReport.driftScore01;
    const budgetConsumed01 = clamp01(current / Math.max(allowed, 0.0001));
    const isOverBudget = current > allowed;

    if (isOverBudget) overBudgetTasks.push(task);

    entries[task] = Object.freeze({
      task,
      allowedDrift01: allowed,
      currentDrift01: current,
      remainingBudget01: Math.max(0, allowed - current),
      budgetConsumed01,
      isOverBudget,
      datasetExampleCount: stats?.totalExamples ?? taskReport.exampleCount,
      datasetAverageConfidence01: 0,
    });

    totalBudgetConsumed += budgetConsumed01;
  }

  return Object.freeze({
    evaluatedAt: Date.now(),
    tasks: Object.freeze(entries),
    overBudgetTasks: Object.freeze(overBudgetTasks),
    overallBudgetConsumed01: tasks.length > 0 ? totalBudgetConsumed / tasks.length : 0,
  });
}

// ============================================================================
// MARK: Drift reconciliation — uses TrainingExample
// ============================================================================

export interface DriftReconciliationEntry {
  readonly task: TrainingTaskKey;
  readonly baselineLabelCount: number;
  readonly currentLabelCount: number;
  readonly newLabels: readonly string[];
  readonly vanishedLabels: readonly string[];
  readonly shiftedLabelCount: number;
  readonly recommendBaselineUpdate: boolean;
  readonly reason: string;
}

export interface DriftReconciliationReport {
  readonly reconciledAt: number;
  readonly tasks: Readonly<Record<TrainingTaskKey, DriftReconciliationEntry>>;
  readonly tasksRequiringBaselineUpdate: readonly TrainingTaskKey[];
}

export function buildDriftReconciliationReport(
  driftReport: DriftReport,
  rawExamplesByTask: Readonly<Record<TrainingTaskKey, readonly TrainingExample[]>>,
): DriftReconciliationReport {
  const tasks = Object.keys(driftReport.tasks) as TrainingTaskKey[];
  const entries = {} as Record<TrainingTaskKey, DriftReconciliationEntry>;
  const requiresUpdate: TrainingTaskKey[] = [];

  for (const task of tasks) {
    const taskDrift = driftReport.tasks[task];
    const baseline = taskDrift.labelDrift.baselineHistogram;
    const current = taskDrift.labelDrift.currentHistogram;
    const rawExamples = rawExamplesByTask[task] ?? [];

    const baselineLabels = new Set(Object.keys(baseline));
    const currentLabels = new Set(Object.keys(current));
    const newLabels = [...currentLabels].filter((l) => !baselineLabels.has(l));
    const vanishedLabels = [...baselineLabels].filter((l) => !currentLabels.has(l));
    const shiftedCount = taskDrift.labelDrift.changedLabels.filter(
      (shift) => shift.absoluteDelta01 >= 0.05,
    ).length;

    const recommendUpdate = (
      newLabels.length > 0
      || vanishedLabels.length > 0
      || taskDrift.driftScore01 >= 0.55
      || rawExamples.length > (taskDrift.exampleCount * 2)
    );
    if (recommendUpdate) requiresUpdate.push(task);

    const reason = newLabels.length > 0
      ? `New labels detected: ${newLabels.slice(0, 3).join(', ')}.`
      : vanishedLabels.length > 0
        ? `Labels vanished: ${vanishedLabels.slice(0, 3).join(', ')}.`
        : taskDrift.driftScore01 >= 0.55
          ? `Drift score ${round(taskDrift.driftScore01, 3)} warrants baseline refresh.`
          : 'Baseline is current.';

    entries[task] = Object.freeze({
      task,
      baselineLabelCount: baselineLabels.size,
      currentLabelCount: currentLabels.size,
      newLabels: Object.freeze(newLabels),
      vanishedLabels: Object.freeze(vanishedLabels),
      shiftedLabelCount: shiftedCount,
      recommendBaselineUpdate: recommendUpdate,
      reason,
    });
  }

  return Object.freeze({
    reconciledAt: Date.now(),
    tasks: Object.freeze(entries),
    tasksRequiringBaselineUpdate: Object.freeze(requiresUpdate),
  });
}

// ============================================================================
// MARK: Drift signal bundle — runtime integration payload
// ============================================================================

export interface DriftSignalBundle {
  readonly task: TrainingTaskKey;
  readonly driftScore01: number;
  readonly severity: DriftSeverity;
  readonly disposition: DriftDisposition;
  readonly labelJsDivergence01: number;
  readonly scalarPsi01: number;
  readonly booleanDelta01: number;
  readonly categoricalJs01: number;
  readonly sequenceNovelty01: number;
  readonly shapeDelta01: number;
  readonly triggeredReasonCount: number;
  readonly topTriggeredReason: string | null;
  readonly isActionable: boolean;
  readonly builtAt: number;
}

export function buildDriftSignalBundle(report: TaskDriftReport): DriftSignalBundle {
  return Object.freeze({
    task: report.task,
    driftScore01: report.driftScore01,
    severity: report.severity,
    disposition: report.disposition,
    labelJsDivergence01: report.labelDrift.jsDivergence01,
    scalarPsi01: report.scalarDrift.aggregatePsi01,
    booleanDelta01: report.booleanDrift.aggregateDelta01,
    categoricalJs01: report.categoricalDrift.aggregateJs01,
    sequenceNovelty01: report.sequenceDrift.aggregateNovelty01,
    shapeDelta01: report.shapeDrift.aggregateDelta01,
    triggeredReasonCount: report.triggeredReasons.length,
    topTriggeredReason: report.triggeredReasons[0] ?? null,
    isActionable: report.disposition !== 'STABLE',
    builtAt: Date.now(),
  });
}

export function buildAllDriftSignalBundles(
  driftReport: DriftReport,
): Readonly<Record<TrainingTaskKey, DriftSignalBundle>> {
  const result = {} as Record<TrainingTaskKey, DriftSignalBundle>;
  for (const task of Object.keys(driftReport.tasks) as TrainingTaskKey[]) {
    result[task] = buildDriftSignalBundle(driftReport.tasks[task]);
  }
  return Object.freeze(result);
}

// ============================================================================
// MARK: Drift monitor session
// ============================================================================

export interface DriftSessionEntry {
  readonly cycleIndex: number;
  readonly report: DriftReport;
  readonly signalBundles: Readonly<Record<TrainingTaskKey, DriftSignalBundle>>;
  readonly recordedAt: number;
}

export interface DriftSessionSummary {
  readonly cycleCount: number;
  readonly firstCycleAt: number | null;
  readonly lastCycleAt: number | null;
  readonly averageDrift01: number;
  readonly peakDrift01: number;
  readonly currentDisposition: DriftDisposition;
  readonly trendsByTask: Readonly<Record<TrainingTaskKey, DriftTrendReport>>;
  readonly alertsByTask: Readonly<Record<TrainingTaskKey, DriftAlertEvent>>;
}

export class DriftMonitorSession {
  private readonly monitor: DriftMonitor;
  private readonly entries: DriftSessionEntry[] = [];
  private readonly historyByTask: Map<TrainingTaskKey, TaskDriftReport[]> = new Map();

  public constructor(options: DriftMonitorOptions = {}) {
    this.monitor = new DriftMonitor(options);
  }

  public addCycle(bundle: TrainedPolicyBundle, corpus: LabeledTrainingCorpus): DriftReport {
    const report = this.monitor.analyzeAgainstBundle(bundle, corpus);
    const signalBundles = buildAllDriftSignalBundles(report);

    for (const task of Object.keys(report.tasks) as TrainingTaskKey[]) {
      if (!this.historyByTask.has(task)) this.historyByTask.set(task, []);
      this.historyByTask.get(task)!.push(report.tasks[task]);
    }

    this.entries.push(Object.freeze({
      cycleIndex: this.entries.length,
      report,
      signalBundles,
      recordedAt: Date.now(),
    }));
    return report;
  }

  public summarize(alertThresholds: DriftAlertThresholds = DEFAULT_DRIFT_ALERT_THRESHOLDS): DriftSessionSummary {
    if (this.entries.length === 0) {
      return Object.freeze({
        cycleCount: 0,
        firstCycleAt: null,
        lastCycleAt: null,
        averageDrift01: 0,
        peakDrift01: 0,
        currentDisposition: 'STABLE',
        trendsByTask: Object.freeze({}) as Readonly<Record<TrainingTaskKey, DriftTrendReport>>,
        alertsByTask: Object.freeze({}) as Readonly<Record<TrainingTaskKey, DriftAlertEvent>>,
      });
    }

    const allDriftScores = this.entries.flatMap((entry) =>
      Object.values(entry.report.tasks).map((t) => t.driftScore01),
    );
    const latest = this.entries[this.entries.length - 1];
    const historyObj = {} as Record<TrainingTaskKey, readonly TaskDriftReport[]>;
    for (const [task, history] of this.historyByTask.entries()) {
      historyObj[task] = Object.freeze([...history]);
    }

    const trendsByTask = {} as Record<TrainingTaskKey, DriftTrendReport>;
    const alertsByTask = {} as Record<TrainingTaskKey, DriftAlertEvent>;
    for (const task of Object.keys(historyObj) as TrainingTaskKey[]) {
      trendsByTask[task] = buildDriftTrendReport(task, historyObj[task]);
      alertsByTask[task] = evaluateDriftAlert(trendsByTask[task], alertThresholds);
    }

    return Object.freeze({
      cycleCount: this.entries.length,
      firstCycleAt: this.entries[0].recordedAt,
      lastCycleAt: latest.recordedAt,
      averageDrift01: mean(allDriftScores),
      peakDrift01: Math.max(...allDriftScores),
      currentDisposition: latest.report.overall.disposition,
      trendsByTask: Object.freeze(trendsByTask),
      alertsByTask: Object.freeze(alertsByTask),
    });
  }

  public getCycleCount(): number {
    return this.entries.length;
  }

  public getLatestReport(): DriftReport | null {
    return this.entries[this.entries.length - 1]?.report ?? null;
  }
}

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const CHAT_DRIFT_MONITOR_VERSION = '2026.03.14' as const;

export const ChatDriftMonitorModule = Object.freeze({
  version: CHAT_DRIFT_MONITOR_VERSION,
  DriftMonitor,
  DriftMonitorSession,
  buildDriftTrendReport,
  buildAllDriftTrendReports,
  evaluateDriftAlert,
  buildDriftBudgetState,
  buildDriftReconciliationReport,
  buildDriftSignalBundle,
  buildAllDriftSignalBundles,
  DEFAULT_DRIFT_ALERT_THRESHOLDS,
});

// ============================================================================
// MARK: Drift cross-bundle comparison
// ============================================================================

export interface DriftBundleComparison {
  readonly task: TrainingTaskKey;
  readonly priorDriftScore01: number;
  readonly currentDriftScore01: number;
  readonly driftDelta: number;
  readonly priorDisposition: DriftDisposition;
  readonly currentDisposition: DriftDisposition;
  readonly dispositionChanged: boolean;
  readonly improved: boolean;
  readonly worsened: boolean;
  readonly deltaLabelJs01: number;
  readonly deltaScalarPsi01: number;
  readonly deltaSequenceNovelty01: number;
}

export interface DriftBundleComparisonReport {
  readonly comparedAt: number;
  readonly tasks: Readonly<Record<TrainingTaskKey, DriftBundleComparison>>;
  readonly improvedTaskCount: number;
  readonly worsenedTaskCount: number;
  readonly stableTaskCount: number;
  readonly overallDriftDelta: number;
  readonly summary: readonly string[];
}

export function compareDriftReports(
  prior: DriftReport,
  current: DriftReport,
): DriftBundleComparisonReport {
  const tasks = [...new Set([
    ...Object.keys(prior.tasks) as TrainingTaskKey[],
    ...Object.keys(current.tasks) as TrainingTaskKey[],
  ])];

  const comparisons = {} as Record<TrainingTaskKey, DriftBundleComparison>;
  let improvedCount = 0;
  let worsenedCount = 0;
  let stableCount = 0;
  let totalDelta = 0;

  for (const task of tasks) {
    const p = prior.tasks[task];
    const c = current.tasks[task];
    const priorScore = p?.driftScore01 ?? 0;
    const currentScore = c?.driftScore01 ?? 0;
    const delta = currentScore - priorScore;
    const improved = delta < -0.03;
    const worsened = delta > 0.03;

    if (improved) improvedCount += 1;
    else if (worsened) worsenedCount += 1;
    else stableCount += 1;

    totalDelta += delta;

    comparisons[task] = Object.freeze({
      task,
      priorDriftScore01: priorScore,
      currentDriftScore01: currentScore,
      driftDelta: round(delta, 4),
      priorDisposition: p?.disposition ?? 'STABLE',
      currentDisposition: c?.disposition ?? 'STABLE',
      dispositionChanged: p?.disposition !== c?.disposition,
      improved,
      worsened,
      deltaLabelJs01: round((c?.labelDrift.jsDivergence01 ?? 0) - (p?.labelDrift.jsDivergence01 ?? 0), 4),
      deltaScalarPsi01: round((c?.scalarDrift.aggregatePsi01 ?? 0) - (p?.scalarDrift.aggregatePsi01 ?? 0), 4),
      deltaSequenceNovelty01: round((c?.sequenceDrift.aggregateNovelty01 ?? 0) - (p?.sequenceDrift.aggregateNovelty01 ?? 0), 4),
    });
  }

  const summary: string[] = [];
  if (improvedCount > 0) summary.push(`${improvedCount} tasks improved drift posture.`);
  if (worsenedCount > 0) summary.push(`${worsenedCount} tasks worsened drift posture.`);
  if (stableCount > 0) summary.push(`${stableCount} tasks remain stable.`);
  const avgDelta = tasks.length > 0 ? totalDelta / tasks.length : 0;
  summary.push(`Overall drift delta=${round(avgDelta, 4)}.`);

  return Object.freeze({
    comparedAt: Date.now(),
    tasks: Object.freeze(comparisons),
    improvedTaskCount: improvedCount,
    worsenedTaskCount: worsenedCount,
    stableTaskCount: stableCount,
    overallDriftDelta: round(avgDelta, 4),
    summary: Object.freeze(summary),
  });
}

// ============================================================================
// MARK: Drift export utilities
// ============================================================================

export interface DriftExportRow {
  readonly task: TrainingTaskKey;
  readonly driftScore01: number;
  readonly severity: DriftSeverity;
  readonly disposition: DriftDisposition;
  readonly exampleCount: number;
  readonly labelJs01: number;
  readonly scalarPsi01: number;
  readonly booleanDelta01: number;
  readonly categoricalJs01: number;
  readonly sequenceNovelty01: number;
  readonly shapeDelta01: number;
  readonly triggeredReasonCount: number;
  readonly topReason: string;
}

export function buildDriftExportRows(driftReport: DriftReport): readonly DriftExportRow[] {
  return Object.freeze(
    (Object.keys(driftReport.tasks) as TrainingTaskKey[]).map((task) => {
      const t = driftReport.tasks[task];
      return Object.freeze({
        task,
        driftScore01: round(t.driftScore01, 4),
        severity: t.severity,
        disposition: t.disposition,
        exampleCount: t.exampleCount,
        labelJs01: round(t.labelDrift.jsDivergence01, 4),
        scalarPsi01: round(t.scalarDrift.aggregatePsi01, 4),
        booleanDelta01: round(t.booleanDrift.aggregateDelta01, 4),
        categoricalJs01: round(t.categoricalDrift.aggregateJs01, 4),
        sequenceNovelty01: round(t.sequenceDrift.aggregateNovelty01, 4),
        shapeDelta01: round(t.shapeDrift.aggregateDelta01, 4),
        triggeredReasonCount: t.triggeredReasons.length,
        topReason: t.triggeredReasons[0] ?? 'none',
      });
    }),
  );
}

export function exportDriftReportCsv(driftReport: DriftReport): string {
  const header = 'task,driftScore01,severity,disposition,exampleCount,labelJs01,scalarPsi01,booleanDelta01,categoricalJs01,sequenceNovelty01,shapeDelta01,triggeredReasonCount';
  const rows = buildDriftExportRows(driftReport).map((row) => [
    row.task, row.driftScore01, row.severity, row.disposition, row.exampleCount,
    row.labelJs01, row.scalarPsi01, row.booleanDelta01, row.categoricalJs01,
    row.sequenceNovelty01, row.shapeDelta01, row.triggeredReasonCount,
  ].join(','));
  return [header, ...rows].join('\n');
}

export function exportDriftReportJson(driftReport: DriftReport, pretty = true): string {
  return JSON.stringify(driftReport, null, pretty ? 2 : 0);
}

// ============================================================================
// MARK: Drift diagnostics dashboard
// ============================================================================

export interface DriftDiagnosticsDashboard {
  readonly generatedAt: number;
  readonly overallDisposition: DriftDisposition;
  readonly overallSeverity: DriftSeverity;
  readonly taskCount: number;
  readonly stableCount: number;
  readonly watchCount: number;
  readonly retrainCount: number;
  readonly blockCount: number;
  readonly averageDrift01: number;
  readonly highestDriftTask: TrainingTaskKey | null;
  readonly highestDrift01: number;
  readonly topRecommendations: readonly string[];
  readonly signalBundles: Readonly<Record<TrainingTaskKey, DriftSignalBundle>>;
  readonly exportRows: readonly DriftExportRow[];
}

export function buildDriftDiagnosticsDashboard(driftReport: DriftReport): DriftDiagnosticsDashboard {
  const tasks = Object.values(driftReport.tasks);
  const stableCount = tasks.filter((t) => t.disposition === 'STABLE').length;
  const watchCount = tasks.filter((t) => t.disposition === 'WATCH' || t.disposition === 'REVIEW').length;
  const retrainCount = tasks.filter((t) => t.disposition === 'RETRAIN').length;
  const blockCount = tasks.filter((t) => t.disposition === 'BLOCK_DEPLOY').length;
  const averageDrift01 = mean(tasks.map((t) => t.driftScore01));

  const highestTask = tasks.reduce<TaskDriftReport | null>(
    (best, t) => (!best || t.driftScore01 > best.driftScore01) ? t : best,
    null,
  );

  const allRecs = tasks.flatMap((t) => t.recommendations.slice(0, 2));
  const topRecommendations = [...new Set(allRecs)].slice(0, 6);

  return Object.freeze({
    generatedAt: Date.now(),
    overallDisposition: driftReport.overall.disposition,
    overallSeverity: driftReport.overall.severity,
    taskCount: tasks.length,
    stableCount,
    watchCount,
    retrainCount,
    blockCount,
    averageDrift01: round(averageDrift01, 4),
    highestDriftTask: highestTask?.task ?? null,
    highestDrift01: round(highestTask?.driftScore01 ?? 0, 4),
    topRecommendations: Object.freeze(topRecommendations),
    signalBundles: buildAllDriftSignalBundles(driftReport),
    exportRows: buildDriftExportRows(driftReport),
  });
}

// ============================================================================
// MARK: Drift health summary
// ============================================================================

export type DriftHealthBand = 'HEALTHY' | 'MARGINAL' | 'DEGRADED' | 'CRITICAL';

export interface DriftHealthSummary {
  readonly evaluatedAt: number;
  readonly healthBand: DriftHealthBand;
  readonly overallDrift01: number;
  readonly stableTaskRatio01: number;
  readonly blockingTaskCount: number;
  readonly retrainingRequiredCount: number;
  readonly watchTaskCount: number;
  readonly signalStrength01: number;
  readonly topIssues: readonly string[];
  readonly actionRequired: boolean;
}

export function buildDriftHealthSummary(driftReport: DriftReport): DriftHealthSummary {
  const tasks = Object.values(driftReport.tasks);
  const n = tasks.length;
  const stableCount = tasks.filter((t) => t.disposition === 'STABLE').length;
  const blockingCount = tasks.filter((t) => t.disposition === 'BLOCK_DEPLOY').length;
  const retrainCount = tasks.filter((t) => t.disposition === 'RETRAIN').length;
  const watchCount = tasks.filter((t) => t.disposition === 'WATCH' || t.disposition === 'REVIEW').length;

  const stableRatio = n > 0 ? stableCount / n : 1;
  const overall = round(driftReport.overall.averageTaskDrift01, 4);

  const signalStrength = n > 0
    ? round(mean(tasks.map((t) => t.triggeredReasons.length > 0 ? 1 : 0)), 4)
    : 0;

  let band: DriftHealthBand;
  if (blockingCount > 0 || overall >= 0.8) {
    band = 'CRITICAL';
  } else if (retrainCount > 0 || overall >= 0.55) {
    band = 'DEGRADED';
  } else if (watchCount > 0 || overall >= 0.3) {
    band = 'MARGINAL';
  } else {
    band = 'HEALTHY';
  }

  const topIssues = tasks
    .filter((t) => t.disposition !== 'STABLE')
    .flatMap((t) => t.triggeredReasons.slice(0, 2))
    .filter((r, i, arr) => arr.indexOf(r) === i)
    .slice(0, 5);

  return Object.freeze({
    evaluatedAt: Date.now(),
    healthBand: band,
    overallDrift01: overall,
    stableTaskRatio01: round(stableRatio, 4),
    blockingTaskCount: blockingCount,
    retrainingRequiredCount: retrainCount,
    watchTaskCount: watchCount,
    signalStrength01: signalStrength,
    topIssues: Object.freeze(topIssues),
    actionRequired: band === 'DEGRADED' || band === 'CRITICAL',
  });
}

// ============================================================================
// MARK: Drift gate decision
// ============================================================================

export type DriftGateVerdict = 'PASS' | 'PASS_GUARDED' | 'HOLD' | 'BLOCK';

export interface DriftGateDecision {
  readonly decidedAt: number;
  readonly verdict: DriftGateVerdict;
  readonly overallDrift01: number;
  readonly healthBand: DriftHealthBand;
  readonly blockingTasks: readonly TrainingTaskKey[];
  readonly retrainTasks: readonly TrainingTaskKey[];
  readonly reasons: readonly string[];
  readonly gatePassedAt: number | null;
}

export function makeDriftGateDecision(
  driftReport: DriftReport,
  maxAllowedDrift01 = 0.45,
): DriftGateDecision {
  const tasks = Object.values(driftReport.tasks);
  const blockingTasks = tasks
    .filter((t) => t.disposition === 'BLOCK_DEPLOY')
    .map((t) => t.task);
  const retrainTasks = tasks
    .filter((t) => t.disposition === 'RETRAIN')
    .map((t) => t.task);

  const health = buildDriftHealthSummary(driftReport);
  const overall = round(driftReport.overall.averageTaskDrift01, 4);

  const reasons: string[] = [];
  let verdict: DriftGateVerdict;

  if (blockingTasks.length > 0) {
    reasons.push(`${blockingTasks.length} task(s) in BLOCK_DEPLOY disposition: ${blockingTasks.join(', ')}`);
    verdict = 'BLOCK';
  } else if (overall > maxAllowedDrift01) {
    reasons.push(`Overall drift ${overall.toFixed(4)} exceeds threshold ${maxAllowedDrift01.toFixed(4)}`);
    verdict = 'HOLD';
  } else if (retrainTasks.length > 0) {
    reasons.push(`${retrainTasks.length} task(s) require retraining: ${retrainTasks.join(', ')}`);
    verdict = 'HOLD';
  } else if (health.healthBand === 'MARGINAL') {
    reasons.push(`Health band is MARGINAL — proceed with monitoring`);
    verdict = 'PASS_GUARDED';
  } else {
    reasons.push(`Drift within acceptable range (${overall.toFixed(4)} ≤ ${maxAllowedDrift01.toFixed(4)})`);
    verdict = 'PASS';
  }

  const now = Date.now();
  return Object.freeze({
    decidedAt: now,
    verdict,
    overallDrift01: overall,
    healthBand: health.healthBand,
    blockingTasks: Object.freeze(blockingTasks),
    retrainTasks: Object.freeze(retrainTasks),
    reasons: Object.freeze(reasons),
    gatePassedAt: verdict === 'PASS' || verdict === 'PASS_GUARDED' ? now : null,
  });
}

// ============================================================================
// MARK: Per-task drift narrative
// ============================================================================

export interface DriftTaskNarrative {
  readonly task: TrainingTaskKey;
  readonly driftScore01: number;
  readonly severity: DriftSeverity;
  readonly disposition: DriftDisposition;
  readonly narrative: string;
  readonly bulletPoints: readonly string[];
}

export function buildDriftTaskNarrative(report: TaskDriftReport): DriftTaskNarrative {
  const bullets: string[] = [];

  if (report.labelDrift.jsDivergence01 > 0.05) {
    bullets.push(`Label distribution shifted (JS divergence ${report.labelDrift.jsDivergence01.toFixed(4)})`);
  }
  if (report.scalarDrift.aggregatePsi01 > 0.1) {
    bullets.push(`Scalar features drifted (PSI ${report.scalarDrift.aggregatePsi01.toFixed(4)})`);
  }
  if (report.booleanDrift.aggregateDelta01 > 0.08) {
    bullets.push(`Boolean signal rates changed by ${(report.booleanDrift.aggregateDelta01 * 100).toFixed(1)}%`);
  }
  if (report.sequenceDrift.aggregateNovelty01 > 0.15) {
    bullets.push(`Sequence vocabulary novelty ${(report.sequenceDrift.aggregateNovelty01 * 100).toFixed(1)}%`);
  }
  if (report.shapeDrift.aggregateDelta01 > 0.1) {
    bullets.push(`Feature shape delta ${report.shapeDrift.aggregateDelta01.toFixed(4)}`);
  }
  if (bullets.length === 0) {
    bullets.push(`No significant drift signals detected`);
  }

  const narrative =
    `Task "${report.task}" is ${report.disposition} (severity=${report.severity}, ` +
    `score=${report.driftScore01.toFixed(4)}). ` +
    bullets.join('. ') + '.';

  return Object.freeze({
    task: report.task,
    driftScore01: round(report.driftScore01, 4),
    severity: report.severity,
    disposition: report.disposition,
    narrative,
    bulletPoints: Object.freeze(bullets),
  });
}

export function buildAllDriftTaskNarratives(
  driftReport: DriftReport,
): Readonly<Record<TrainingTaskKey, DriftTaskNarrative>> {
  const result: Record<string, DriftTaskNarrative> = {};
  for (const [task, report] of Object.entries(driftReport.tasks)) {
    result[task] = buildDriftTaskNarrative(report as TaskDriftReport);
  }
  return Object.freeze(result) as Readonly<Record<TrainingTaskKey, DriftTaskNarrative>>;
}

// ============================================================================
// MARK: Canonical module object
// ============================================================================

export const ChatDriftMonitorModuleExtended = Object.freeze({
  buildDriftHealthSummary,
  makeDriftGateDecision,
  buildDriftTaskNarrative,
  buildAllDriftTaskNarratives,
  buildDriftDiagnosticsDashboard,
  buildDriftExportRows,
  exportDriftReportCsv,
  exportDriftReportJson,
  compareDriftReports,
  buildDriftBudgetState,
  buildDriftReconciliationReport,
  buildDriftSignalBundle,
  buildAllDriftSignalBundles,
  buildDriftTrendReport,
  buildAllDriftTrendReports,
  evaluateDriftAlert,
  DEFAULT_DRIFT_ALERT_THRESHOLDS,
});

// ============================================================================
// MARK: Version sentinel
// ============================================================================

/** Semantic version of the DriftMonitor module. Increment on breaking changes. */
export const CHAT_DRIFT_MONITOR_MODULE_VERSION = '2026.03.14.extended' as const;

/** Human-readable module identity string for logging and telemetry. */
export const CHAT_DRIFT_MONITOR_MODULE_ID =
  'backend/src/game/engine/chat/training/DriftMonitor#v' +
  CHAT_DRIFT_MONITOR_MODULE_VERSION as string;
