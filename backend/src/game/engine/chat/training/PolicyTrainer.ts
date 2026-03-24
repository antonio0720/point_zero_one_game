/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT POLICY TRAINER
 * FILE: backend/src/game/engine/chat/training/PolicyTrainer.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Deterministic offline policy training for the authoritative backend chat lane.
 *
 * This file turns labeled authoritative training corpora into runtime-usable
 * policy artifacts for the backend chat intelligence stack:
 *
 * - EngagementModel
 * - HaterTargetingModel
 * - HelperTimingModel
 * - ChannelAffinityModel
 * - ToxicityRiskModel
 * - ChurnRiskModel
 * - InterventionPolicyModel
 * - ResponseRankingModel
 * - ConversationMemoryModel / sequence selectors
 *
 * Doctrine
 * --------
 * 1. The trainer consumes only authoritative dataset windows and authoritative
 *    labels assembled from transcript truth, replay truth, telemetry truth,
 *    proof truth, and accepted inference traces.
 * 2. Training must be deterministic and reproducible for the same corpus.
 * 3. Output artifacts must be runtime-light enough for backend online scoring.
 * 4. Output artifacts must preserve auditability through feature weights,
 *    priors, calibration traces, and model cards.
 * 5. This trainer is not a generic ML sandbox. It is a production artifact
 *    compiler for Point Zero One chat policy.
 * 6. Model selection prefers transparent hybrid policies:
 *      - weighted scalar deltas,
 *      - boolean / categorical likelihoods,
 *      - sequence vocabulary affinity,
 *      - deterministic priors,
 *      - validation-time calibration.
 * 7. Training never mutates transcript truth or replay truth.
 *
 * Canonical fit
 * -------------
 * /backend/src/game/engine/chat/training
 *   DatasetBuilder.ts
 *   LabelAssembler.ts
 *   PolicyTrainer.ts   <-- this file
 *   DriftMonitor.ts
 *   EvaluationHarness.ts
 *
 * Runtime fit
 * -----------
 * The trainer emits artifacts meant to be consumed by:
 * - /backend/src/game/engine/chat/ml/*
 * - /backend/src/game/engine/chat/dl/*
 * - /shared/contracts/chat/learning/*
 *
 * The artifact format intentionally stays self-sufficient in phase one so it
 * can be used immediately while shared learning contracts continue to harden.
 */

import type {
  JsonValue,
  TrainingTaskKey,
  TrainingSplit,
  TrainingExample,
  TrainingTaskDataset,
  TrainingTaskDatasetStats,
  TrainingExampleFeatures,
  TrainingEvidenceRef,
} from './DatasetBuilder';

import type {
  LabeledTrainingCorpus,
  LabeledTaskDataset,
  LabeledTrainingExample,
  LabeledTaskDatasetStats,
  LabelDecision,
  LabelValue,
} from './LabelAssembler';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export type RuntimePolicyAlgorithm =
  | 'PZO_WEIGHTED_HYBRID_V1'
  | 'PZO_RANK_AFFINITY_V1'
  | 'PZO_SEQUENCE_MEMORY_V1'
  | 'PZO_MODERATION_POLICY_V1';

export type FeatureFamily = 'SCALAR' | 'BOOLEAN' | 'CATEGORICAL' | 'SEQUENCE';

export type TrainerRecommendation =
  | 'DEPLOY'
  | 'DEPLOY_WITH_GUARDRAILS'
  | 'HOLD_FOR_MORE_DATA'
  | 'RETRAIN'
  | 'DO_NOT_DEPLOY';

export interface PolicyTrainerOptions {
  readonly seed?: string;
  readonly minimumExamplesPerTask?: number;
  readonly minimumExamplesPerLabel?: number;
  readonly topScalarFeaturesPerLabel?: number;
  readonly topBooleanFeaturesPerLabel?: number;
  readonly topCategoricalValuesPerFeature?: number;
  readonly topSequenceTokensPerLabel?: number;
  readonly scalarWeightClamp?: number;
  readonly categoricalSmoothing?: number;
  readonly booleanSmoothing?: number;
  readonly sequenceSmoothing?: number;
  readonly minimumTokenLength?: number;
  readonly ignoreSequenceTokens?: readonly string[];
  readonly driftHistogramBinCount?: number;
  readonly validationCalibrationFloor?: number;
  readonly confidenceTemperature?: number;
  readonly sequenceWeightMultiplier?: number;
  readonly scalarWeightMultiplier?: number;
  readonly booleanWeightMultiplier?: number;
  readonly categoricalWeightMultiplier?: number;
  readonly includeModelCards?: boolean;
}

export interface NormalizedPolicyTrainerOptions {
  readonly seed: string;
  readonly minimumExamplesPerTask: number;
  readonly minimumExamplesPerLabel: number;
  readonly topScalarFeaturesPerLabel: number;
  readonly topBooleanFeaturesPerLabel: number;
  readonly topCategoricalValuesPerFeature: number;
  readonly topSequenceTokensPerLabel: number;
  readonly scalarWeightClamp: number;
  readonly categoricalSmoothing: number;
  readonly booleanSmoothing: number;
  readonly sequenceSmoothing: number;
  readonly minimumTokenLength: number;
  readonly ignoreSequenceTokens: readonly string[];
  readonly driftHistogramBinCount: number;
  readonly validationCalibrationFloor: number;
  readonly confidenceTemperature: number;
  readonly sequenceWeightMultiplier: number;
  readonly scalarWeightMultiplier: number;
  readonly booleanWeightMultiplier: number;
  readonly categoricalWeightMultiplier: number;
  readonly includeModelCards: boolean;
}

export interface PolicyTrainerManifest {
  readonly version: string;
  readonly trainedAt: number;
  readonly trainerSignature: string;
  readonly sourceCorpusVersion: string;
  readonly sourceLabelerVersion: string;
  readonly taskCount: number;
  readonly options: NormalizedPolicyTrainerOptions;
}

export interface TrainedPolicyBundle {
  readonly manifest: PolicyTrainerManifest;
  readonly tasks: Readonly<Record<TrainingTaskKey, TrainedTaskPolicy>>;
}

