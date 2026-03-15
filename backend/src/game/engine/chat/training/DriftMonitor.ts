/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT DRIFT MONITOR
 * FILE: backend/src/game/engine/chat/training/DriftMonitor.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
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