export interface TrainedTaskPolicy {
  readonly task: TrainingTaskKey;
  readonly algorithm: RuntimePolicyAlgorithm;
  readonly status: TrainerRecommendation;
  readonly labelSpace: readonly string[];
  readonly labelPriors: Readonly<Record<string, number>>;
  readonly globalFeatureDensity01: number;
  readonly scalarFeatures: Readonly<Record<string, ScalarFeaturePolicy>>;
  readonly booleanFeatures: Readonly<Record<string, BooleanFeaturePolicy>>;
  readonly categoricalFeatures: Readonly<Record<string, CategoricalFeaturePolicy>>;
  readonly sequenceFeatures: Readonly<Record<string, SequenceFeaturePolicy>>;
  readonly calibration: TaskCalibrationProfile;
  readonly evaluation: TaskEvaluationReport;
  readonly runtimeThresholds: RuntimeThresholdProfile;
  readonly positiveLabelHints: readonly string[];
  readonly negativeLabelHints: readonly string[];
  readonly modelCard: TaskModelCard | null;
  readonly driftBaseline: TaskDriftBaseline;
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ScalarFeaturePolicy {
  readonly feature: string;
  readonly family: FeatureFamily;
  readonly globalMean: number;
  readonly globalStdDev: number;
  readonly globalMin: number;
  readonly globalMax: number;
  readonly labelProfiles: Readonly<Record<string, ScalarLabelProfile>>;
  readonly overallImportance: number;
  readonly histogram: HistogramProfile;
}

export interface ScalarLabelProfile {
  readonly label: string;
  readonly count: number;
  readonly mean: number;
  readonly stdDev: number;
  readonly min: number;
  readonly max: number;
  readonly zWeight: number;
  readonly relativeWeight: number;
}

export interface BooleanFeaturePolicy {
  readonly feature: string;
  readonly family: FeatureFamily;
  readonly globalTrueRate01: number;
  readonly labelProfiles: Readonly<Record<string, BooleanLabelProfile>>;
  readonly overallImportance: number;
}

export interface BooleanLabelProfile {
  readonly label: string;
  readonly count: number;
  readonly trueRate01: number;
  readonly falseRate01: number;
  readonly logOddsWeight: number;
  readonly relativeWeight: number;
}

export interface CategoricalFeaturePolicy {
  readonly feature: string;
  readonly family: FeatureFamily;
  readonly globalHistogram: Readonly<Record<string, number>>;
  readonly labelProfiles: Readonly<Record<string, CategoricalLabelProfile>>;
  readonly overallImportance: number;
}

export interface CategoricalLabelProfile {
  readonly label: string;
  readonly count: number;
  readonly probabilities: Readonly<Record<string, number>>;
  readonly topValues: readonly CategoryWeight[];
  readonly relativeWeight: number;
}

export interface CategoryWeight {
  readonly category: string;
  readonly probability01: number;
  readonly weight: number;
}

export interface SequenceFeaturePolicy {
  readonly feature: string;
  readonly family: FeatureFamily;
  readonly globalTokenDocumentFrequency: Readonly<Record<string, number>>;
  readonly labelProfiles: Readonly<Record<string, SequenceLabelProfile>>;
  readonly overallImportance: number;
}

export interface SequenceLabelProfile {
  readonly label: string;
  readonly count: number;
  readonly tokenWeights: Readonly<Record<string, number>>;
  readonly topTokens: readonly TokenWeight[];
  readonly relativeWeight: number;
}

export interface TokenWeight {
  readonly token: string;
  readonly weight: number;
  readonly documentFrequency01: number;
}

export interface TaskCalibrationProfile {
  readonly labelConfidenceFloors: Readonly<Record<string, number>>;
  readonly confusionByLabel: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly confidenceBuckets: readonly ConfidenceBucket[];
  readonly averageValidationConfidence01: number;
  readonly calibrationError01: number;
}

export interface ConfidenceBucket {
  readonly lowerBoundInclusive01: number;
  readonly upperBoundExclusive01: number;
  readonly exampleCount: number;
  readonly averagePredictedConfidence01: number;
  readonly empiricalCorrectRate01: number;
}

export interface RuntimeThresholdProfile {
  readonly acceptThreshold01: number;
  readonly deferThreshold01: number;
  readonly shadowThreshold01: number;
  readonly escalateThreshold01: number;
  readonly abstainThreshold01: number;
}

export interface TaskEvaluationReport {
  readonly train: SplitEvaluationReport;
  readonly validation: SplitEvaluationReport;
  readonly test: SplitEvaluationReport;
  readonly overall: SplitEvaluationReport;
  readonly rankingSignals: RankingSignalSummary;
}

export interface SplitEvaluationReport {
  readonly split: TrainingSplit | 'OVERALL';
  readonly exampleCount: number;
  readonly accuracy01: number;
  readonly macroF101: number;
  readonly weightedF101: number;
  readonly averageConfidence01: number;
  readonly topErrors: readonly ErrorPattern[];
  readonly labelMetrics: Readonly<Record<string, LabelMetric>>;
}

export interface LabelMetric {
  readonly label: string;
  readonly support: number;
  readonly precision01: number;
  readonly recall01: number;
  readonly f101: number;
}

export interface ErrorPattern {
  readonly actualLabel: string;
  readonly predictedLabel: string;
  readonly count: number;
  readonly averageConfidence01: number;
}

export interface RankingSignalSummary {
  readonly strongPositiveLabels: readonly string[];
  readonly strongNegativeLabels: readonly string[];
  readonly tieRate01: number;
}

export interface TaskModelCard {
  readonly summary: string;
  readonly intendedUse: readonly string[];
  readonly notIntendedFor: readonly string[];
  readonly strongestSignals: readonly ModelCardSignal[];
  readonly weakestSignals: readonly ModelCardSignal[];
  readonly cautions: readonly string[];
  readonly deploymentNotes: readonly string[];
}

export interface ModelCardSignal {
  readonly feature: string;
  readonly family: FeatureFamily;
  readonly importance: number;
  readonly notes: readonly string[];
}

export interface TaskDriftBaseline {
  readonly labelHistogram: Readonly<Record<string, number>>;
  readonly scalarHistograms: Readonly<Record<string, HistogramProfile>>;
  readonly booleanRates: Readonly<Record<string, number>>;
  readonly categoricalHistograms: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly sequenceTopTokens: Readonly<Record<string, readonly string[]>>;
  readonly shape: BaselineShapeProfile;
}

export interface BaselineShapeProfile {
  readonly featureDensity01: number;
  readonly averageEvidenceRefs: number;
  readonly averagePreMessages: number;
  readonly averageAnchorMessages: number;
  readonly averagePostMessages: number;
  readonly averageTelemetryRecords: number;
  readonly averageReplayArtifacts: number;
  readonly averageInferenceSnapshots: number;
}

export interface HistogramProfile {
  readonly min: number;
  readonly max: number;
  readonly bins: readonly HistogramBin[];
}

export interface HistogramBin {
  readonly lowerBoundInclusive: number;
  readonly upperBoundExclusive: number;
  readonly probability01: number;
}

// ============================================================================
// MARK: Internal task training state
// ============================================================================

interface TaskTrainingState {
  readonly task: TrainingTaskKey;
  readonly dataset: LabeledTaskDataset;
  readonly trainExamples: readonly LabeledTrainingExample[];
  readonly validationExamples: readonly LabeledTrainingExample[];
  readonly testExamples: readonly LabeledTrainingExample[];
  readonly labelSpace: readonly string[];
  readonly labelPriors: Readonly<Record<string, number>>;
  readonly positiveLabelHints: readonly string[];
  readonly negativeLabelHints: readonly string[];
  readonly globalFeatureDensity01: number;
}

interface PredictionResult {
  readonly predictedLabel: string;
  readonly confidence01: number;
  readonly labelScores: Readonly<Record<string, number>>;
}

interface MutableScoreMap {
  [label: string]: number;
}

interface MutableCountMap {
  [key: string]: number;
}

interface MutableNestedCountMap {
  [key: string]: MutableCountMap;
}

interface SplitEvaluationAccumulator {
  readonly split: TrainingSplit | 'OVERALL';
  exampleCount: number;
  correctCount: number;
  confidenceTotal: number;
  readonly byActual: MutableNestedCountMap;
  readonly byPredicted: MutableNestedCountMap;
  readonly errorPatterns: MutableCountMap;
  tieCount: number;
}

const POLICY_TRAINER_VERSION = '2026.03.14' as const;

const DEFAULT_POLICY_TRAINER_OPTIONS: NormalizedPolicyTrainerOptions = Object.freeze({
  seed: 'pzo-chat-policy-trainer-2026-03-14',
  minimumExamplesPerTask: 24,
  minimumExamplesPerLabel: 3,
  topScalarFeaturesPerLabel: 24,
  topBooleanFeaturesPerLabel: 24,
  topCategoricalValuesPerFeature: 16,
  topSequenceTokensPerLabel: 48,
  scalarWeightClamp: 3.5,
  categoricalSmoothing: 0.75,
  booleanSmoothing: 0.5,
  sequenceSmoothing: 0.4,
  minimumTokenLength: 2,
  ignoreSequenceTokens: Object.freeze(['the', 'a', 'an', 'to', 'of', 'and', 'or', 'is', 'it', 'for', 'in', 'on']),
  driftHistogramBinCount: 10,
  validationCalibrationFloor: 0.2,
  confidenceTemperature: 1.15,
  sequenceWeightMultiplier: 1.15,
  scalarWeightMultiplier: 1.0,
  booleanWeightMultiplier: 0.92,
  categoricalWeightMultiplier: 0.96,
  includeModelCards: true,
});

const TASK_ALGORITHM_MAP: Readonly<Record<TrainingTaskKey, RuntimePolicyAlgorithm>> = Object.freeze({
  ENGAGEMENT: 'PZO_WEIGHTED_HYBRID_V1',
  HATER_TARGETING: 'PZO_WEIGHTED_HYBRID_V1',
  HELPER_TIMING: 'PZO_WEIGHTED_HYBRID_V1',
  CHANNEL_AFFINITY: 'PZO_WEIGHTED_HYBRID_V1',
  TOXICITY_RISK: 'PZO_WEIGHTED_HYBRID_V1',
  CHURN_RISK: 'PZO_WEIGHTED_HYBRID_V1',
  INTERVENTION_POLICY: 'PZO_WEIGHTED_HYBRID_V1',
  RESPONSE_RANKING: 'PZO_RANK_AFFINITY_V1',
  SEQUENCE_MEMORY: 'PZO_SEQUENCE_MEMORY_V1',
  MODERATION_OUTCOME: 'PZO_MODERATION_POLICY_V1',
});

// ============================================================================
// MARK: Policy trainer
// ============================================================================

export class PolicyTrainer {
  private readonly options: NormalizedPolicyTrainerOptions;

  public constructor(options: PolicyTrainerOptions = {}) {
    this.options = normalizeTrainerOptions(options);
  }

  public trainCorpus(corpus: LabeledTrainingCorpus): TrainedPolicyBundle {
    const tasks = {} as Record<TrainingTaskKey, TrainedTaskPolicy>;
    const taskKeys = Object.keys(corpus.tasks) as TrainingTaskKey[];

    for (const task of taskKeys) {
      tasks[task] = this.trainTask(task, corpus.tasks[task]);
    }

    return Object.freeze({
      manifest: Object.freeze({
        version: POLICY_TRAINER_VERSION,
        trainedAt: Date.now(),
        trainerSignature: 'backend/src/game/engine/chat/training/PolicyTrainer.ts',
        sourceCorpusVersion: readSourceCorpusVersion(corpus),
        sourceLabelerVersion: corpus.manifest.version,
        taskCount: taskKeys.length,
        options: this.options,
      }),
      tasks: Object.freeze(tasks),
    });
  }

  public trainTask(task: TrainingTaskKey, dataset: LabeledTaskDataset): TrainedTaskPolicy {
    const state = this.buildTaskState(task, dataset);
    const scalarFeatures = this.buildScalarFeaturePolicies(state);
    const booleanFeatures = this.buildBooleanFeaturePolicies(state);
    const categoricalFeatures = this.buildCategoricalFeaturePolicies(state);
    const sequenceFeatures = this.buildSequenceFeaturePolicies(state);

    const thresholds = this.buildRuntimeThresholds(state);
    const evaluation = this.evaluateTask(state, scalarFeatures, booleanFeatures, categoricalFeatures, sequenceFeatures);
    const calibration = this.buildCalibrationProfile(state, scalarFeatures, booleanFeatures, categoricalFeatures, sequenceFeatures);
    const driftBaseline = this.buildDriftBaseline(state);
    const recommendation = this.deriveRecommendation(state, evaluation);
    const modelCard = this.options.includeModelCards
      ? this.buildModelCard(state, scalarFeatures, booleanFeatures, categoricalFeatures, sequenceFeatures, evaluation, recommendation)
      : null;

    return Object.freeze({
      task,
      algorithm: TASK_ALGORITHM_MAP[task],
      status: recommendation,
      labelSpace: state.labelSpace,
      labelPriors: state.labelPriors,
      globalFeatureDensity01: state.globalFeatureDensity01,
      scalarFeatures,
      booleanFeatures,
      categoricalFeatures,
      sequenceFeatures,
      calibration,
      evaluation,
      runtimeThresholds: thresholds,
      positiveLabelHints: state.positiveLabelHints,
      negativeLabelHints: state.negativeLabelHints,
      modelCard,
      driftBaseline,
      metadata: Object.freeze({
        train_examples: state.trainExamples.length,
        validation_examples: state.validationExamples.length,
        test_examples: state.testExamples.length,
        total_examples: dataset.examples.length,
        source_stats: dataset.stats as unknown as JsonValue,
      }),
    });
  }

  public exportBundleJson(bundle: TrainedPolicyBundle): string {
    return JSON.stringify(bundle, null, 2);
  }

  public exportTaskRuntimeJson(bundle: TrainedPolicyBundle, task: TrainingTaskKey): string {
    return JSON.stringify(bundle.tasks[task], null, 2);
  }

  // ==========================================================================
  // MARK: Task-state construction
  // ==========================================================================

  private buildTaskState(task: TrainingTaskKey, dataset: LabeledTaskDataset): TaskTrainingState {
    const trainExamples = freezeArray(dataset.bySplit.TRAIN);
    const validationExamples = freezeArray(dataset.bySplit.VALIDATION);
    const testExamples = freezeArray(dataset.bySplit.TEST);
    const labelSpace = freezeArray(
      uniqueStrings(dataset.examples.map((example) => example.labels.primaryLabel)).sort(compareStrings),
    );
    const labelPriors = normalizeHistogram(
      histogram(dataset.examples.map((example) => example.labels.primaryLabel)),
    );
    const globalFeatureDensity01 = average(
      dataset.examples.map((example) => featureDensity(example.features)),
    );

    return Object.freeze({
      task,
      dataset,
      trainExamples,
      validationExamples,
      testExamples,
      labelSpace,
      labelPriors,
      positiveLabelHints: inferPositiveLabelHints(task, labelSpace),
      negativeLabelHints: inferNegativeLabelHints(task, labelSpace),
      globalFeatureDensity01,
    });
  }

  // ==========================================================================
  // MARK: Feature-policy builders
  // ==========================================================================

  private buildScalarFeaturePolicies(state: TaskTrainingState): Readonly<Record<string, ScalarFeaturePolicy>> {
    const featureNames = gatherScalarFeatureNames(state.trainExamples);
    const result: Record<string, ScalarFeaturePolicy> = {};

    for (const feature of featureNames) {
      const allValues = state.trainExamples
        .map((example) => example.features.scalar[feature])
        .filter(isFiniteNumber);

      if (allValues.length === 0) {
        continue;
      }

      const globalMean = mean(allValues);
      const globalStdDev = safeStdDev(allValues, globalMean);
      const globalMin = Math.min(...allValues);
      const globalMax = Math.max(...allValues);
      const histogramProfile = buildHistogram(allValues, this.options.driftHistogramBinCount);

      const labelProfiles: Record<string, ScalarLabelProfile> = {};
      const labelWeights: number[] = [];

      for (const label of state.labelSpace) {
        const labelValues = state.trainExamples
          .filter((example) => example.labels.primaryLabel === label)
          .map((example) => example.features.scalar[feature])
          .filter(isFiniteNumber);

        if (labelValues.length === 0) {
          continue;
        }

        const labelMean = mean(labelValues);
        const labelStdDev = safeStdDev(labelValues, labelMean);
        const zWeight = clampNumber(
          globalStdDev > 0 ? (labelMean - globalMean) / globalStdDev : 0,
          -this.options.scalarWeightClamp,
          this.options.scalarWeightClamp,
        ) * this.options.scalarWeightMultiplier;

        const relativeWeight = Math.abs(zWeight) * Math.log2(2 + labelValues.length);
        labelWeights.push(relativeWeight);

        labelProfiles[label] = Object.freeze({
          label,
          count: labelValues.length,
          mean: labelMean,
          stdDev: labelStdDev,
          min: Math.min(...labelValues),
          max: Math.max(...labelValues),
          zWeight,
          relativeWeight,
        });
      }

      result[feature] = Object.freeze({
        feature,
        family: 'SCALAR',
        globalMean,
        globalStdDev,
        globalMin,
        globalMax,
        labelProfiles: Object.freeze(labelProfiles),
        overallImportance: bounded01(mean(labelWeights) / 4),
        histogram: histogramProfile,
      });
    }

    return Object.freeze(sortRecord(result));
  }

  private buildBooleanFeaturePolicies(state: TaskTrainingState): Readonly<Record<string, BooleanFeaturePolicy>> {
    const featureNames = gatherBooleanFeatureNames(state.trainExamples);
    const result: Record<string, BooleanFeaturePolicy> = {};

    for (const feature of featureNames) {
      const allValues = state.trainExamples.map((example) => Boolean(example.features.boolean[feature]));
      const globalTrueRate01 = proportion(allValues);

      const labelProfiles: Record<string, BooleanLabelProfile> = {};
      const labelWeights: number[] = [];

      for (const label of state.labelSpace) {
        const labelExamples = state.trainExamples.filter((example) => example.labels.primaryLabel === label);
        if (labelExamples.length === 0) {
          continue;
        }

        const labelValues = labelExamples.map((example) => Boolean(example.features.boolean[feature]));
        const trueRate = smoothedProportion(
          labelValues.filter(Boolean).length,
          labelValues.length,
          this.options.booleanSmoothing,
        );
        const falseRate = 1 - trueRate;
        const globalRate = smoothedProportion(
          allValues.filter(Boolean).length,
          allValues.length,
          this.options.booleanSmoothing,
        );
        const logOddsWeight = Math.log((trueRate + 1e-9) / (globalRate + 1e-9)) * this.options.booleanWeightMultiplier;
        const relativeWeight = Math.abs(logOddsWeight) * Math.log2(2 + labelExamples.length);
        labelWeights.push(relativeWeight);

        labelProfiles[label] = Object.freeze({
          label,
          count: labelExamples.length,
          trueRate01: trueRate,
          falseRate01: falseRate,
          logOddsWeight,
          relativeWeight,
        });
      }

      result[feature] = Object.freeze({
        feature,
        family: 'BOOLEAN',
        globalTrueRate01,
        labelProfiles: Object.freeze(labelProfiles),
        overallImportance: bounded01(mean(labelWeights) / 3.5),
      });
    }

    return Object.freeze(sortRecord(result));
  }

  private buildCategoricalFeaturePolicies(state: TaskTrainingState): Readonly<Record<string, CategoricalFeaturePolicy>> {
    const featureNames = gatherCategoricalFeatureNames(state.trainExamples);
    const result: Record<string, CategoricalFeaturePolicy> = {};

    for (const feature of featureNames) {
      const globalHistogram = normalizeHistogram(
        histogram(
          state.trainExamples
            .map((example) => safeCategory(example.features.categorical[feature]))
            .filter(isNonEmptyString),
        ),
      );

      const labelProfiles: Record<string, CategoricalLabelProfile> = {};
      const labelWeights: number[] = [];

      for (const label of state.labelSpace) {
        const labelExamples = state.trainExamples.filter((example) => example.labels.primaryLabel === label);
        if (labelExamples.length === 0) {
          continue;
        }

        const values = labelExamples
          .map((example) => safeCategory(example.features.categorical[feature]))
          .filter(isNonEmptyString);

        if (values.length === 0) {
          continue;
        }

        const probabilities = smoothedHistogram(
          histogram(values),
          mergeCategoryKeys(globalHistogram, histogram(values)),
          this.options.categoricalSmoothing,
        );

        const topValues = Object.entries(probabilities)
          .sort((a, b) => compareNumbers(b[1], a[1]) || compareStrings(a[0], b[0]))
          .slice(0, this.options.topCategoricalValuesPerFeature)
          .map(([category, probability01]) =>
            Object.freeze({
              category,
              probability01,
              weight: Math.log((probability01 + 1e-9) / ((globalHistogram[category] ?? 1e-9) + 1e-9))
                * this.options.categoricalWeightMultiplier,
            }),
          );

        const relativeWeight = mean(topValues.map((item) => Math.abs(item.weight)));
        labelWeights.push(relativeWeight);

        labelProfiles[label] = Object.freeze({
          label,
          count: labelExamples.length,
          probabilities: Object.freeze(probabilities),
          topValues: Object.freeze(topValues),
          relativeWeight,
        });
      }

      result[feature] = Object.freeze({
        feature,
        family: 'CATEGORICAL',
        globalHistogram: Object.freeze(globalHistogram),
        labelProfiles: Object.freeze(labelProfiles),
        overallImportance: bounded01(mean(labelWeights) / 3),
      });
    }

    return Object.freeze(sortRecord(result));
  }

  private buildSequenceFeaturePolicies(state: TaskTrainingState): Readonly<Record<string, SequenceFeaturePolicy>> {
    const featureNames = gatherSequenceFeatureNames(state.trainExamples);
    const result: Record<string, SequenceFeaturePolicy> = {};

    for (const feature of featureNames) {
      const globalTokenDocumentFrequency = normalizeHistogram(
        documentFrequencyHistogram(
          state.trainExamples.flatMap((example) => tokenizeSequence(example.features.sequence[feature] ?? [], this.options)),
        ),
      );

      const labelProfiles: Record<string, SequenceLabelProfile> = {};
      const labelWeights: number[] = [];

      for (const label of state.labelSpace) {
        const labelExamples = state.trainExamples.filter((example) => example.labels.primaryLabel === label);
        if (labelExamples.length === 0) {
          continue;
        }

        const tokenHistogram = documentFrequencyHistogram(
          labelExamples.flatMap((example) => tokenizeSequence(example.features.sequence[feature] ?? [], this.options)),
        );

        if (Object.keys(tokenHistogram).length === 0) {
          continue;
        }

        const tokenWeights: Record<string, number> = {};
        for (const token of Object.keys(tokenHistogram)) {
          const localRate = smoothedRate(tokenHistogram[token], labelExamples.length, this.options.sequenceSmoothing);
          const globalRate = smoothedRate(
            Math.round((globalTokenDocumentFrequency[token] ?? 0) * Math.max(1, state.trainExamples.length)),
            state.trainExamples.length,
            this.options.sequenceSmoothing,
          );
          tokenWeights[token] = Math.log((localRate + 1e-9) / (globalRate + 1e-9)) * this.options.sequenceWeightMultiplier;
        }

        const topTokens = Object.entries(tokenWeights)
          .sort((a, b) => compareNumbers(Math.abs(b[1]), Math.abs(a[1])) || compareStrings(a[0], b[0]))
          .slice(0, this.options.topSequenceTokensPerLabel)
          .map(([token, weight]) =>
            Object.freeze({
              token,
              weight,
              documentFrequency01: globalTokenDocumentFrequency[token] ?? 0,
            }),
          );

        const relativeWeight = mean(topTokens.map((item) => Math.abs(item.weight)));
        labelWeights.push(relativeWeight);

        labelProfiles[label] = Object.freeze({
          label,
          count: labelExamples.length,
          tokenWeights: Object.freeze(tokenWeights),
          topTokens: Object.freeze(topTokens),
          relativeWeight,
        });
      }

      result[feature] = Object.freeze({
        feature,
        family: 'SEQUENCE',
        globalTokenDocumentFrequency: Object.freeze(globalTokenDocumentFrequency),
        labelProfiles: Object.freeze(labelProfiles),
        overallImportance: bounded01(mean(labelWeights) / 4),
      });
    }

    return Object.freeze(sortRecord(result));
  }

  // ==========================================================================
  // MARK: Evaluation / calibration / thresholds
  // ==========================================================================

  private evaluateTask(
    state: TaskTrainingState,
    scalarFeatures: Readonly<Record<string, ScalarFeaturePolicy>>,
    booleanFeatures: Readonly<Record<string, BooleanFeaturePolicy>>,
    categoricalFeatures: Readonly<Record<string, CategoricalFeaturePolicy>>,
    sequenceFeatures: Readonly<Record<string, SequenceFeaturePolicy>>,
  ): TaskEvaluationReport {
    const evaluateSplit = (split: TrainingSplit | 'OVERALL', examples: readonly LabeledTrainingExample[]): SplitEvaluationReport => {
      const accumulator: SplitEvaluationAccumulator = {
        split,
        exampleCount: 0,
        correctCount: 0,
        confidenceTotal: 0,
        byActual: Object.create(null) as MutableNestedCountMap,
        byPredicted: Object.create(null) as MutableNestedCountMap,
        errorPatterns: Object.create(null) as MutableCountMap,
        tieCount: 0,
      };

      for (const example of examples) {
        const prediction = this.predictExample(state, example, scalarFeatures, booleanFeatures, categoricalFeatures, sequenceFeatures);
        applyPrediction(accumulator, example, prediction);
      }

      return finalizeEvaluationAccumulator(accumulator, state.labelSpace);
    };

    const train = evaluateSplit('TRAIN', state.trainExamples);
    const validation = evaluateSplit('VALIDATION', state.validationExamples);
    const test = evaluateSplit('TEST', state.testExamples);
    const overall = evaluateSplit('OVERALL', state.dataset.examples);

    return Object.freeze({
      train,
      validation,
      test,
      overall,
      rankingSignals: Object.freeze({
        strongPositiveLabels: state.positiveLabelHints,
        strongNegativeLabels: state.negativeLabelHints,
        tieRate01: average([train.exampleCount ? train.topErrors.length / Math.max(1, train.exampleCount) : 0, validation.exampleCount ? validation.topErrors.length / Math.max(1, validation.exampleCount) : 0]) * 0.1,
      }),
    });
  }

  private buildCalibrationProfile(
    state: TaskTrainingState,
    scalarFeatures: Readonly<Record<string, ScalarFeaturePolicy>>,
    booleanFeatures: Readonly<Record<string, BooleanFeaturePolicy>>,
    categoricalFeatures: Readonly<Record<string, CategoricalFeaturePolicy>>,
    sequenceFeatures: Readonly<Record<string, SequenceFeaturePolicy>>,
  ): TaskCalibrationProfile {
    const examples = state.validationExamples.length > 0 ? state.validationExamples : state.trainExamples;
    const bucketCount = 8;
    const bucketSize = 1 / bucketCount;
    const buckets: ConfidenceBucket[] = [];
    const confusion: Record<string, Record<string, number>> = {};
    const labelConfidenceFloorAccumulator: Record<string, number[]> = {};

    for (const label of state.labelSpace) {
      confusion[label] = {};
      labelConfidenceFloorAccumulator[label] = [];
    }

    for (let index = 0; index < bucketCount; index += 1) {
      const lower = index * bucketSize;
      const upper = index === bucketCount - 1 ? 1.0000001 : (index + 1) * bucketSize;
      const inBucket: { predicted: PredictionResult; actual: string }[] = [];

      for (const example of examples) {
        const prediction = this.predictExample(state, example, scalarFeatures, booleanFeatures, categoricalFeatures, sequenceFeatures);
        const actual = example.labels.primaryLabel;
        incrementNestedCount(confusion, actual, prediction.predictedLabel);

        if (prediction.predictedLabel === actual) {
          labelConfidenceFloorAccumulator[actual].push(prediction.confidence01);
        }

        if (prediction.confidence01 >= lower && prediction.confidence01 < upper) {
          inBucket.push({ predicted: prediction, actual });
        }
      }

      const avgPredicted = average(inBucket.map((item) => item.predicted.confidence01));
      const empiricalCorrect = proportion(inBucket.map((item) => item.predicted.predictedLabel === item.actual));
      buckets.push(
        Object.freeze({
          lowerBoundInclusive01: lower,
          upperBoundExclusive01: Math.min(1, upper),
          exampleCount: inBucket.length,
          averagePredictedConfidence01: avgPredicted,
          empiricalCorrectRate01: empiricalCorrect,
        }),
      );
    }

    const calibrationError = average(
      buckets
        .filter((bucket) => bucket.exampleCount > 0)
        .map((bucket) => Math.abs(bucket.averagePredictedConfidence01 - bucket.empiricalCorrectRate01)),
    );

    const labelConfidenceFloors: Record<string, number> = {};
    for (const label of state.labelSpace) {
      const values = labelConfidenceFloorAccumulator[label];
      labelConfidenceFloors[label] = values.length > 0
        ? Math.max(this.options.validationCalibrationFloor, percentile(values, 0.25))
        : this.options.validationCalibrationFloor;
    }

    return Object.freeze({
      labelConfidenceFloors: Object.freeze(labelConfidenceFloors),
      confusionByLabel: freezeNestedRecord(confusion),
      confidenceBuckets: Object.freeze(buckets),
      averageValidationConfidence01: average(
        examples.map((example) =>
          this.predictExample(state, example, scalarFeatures, booleanFeatures, categoricalFeatures, sequenceFeatures).confidence01,
        ),
      ),
      calibrationError01: calibrationError,
    });
  }

  private buildRuntimeThresholds(state: TaskTrainingState): RuntimeThresholdProfile {
    const positiveBias = state.positiveLabelHints.length > 0 ? 0.04 : 0;
    const negativeBias = state.negativeLabelHints.length > 0 ? 0.02 : 0;

    return Object.freeze({
      acceptThreshold01: clamp01(0.66 + positiveBias),
      deferThreshold01: clamp01(0.54),
      shadowThreshold01: clamp01(0.72 + negativeBias),
      escalateThreshold01: clamp01(0.81 + positiveBias + negativeBias),
      abstainThreshold01: clamp01(0.42),
    });
  }

  private deriveRecommendation(state: TaskTrainingState, evaluation: TaskEvaluationReport): TrainerRecommendation {
    const exampleCount = state.dataset.examples.length;
    const labelCoverage = state.labelSpace.every((label) =>
      state.dataset.examples.filter((example) => example.labels.primaryLabel === label).length >= this.options.minimumExamplesPerLabel,
    );

    if (exampleCount < this.options.minimumExamplesPerTask) {
      return 'HOLD_FOR_MORE_DATA';
    }

    if (!labelCoverage) {
      return 'DEPLOY_WITH_GUARDRAILS';
    }

    if (evaluation.validation.accuracy01 >= 0.82 && evaluation.validation.macroF101 >= 0.76) {
      return 'DEPLOY';
    }

    if (evaluation.validation.accuracy01 >= 0.7) {
      return 'DEPLOY_WITH_GUARDRAILS';
    }

    if (evaluation.train.accuracy01 - evaluation.validation.accuracy01 > 0.18) {
      return 'RETRAIN';
    }

    return 'DO_NOT_DEPLOY';
  }

  private buildModelCard(
    state: TaskTrainingState,
    scalarFeatures: Readonly<Record<string, ScalarFeaturePolicy>>,
    booleanFeatures: Readonly<Record<string, BooleanFeaturePolicy>>,
    categoricalFeatures: Readonly<Record<string, CategoricalFeaturePolicy>>,
    sequenceFeatures: Readonly<Record<string, SequenceFeaturePolicy>>,
    evaluation: TaskEvaluationReport,
    recommendation: TrainerRecommendation,
  ): TaskModelCard {
    const allSignals = [
      ...Object.values(scalarFeatures).map((item) => toModelCardSignal(item.feature, item.family, item.overallImportance, summarizeScalarSignal(item))),
      ...Object.values(booleanFeatures).map((item) => toModelCardSignal(item.feature, item.family, item.overallImportance, summarizeBooleanSignal(item))),
      ...Object.values(categoricalFeatures).map((item) => toModelCardSignal(item.feature, item.family, item.overallImportance, summarizeCategoricalSignal(item))),
      ...Object.values(sequenceFeatures).map((item) => toModelCardSignal(item.feature, item.family, item.overallImportance, summarizeSequenceSignal(item))),
    ].sort((a, b) => compareNumbers(b.importance, a.importance) || compareStrings(a.feature, b.feature));

    const strongestSignals = Object.freeze(allSignals.slice(0, 12));
    const weakestSignals = Object.freeze(allSignals.slice(-8).reverse());

    return Object.freeze({
      summary: `${state.task} policy trained with ${state.dataset.examples.length} labeled authoritative examples using ${TASK_ALGORITHM_MAP[state.task]}.`,
      intendedUse: Object.freeze([
        'Backend authoritative online scoring.',
        'Policy inference snapshots attached to accepted chat transactions.',
        'Helper/hater/channel/moderation routing assistance.',
        'Replay-safe and telemetry-safe intervention scoring.',
      ]),
      notIntendedFor: Object.freeze([
        'Raw client-side autonomous truth writes.',
        'Replacing policy enforcement law.',
        'Direct transcript mutation without backend orchestration.',
        'Acting as the only decision source under sparse evidence.',
      ]),
      strongestSignals,
      weakestSignals,
      cautions: Object.freeze(buildModelCardCautions(state, evaluation, recommendation)),
      deploymentNotes: Object.freeze(buildDeploymentNotes(state, evaluation, recommendation)),
    });
  }

  private buildDriftBaseline(state: TaskTrainingState): TaskDriftBaseline {
    const examples = state.dataset.examples;

    const scalarHistograms: Record<string, HistogramProfile> = {};
    for (const feature of gatherScalarFeatureNames(examples)) {
      const values = examples.map((example) => example.features.scalar[feature]).filter(isFiniteNumber);
      if (values.length > 0) {
        scalarHistograms[feature] = buildHistogram(values, this.options.driftHistogramBinCount);
      }
    }

    const booleanRates: Record<string, number> = {};
    for (const feature of gatherBooleanFeatureNames(examples)) {
      booleanRates[feature] = proportion(examples.map((example) => Boolean(example.features.boolean[feature])));
    }

    const categoricalHistograms: Record<string, Record<string, number>> = {};
    for (const feature of gatherCategoricalFeatureNames(examples)) {
      categoricalHistograms[feature] = normalizeHistogram(
        histogram(examples.map((example) => safeCategory(example.features.categorical[feature])).filter(isNonEmptyString)),
      );
    }

    const sequenceTopTokens: Record<string, readonly string[]> = {};
    for (const feature of gatherSequenceFeatureNames(examples)) {
      const tokens = examples.flatMap((example) => tokenizeSequence(example.features.sequence[feature] ?? [], this.options));
      const top = Object.entries(documentFrequencyHistogram(tokens))
        .sort((a, b) => compareNumbers(b[1], a[1]) || compareStrings(a[0], b[0]))
        .slice(0, this.options.topSequenceTokensPerLabel)
        .map(([token]) => token);
      sequenceTopTokens[feature] = Object.freeze(top);
    }

    return Object.freeze({
      labelHistogram: normalizeHistogram(histogram(examples.map((example) => example.labels.primaryLabel))),
      scalarHistograms: Object.freeze(sortRecord(scalarHistograms)),
      booleanRates: Object.freeze(sortRecord(booleanRates)),
      categoricalHistograms: freezeNestedRecord(categoricalHistograms),
      sequenceTopTokens: Object.freeze(sortRecord(sequenceTopTokens)),
      shape: Object.freeze({
        featureDensity01: average(examples.map((example) => featureDensity(example.features))),
        averageEvidenceRefs: average(examples.map((example) => example.window.evidence.length)),
        averagePreMessages: average(examples.map((example) => example.window.preMessages.length)),
        averageAnchorMessages: average(examples.map((example) => example.window.anchorMessages.length)),
        averagePostMessages: average(examples.map((example) => example.window.postMessages.length)),
        averageTelemetryRecords: average(examples.map((example) => example.window.telemetry.length)),
        averageReplayArtifacts: average(examples.map((example) => example.window.replayArtifacts.length)),
        averageInferenceSnapshots: average(examples.map((example) => example.window.inferenceSnapshots.length)),
      }),
    });
  }

  // ==========================================================================
  // MARK: Prediction
  // ==========================================================================

  public predictWithPolicy(policy: TrainedTaskPolicy, example: LabeledTrainingExample): PredictionResult {
    const pseudoState: TaskTrainingState = Object.freeze({
      task: policy.task,
      dataset: {
        task: policy.task,
        examples: Object.freeze([example]),
        bySplit: Object.freeze({
          TRAIN: Object.freeze([]),
          VALIDATION: Object.freeze([]),
          TEST: Object.freeze([]),
        }),
        stats: emptyLabeledDatasetStats(policy.task),
      },
      trainExamples: Object.freeze([]),
      validationExamples: Object.freeze([]),
      testExamples: Object.freeze([]),
      labelSpace: policy.labelSpace,
      labelPriors: policy.labelPriors,
      positiveLabelHints: policy.positiveLabelHints,
      negativeLabelHints: policy.negativeLabelHints,
      globalFeatureDensity01: policy.globalFeatureDensity01,
    });

    return this.predictExample(
      pseudoState,
      example,
      policy.scalarFeatures,
      policy.booleanFeatures,
      policy.categoricalFeatures,
      policy.sequenceFeatures,
    );
  }

  private predictExample(
    state: TaskTrainingState,
    example: LabeledTrainingExample,
    scalarFeatures: Readonly<Record<string, ScalarFeaturePolicy>>,
    booleanFeatures: Readonly<Record<string, BooleanFeaturePolicy>>,
    categoricalFeatures: Readonly<Record<string, CategoricalFeaturePolicy>>,
    sequenceFeatures: Readonly<Record<string, SequenceFeaturePolicy>>,
  ): PredictionResult {
    const scores: MutableScoreMap = {};

    for (const label of state.labelSpace) {
      scores[label] = Math.log((state.labelPriors[label] ?? 1e-9) + 1e-9);
    }

    for (const policy of Object.values(scalarFeatures)) {
      const value = example.features.scalar[policy.feature];
      if (!isFiniteNumber(value)) {
        continue;
      }

      for (const label of state.labelSpace) {
        const profile = policy.labelProfiles[label];
        if (!profile) {
          continue;
        }

        const distancePenalty = policy.globalStdDev > 0
          ? Math.abs(value - profile.mean) / Math.max(policy.globalStdDev, 1e-9)
          : 0;
        const scoreContribution =
          (profile.zWeight * 0.22) +
          ((1 / (1 + distancePenalty)) - 0.5) * policy.overallImportance * 1.5;
        scores[label] += scoreContribution;
      }
    }

    for (const policy of Object.values(booleanFeatures)) {
      const value = Boolean(example.features.boolean[policy.feature]);

      for (const label of state.labelSpace) {
        const profile = policy.labelProfiles[label];
        if (!profile) {
          continue;
        }

        scores[label] += value
          ? profile.logOddsWeight * (0.9 + policy.overallImportance)
          : (-profile.logOddsWeight * 0.4) * (0.6 + policy.overallImportance);
      }
    }

    for (const policy of Object.values(categoricalFeatures)) {
      const value = safeCategory(example.features.categorical[policy.feature]);
      if (!isNonEmptyString(value)) {
        continue;
      }

      for (const label of state.labelSpace) {
        const profile = policy.labelProfiles[label];
        if (!profile) {
          continue;
        }

        const probability = profile.probabilities[value] ?? 1e-9;
        const globalProbability = policy.globalHistogram[value] ?? 1e-9;
        scores[label] += Math.log((probability + 1e-9) / (globalProbability + 1e-9)) * (0.8 + policy.overallImportance);
      }
    }

    for (const policy of Object.values(sequenceFeatures)) {
      const tokens = tokenizeSequence(example.features.sequence[policy.feature] ?? [], this.options);
      if (tokens.length === 0) {
        continue;
      }

      const tokenSet = new Set(tokens);
      for (const label of state.labelSpace) {
        const profile = policy.labelProfiles[label];
        if (!profile) {
          continue;
        }

        let labelContribution = 0;
        for (const token of tokenSet) {
          labelContribution += profile.tokenWeights[token] ?? 0;
        }

        const averaged = labelContribution / Math.max(1, tokenSet.size);
        scores[label] += averaged * (0.7 + policy.overallImportance);
      }
    }

    const ordered = Object.entries(scores).sort((a, b) => compareNumbers(b[1], a[1]) || compareStrings(a[0], b[0]));
    const predictedLabel = ordered[0]?.[0] ?? state.labelSpace[0] ?? 'UNKNOWN';
    const best = ordered[0]?.[1] ?? 0;
    const second = ordered[1]?.[1] ?? best - 0.5;
    const margin = best - second;
    const confidence01 = confidenceFromMargin(margin, this.options.confidenceTemperature);

    return Object.freeze({
      predictedLabel,
      confidence01,
      labelScores: Object.freeze(Object.fromEntries(ordered)),
    });
  }
}

// ============================================================================
// MARK: Helper utilities — task semantics
// ============================================================================

function inferPositiveLabelHints(task: TrainingTaskKey, labelSpace: readonly string[]): readonly string[] {
  const taskDefaults: Readonly<Record<TrainingTaskKey, readonly string[]>> = Object.freeze({
    ENGAGEMENT: Object.freeze(['HIGH_ENGAGEMENT', 'MEDIUM_ENGAGEMENT']),
    HATER_TARGETING: Object.freeze(['FIRE_HATER']),
    HELPER_TIMING: Object.freeze(['HELP_NOW', 'HELP_SOFT', 'HELP_RECOVERY']),
    CHANNEL_AFFINITY: Object.freeze(['GLOBAL_FIT', 'SYNDICATE_FIT', 'DEAL_ROOM_FIT']),
    TOXICITY_RISK: Object.freeze(['HIGH_TOXICITY', 'TOXIC_ESCALATION']),
    CHURN_RISK: Object.freeze(['HIGH_CHURN_RISK', 'RAGE_QUIT_RISK']),
    INTERVENTION_POLICY: Object.freeze(['INTERVENE_NOW', 'RECOVERY_ROUTE', 'DE_ESCALATE']),
    RESPONSE_RANKING: Object.freeze(['TOP_RANKED', 'GOOD_RESPONSE']),
    SEQUENCE_MEMORY: Object.freeze(['MEMORY_WORTHY', 'ANCHOR_MEMORY']),
    MODERATION_OUTCOME: Object.freeze(['REJECT', 'MASK', 'REWRITE']),
  });

  const defaults = taskDefaults[task];
  const hits = defaults.filter((label) => labelSpace.includes(label));
  if (hits.length > 0) {
    return Object.freeze(hits);
  }

  return Object.freeze(
    labelSpace.filter((label) =>
      /HIGH|TOP|GOOD|FIRE|HELP|FIT|ESCALATE|REJECT|MASK|REWRITE|MEMORY/i.test(label),
    ),
  );
}

function inferNegativeLabelHints(task: TrainingTaskKey, labelSpace: readonly string[]): readonly string[] {
  const taskDefaults: Readonly<Record<TrainingTaskKey, readonly string[]>> = Object.freeze({
    ENGAGEMENT: Object.freeze(['LOW_ENGAGEMENT', 'DISENGAGED_AFTER_ANCHOR']),
    HATER_TARGETING: Object.freeze(['SUPPRESS_HATER', 'DEFER_TO_HELPER']),
    HELPER_TIMING: Object.freeze(['DO_NOT_HELP', 'HELP_SUPPRESSED']),
    CHANNEL_AFFINITY: Object.freeze(['NO_FIT']),
    TOXICITY_RISK: Object.freeze(['LOW_TOXICITY']),
    CHURN_RISK: Object.freeze(['LOW_CHURN_RISK', 'CHURN_PREVENTED']),
    INTERVENTION_POLICY: Object.freeze(['NO_INTERVENTION']),
    RESPONSE_RANKING: Object.freeze(['LOW_RANKED', 'BAD_RESPONSE']),
    SEQUENCE_MEMORY: Object.freeze(['NOT_MEMORY_WORTHY']),
    MODERATION_OUTCOME: Object.freeze(['ALLOW']),
  });

  const defaults = taskDefaults[task];
  const hits = defaults.filter((label) => labelSpace.includes(label));
  if (hits.length > 0) {
    return Object.freeze(hits);
  }

  return Object.freeze(
    labelSpace.filter((label) =>
      /LOW|NO_|SUPPRESS|DEFER|ALLOW|BAD|NOT_/i.test(label),
    ),
  );
}

// ============================================================================
// MARK: Helper utilities — dataset feature gathering
// ============================================================================

function gatherScalarFeatureNames(examples: readonly TrainingExample[]): readonly string[] {
  return uniqueStrings(examples.flatMap((example) => Object.keys(example.features.scalar))).sort(compareStrings);
}

function gatherBooleanFeatureNames(examples: readonly TrainingExample[]): readonly string[] {
  return uniqueStrings(examples.flatMap((example) => Object.keys(example.features.boolean))).sort(compareStrings);
}

function gatherCategoricalFeatureNames(examples: readonly TrainingExample[]): readonly string[] {
  return uniqueStrings(examples.flatMap((example) => Object.keys(example.features.categorical))).sort(compareStrings);
}

function gatherSequenceFeatureNames(examples: readonly TrainingExample[]): readonly string[] {
  return uniqueStrings(examples.flatMap((example) => Object.keys(example.features.sequence))).sort(compareStrings);
}

function featureDensity(features: TrainingExampleFeatures): number {
  const scalar = Object.values(features.scalar).filter(isFiniteNumber).length;
  const boolean = Object.keys(features.boolean).length;
  const categorical = Object.values(features.categorical).filter((value) => value !== null && value !== '').length;
  const sequence = Object.values(features.sequence).reduce((sum, values) => sum + values.length, 0);
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
// MARK: Helper utilities — sequence tokenization
// ============================================================================

function tokenizeSequence(values: readonly string[], options: NormalizedPolicyTrainerOptions): readonly string[] {
  const tokens: string[] = [];

  for (const raw of values) {
    const words = raw
      .toLowerCase()
      .replace(/[^a-z0-9_\-\s]+/g, ' ')
      .split(/\s+/g)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const token of words) {
      if (token.length < options.minimumTokenLength) {
        continue;
      }

      if (options.ignoreSequenceTokens.includes(token)) {
        continue;
      }

      tokens.push(token);
    }
  }

  return Object.freeze(tokens);
}

// ============================================================================
// MARK: Helper utilities — model-card summaries
// ============================================================================

function summarizeScalarSignal(policy: ScalarFeaturePolicy): readonly string[] {
  const lines: string[] = [];
  const strongest = Object.values(policy.labelProfiles)
    .sort((a, b) => compareNumbers(Math.abs(b.zWeight), Math.abs(a.zWeight)) || compareStrings(a.label, b.label))
    .slice(0, 2);

  for (const item of strongest) {
    lines.push(`${item.label} mean=${round(item.mean, 4)} zWeight=${round(item.zWeight, 4)}`);
  }

  return Object.freeze(lines);
}

function summarizeBooleanSignal(policy: BooleanFeaturePolicy): readonly string[] {
  const lines = Object.values(policy.labelProfiles)
    .sort((a, b) => compareNumbers(Math.abs(b.logOddsWeight), Math.abs(a.logOddsWeight)) || compareStrings(a.label, b.label))
    .slice(0, 2)
    .map((item) => `${item.label} trueRate=${round(item.trueRate01, 4)} logOdds=${round(item.logOddsWeight, 4)}`);
  return Object.freeze(lines);
}

function summarizeCategoricalSignal(policy: CategoricalFeaturePolicy): readonly string[] {
  const lines: string[] = [];

  for (const labelProfile of Object.values(policy.labelProfiles).slice(0, 2)) {
    const top = labelProfile.topValues.slice(0, 2).map((item) => `${item.category}:${round(item.weight, 4)}`).join(', ');
    lines.push(`${labelProfile.label} -> ${top}`);
  }

  return Object.freeze(lines);
}

function summarizeSequenceSignal(policy: SequenceFeaturePolicy): readonly string[] {
  const lines: string[] = [];

  for (const labelProfile of Object.values(policy.labelProfiles).slice(0, 2)) {
    const top = labelProfile.topTokens.slice(0, 4).map((item) => `${item.token}:${round(item.weight, 4)}`).join(', ');
    lines.push(`${labelProfile.label} -> ${top}`);
  }

  return Object.freeze(lines);
}

function toModelCardSignal(
  feature: string,
  family: FeatureFamily,
  importance: number,
  notes: readonly string[],
): ModelCardSignal {
  return Object.freeze({
    feature,
    family,
    importance,
    notes,
  });
}

function buildModelCardCautions(
  state: TaskTrainingState,
  evaluation: TaskEvaluationReport,
  recommendation: TrainerRecommendation,
): readonly string[] {
  const cautions: string[] = [];

  if (state.dataset.examples.length < 80) {
    cautions.push('Task has limited example volume; deploy behind conservative thresholds.');
  }

  if (evaluation.validation.accuracy01 < 0.7) {
    cautions.push('Validation accuracy is soft; online decisions should remain policy-gated.');
  }

  if (evaluation.validation.macroF101 < evaluation.train.macroF101 - 0.15) {
    cautions.push('Generalization gap detected between train and validation splits.');
  }

  if (recommendation === 'DEPLOY_WITH_GUARDRAILS') {
    cautions.push('Deploy only with guardrails, shadow comparisons, and post-run audit sampling.');
  }

  if (state.positiveLabelHints.length === 0 || state.negativeLabelHints.length === 0) {
    cautions.push('Task semantics inferred from labels are thin; prefer human review for threshold tuning.');
  }

  return Object.freeze(cautions);
}

function buildDeploymentNotes(
  state: TaskTrainingState,
  evaluation: TaskEvaluationReport,
  recommendation: TrainerRecommendation,
): readonly string[] {
  const notes = [
    `Recommendation: ${recommendation}.`,
    `Validation accuracy=${round(evaluation.validation.accuracy01, 4)} macroF1=${round(evaluation.validation.macroF101, 4)}.`,
    'Keep backend policy law authoritative even when runtime policy scores are high.',
    'Attach inference snapshots to proof/telemetry but do not bypass moderation/channel law.',
  ];

  if (state.task === 'RESPONSE_RANKING' || state.task === 'SEQUENCE_MEMORY') {
    notes.push('Sequence-driven tasks should keep retrieval-context gates enabled.');
  }

  if (state.task === 'MODERATION_OUTCOME') {
    notes.push('Moderation policy artifacts should shadow existing law before any threshold hardening.');
  }

  return Object.freeze(notes);
}

// ============================================================================
// MARK: Helper utilities — evaluation math
// ============================================================================

function applyPrediction(
  accumulator: SplitEvaluationAccumulator,
  example: LabeledTrainingExample,
  prediction: PredictionResult,
): void {
  accumulator.exampleCount += 1;
  accumulator.confidenceTotal += prediction.confidence01;

  const actual = example.labels.primaryLabel;
  const predicted = prediction.predictedLabel;

  incrementNestedCount(accumulator.byActual, actual, predicted);
  incrementNestedCount(accumulator.byPredicted, predicted, actual);

  if (actual === predicted) {
    accumulator.correctCount += 1;
  } else {
    const errorKey = `${actual}__TO__${predicted}`;
    accumulator.errorPatterns[errorKey] = (accumulator.errorPatterns[errorKey] ?? 0) + 1;
  }

  const scoreValues = Object.values(prediction.labelScores);
  if (scoreValues.length >= 2 && Math.abs(scoreValues[0] - scoreValues[1]) < 0.03) {
    accumulator.tieCount += 1;
  }
}

function finalizeEvaluationAccumulator(
  accumulator: SplitEvaluationAccumulator,
  labelSpace: readonly string[],
): SplitEvaluationReport {
  const accuracy = accumulator.exampleCount > 0 ? accumulator.correctCount / accumulator.exampleCount : 0;
  const labelMetrics: Record<string, LabelMetric> = {};
  const f1Values: number[] = [];
  const weightedF1Parts: number[] = [];

  for (const label of labelSpace) {
    const tp = accumulator.byActual[label]?.[label] ?? 0;
    const fp = sumValues(accumulator.byPredicted[label] ?? {}) - tp;
    const fn = sumValues(accumulator.byActual[label] ?? {}) - tp;
    const support = sumValues(accumulator.byActual[label] ?? {});
    const precision01 = tp / Math.max(1, tp + fp);
    const recall01 = tp / Math.max(1, tp + fn);
    const f101 = (2 * precision01 * recall01) / Math.max(1e-9, precision01 + recall01);

    labelMetrics[label] = Object.freeze({
      label,
      support,
      precision01,
      recall01,
      f101,
    });

    f1Values.push(f101);
    weightedF1Parts.push(f101 * support);
  }

  const errorPatterns = Object.entries(accumulator.errorPatterns)
    .sort((a, b) => compareNumbers(b[1], a[1]) || compareStrings(a[0], b[0]))
    .slice(0, 10)
    .map(([key, count]) => {
      const [actualLabel, predictedLabel] = key.split('__TO__');
      return Object.freeze({
        actualLabel,
        predictedLabel,
        count,
        averageConfidence01: 0.5,
      });
    });

  return Object.freeze({
    split: accumulator.split,
    exampleCount: accumulator.exampleCount,
    accuracy01: accuracy,
    macroF101: average(f1Values),
    weightedF101: accumulator.exampleCount > 0 ? sum(weightedF1Parts) / accumulator.exampleCount : 0,
    averageConfidence01: accumulator.exampleCount > 0 ? accumulator.confidenceTotal / accumulator.exampleCount : 0,
    topErrors: Object.freeze(errorPatterns),
    labelMetrics: Object.freeze(labelMetrics),
  });
}

// ============================================================================
// MARK: Helper utilities — drift baselines
// ============================================================================

function buildHistogram(values: readonly number[], requestedBinCount: number): HistogramProfile {
  if (values.length === 0) {
    return Object.freeze({
      min: 0,
      max: 0,
      bins: Object.freeze([]),
    });
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return Object.freeze({
      min,
      max,
      bins: Object.freeze([
        Object.freeze({
          lowerBoundInclusive: min,
          upperBoundExclusive: max + 1,
          probability01: 1,
        }),
      ]),
    });
  }

  const binCount = Math.max(4, requestedBinCount);
  const width = (max - min) / binCount;
  const counts = new Array<number>(binCount).fill(0);

  for (const value of values) {
    const rawIndex = Math.floor((value - min) / width);
    const index = Math.min(binCount - 1, Math.max(0, rawIndex));
    counts[index] += 1;
  }

  const bins: HistogramBin[] = [];
  for (let index = 0; index < binCount; index += 1) {
    const lower = min + (index * width);
    const upper = index === binCount - 1 ? max + Number.EPSILON : min + ((index + 1) * width);
    bins.push(
      Object.freeze({
        lowerBoundInclusive: lower,
        upperBoundExclusive: upper,
        probability01: counts[index] / values.length,
      }),
    );
  }

  return Object.freeze({
    min,
    max,
    bins: Object.freeze(bins),
  });
}

// ============================================================================
// MARK: Helper utilities — stats / histograms
// ============================================================================

function histogram(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function documentFrequencyHistogram(tokens: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const token of new Set(tokens)) {
    result[token] = (result[token] ?? 0) + 1;
  }
  return result;
}

function normalizeHistogram(counts: Record<string, number>): Record<string, number> {
  const total = sumValues(counts);
  if (total <= 0) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) {
    normalized[key] = value / total;
  }
  return normalized;
}

function smoothedHistogram(
  counts: Record<string, number>,
  keys: readonly string[],
  smoothing: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  const total = sumValues(counts) + (keys.length * smoothing);
  if (total <= 0) {
    return result;
  }

  for (const key of keys) {
    result[key] = ((counts[key] ?? 0) + smoothing) / total;
  }

  return result;
}

function mergeCategoryKeys(a: Record<string, number>, b: Record<string, number>): readonly string[] {
  return uniqueStrings([...Object.keys(a), ...Object.keys(b)]).sort(compareStrings);
}

function smoothedProportion(trueCount: number, totalCount: number, smoothing: number): number {
  return (trueCount + smoothing) / Math.max(1e-9, totalCount + (2 * smoothing));
}

function smoothedRate(hitCount: number, denominator: number, smoothing: number): number {
  return (hitCount + smoothing) / Math.max(1e-9, denominator + smoothing);
}

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

function average(values: readonly number[]): number {
  return mean(values);
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function sumValues(record: Record<string, number>): number {
  return sum(Object.values(record));
}

function safeStdDev(values: readonly number[], meanValue?: number): number {
  if (values.length <= 1) {
    return 0;
  }

  const avg = meanValue ?? mean(values);
  const variance = values.reduce((acc, value) => acc + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
}

function percentile(values: readonly number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort(compareNumbers);
  const index = clampNumber(q, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(isNonEmptyString))];
}

// ============================================================================
// MARK: Helper utilities — sorting / maps
// ============================================================================

function compareNumbers(a: number, b: number): number {
  return a - b;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort((a, b) => compareStrings(a[0], b[0])),
  ) as Record<string, T>;
}

function freezeNestedRecord<T>(record: Record<string, Record<string, T>>): Readonly<Record<string, Readonly<Record<string, T>>>> {
  const result: Record<string, Readonly<Record<string, T>>> = {};
  for (const [key, inner] of Object.entries(record)) {
    result[key] = Object.freeze(sortRecord(inner));
  }
  return Object.freeze(sortRecord(result));
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function incrementNestedCount(record: MutableNestedCountMap, outer: string, inner: string): void {
  record[outer] ??= Object.create(null) as MutableCountMap;
  record[outer][inner] = (record[outer][inner] ?? 0) + 1;
}

// ============================================================================
// MARK: Helper utilities — confidence / clamping
// ============================================================================

function bounded01(value: number): number {
  return clamp01(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function confidenceFromMargin(margin: number, temperature: number): number {
  const logistic = 1 / (1 + Math.exp(-(margin / Math.max(0.05, temperature))));
  return clamp01(logistic);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// ============================================================================
// MARK: Helper utilities — type guards / normalization
// ============================================================================

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function safeCategory(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

// ============================================================================
// MARK: Helper utilities — bundle manifest readers
// ============================================================================

function readSourceCorpusVersion(corpus: LabeledTrainingCorpus): string {
  return corpus.manifest.sourceCorpusVersion;
}

function emptyLabeledDatasetStats(task: TrainingTaskKey): LabeledTaskDatasetStats {
  void task;
  return Object.freeze({
    totalExamples: 0,
    averageConfidence01: 0,
    labelHistogram: Object.freeze({}),
    conflictingEvidenceCount: 0,
    weakEvidenceCount: 0,
  });
}

function normalizeTrainerOptions(options: PolicyTrainerOptions): NormalizedPolicyTrainerOptions {
  return Object.freeze({
    ...DEFAULT_POLICY_TRAINER_OPTIONS,
    ...options,
    ignoreSequenceTokens: Object.freeze([...(options.ignoreSequenceTokens ?? DEFAULT_POLICY_TRAINER_OPTIONS.ignoreSequenceTokens)]),
  });
}

// ============================================================================
// MARK: Label decision integration surface (uses LabelDecision + LabelValue)
// ============================================================================

export interface PolicyLabelDecisionSummary {
  readonly task: TrainingTaskKey;
  readonly primaryLabel: string;
  readonly confidence01: number;
  readonly conflictingEvidence: boolean;
  readonly scalarTargetCount: number;
  readonly booleanTargetCount: number;
  readonly categoricalTargetCount: number;
  readonly dominantScalarValue: LabelValue;
  readonly rationaleCount: number;
  readonly evidenceCount: number;
}

export function summarizeLabelDecision(decision: LabelDecision): PolicyLabelDecisionSummary {
  const scalarKeys = Object.keys(decision.scalarTargets);
  const boolKeys = Object.keys(decision.booleanTargets);
  const catKeys = Object.keys(decision.categoricalTargets);

  let dominantScalar: LabelValue = null;
  if (scalarKeys.length > 0) {
    const key = scalarKeys[0];
    dominantScalar = decision.scalarTargets[key] ?? null;
  }

  return Object.freeze({
    task: decision.task,
    primaryLabel: decision.primaryLabel,
    confidence01: decision.confidence01,
    conflictingEvidence: decision.conflictingEvidence,
    scalarTargetCount: scalarKeys.length,
    booleanTargetCount: boolKeys.length,
    categoricalTargetCount: catKeys.length,
    dominantScalarValue: dominantScalar,
    rationaleCount: decision.rationale.length,
    evidenceCount: decision.evidence.length,
  });
}

export function batchSummarizeLabelDecisions(
  decisions: readonly LabelDecision[],
): readonly PolicyLabelDecisionSummary[] {
  return Object.freeze(decisions.map(summarizeLabelDecision));
}

// ============================================================================
// MARK: Evidence ref audit (uses TrainingEvidenceRef)
// ============================================================================

export interface PolicyEvidenceRefAudit {
  readonly totalRefs: number;
  readonly byKind: Readonly<Record<string, number>>;
  readonly uniqueIds: number;
  readonly withTimestamp: number;
  readonly withoutTimestamp: number;
  readonly dominantKind: string | null;
}

export function auditEvidenceRefs(
  refs: readonly TrainingEvidenceRef[],
): PolicyEvidenceRefAudit {
  if (refs.length === 0) {
    return Object.freeze({
      totalRefs: 0,
      byKind: Object.freeze({}),
      uniqueIds: 0,
      withTimestamp: 0,
      withoutTimestamp: 0,
      dominantKind: null,
    });
  }

  const byKind: Record<string, number> = {};
  let withTimestamp = 0;
  let withoutTimestamp = 0;
  const ids = new Set<string>();

  for (const ref of refs) {
    byKind[ref.kind] = (byKind[ref.kind] ?? 0) + 1;
    ids.add(ref.id);
    if (ref.at !== null) {
      withTimestamp += 1;
    } else {
      withoutTimestamp += 1;
    }
  }

  const dominantKind = Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0])[0] ?? null;

  return Object.freeze({
    totalRefs: refs.length,
    byKind: Object.freeze(byKind),
    uniqueIds: ids.size,
    withTimestamp,
    withoutTimestamp,
    dominantKind,
  });
}

// ============================================================================
// MARK: Dataset training-readiness check (uses TrainingTaskDataset)
// ============================================================================

export interface PolicyDatasetReadinessCheck {
  readonly task: TrainingTaskKey;
  readonly totalExamples: number;
  readonly trainExamples: number;
  readonly validationExamples: number;
  readonly testExamples: number;
  readonly hasMinimumTrainExamples: boolean;
  readonly hasValidationSplit: boolean;
  readonly hasTestSplit: boolean;
  readonly splitBalanced: boolean;
  readonly readinessVerdict: 'READY' | 'INSUFFICIENT_DATA' | 'MISSING_SPLITS';
}

export function checkDatasetReadiness(
  dataset: TrainingTaskDataset,
  minimumTrainExamples = 20,
): PolicyDatasetReadinessCheck {
  const trainCount = dataset.bySplit['TRAIN']?.length ?? 0;
  const valCount = dataset.bySplit['VALIDATION']?.length ?? 0;
  const testCount = dataset.bySplit['TEST']?.length ?? 0;
  const total = dataset.examples.length;

  const hasMin = trainCount >= minimumTrainExamples;
  const hasVal = valCount > 0;
  const hasTest = testCount > 0;

  const splitRatio = total > 0 ? trainCount / total : 0;
  const splitBalanced = splitRatio >= 0.5 && splitRatio <= 0.85;

  let verdict: 'READY' | 'INSUFFICIENT_DATA' | 'MISSING_SPLITS';
  if (!hasMin) {
    verdict = 'INSUFFICIENT_DATA';
  } else if (!hasVal || !hasTest) {
    verdict = 'MISSING_SPLITS';
  } else {
    verdict = 'READY';
  }

  return Object.freeze({
    task: dataset.task,
    totalExamples: total,
    trainExamples: trainCount,
    validationExamples: valCount,
    testExamples: testCount,
    hasMinimumTrainExamples: hasMin,
    hasValidationSplit: hasVal,
    hasTestSplit: hasTest,
    splitBalanced,
    readinessVerdict: verdict,
  });
}

// ============================================================================
// MARK: Dataset stats accessor (uses TrainingTaskDatasetStats)
// ============================================================================

export function extractTaskDatasetStats(dataset: TrainingTaskDataset): TrainingTaskDatasetStats {
  return dataset.stats;
}

// ============================================================================
// MARK: Version sentinel
// ============================================================================

export const CHAT_POLICY_TRAINER_MODULE_VERSION = '2026.03.14.extended' as const;

export const CHAT_POLICY_TRAINER_MODULE_ID =
  'backend/src/game/engine/chat/training/PolicyTrainer#v' +
  CHAT_POLICY_TRAINER_MODULE_VERSION as string;

// ============================================================================
// MARK: Module authority object
// ============================================================================

export const ChatPolicyTrainerModule = Object.freeze({
  version: CHAT_POLICY_TRAINER_MODULE_VERSION,
  moduleId: CHAT_POLICY_TRAINER_MODULE_ID,
  PolicyTrainer,
  summarizeLabelDecision,
  batchSummarizeLabelDecisions,
  auditEvidenceRefs,
  checkDatasetReadiness,
  extractTaskDatasetStats,
});
