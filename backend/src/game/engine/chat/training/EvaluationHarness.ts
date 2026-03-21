/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT EVALUATION HARNESS
 * FILE: backend/src/game/engine/chat/training/EvaluationHarness.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * This file is the final offline acceptance gate for the authoritative backend
 * chat learning lane. DatasetBuilder assembles reproducible corpus truth.
 * LabelAssembler turns authoritative windows into supervised labels.
 * PolicyTrainer learns deployable task policies.
 * DriftMonitor decides whether current live behavior is diverging.
 *
 * EvaluationHarness sits above all four and answers the release question:
 *
 *   "Given this authoritative corpus, these labels, this candidate policy
 *    bundle, and optional drift against a prior deployed bundle, should this
 *    artifact ship, ship guarded, hold, retrain, or block?"
 *
 * This file is intentionally not a generic ML evaluator. It is tailored for
 * Point Zero One's chat doctrine:
 * - transcript truth is backend-owned,
 * - model outputs never bypass policy,
 * - helper/hater/channel/intervention behavior must be explainable,
 * - training gates must reflect tactical and dramaturgical quality,
 * - offline artifacts must remain deterministic and auditable.
 *
 * Evaluation doctrine encoded here
 * --------------------------------
 * 1. Evaluation must operate from authoritative chat truth only.
 * 2. Validation and test quality matter more than train quality.
 * 3. Confidence quality matters, not just accuracy.
 * 4. Runtime thresholds must be pressure-tested against replayed examples.
 * 5. Drift is part of deployability, not a separate afterthought.
 * 6. Each task gets an explicit gate card, strengths, weaknesses, and actions.
 * 7. The overall verdict must be reducible to concrete per-task evidence.
 * 8. Export artifacts must be machine-usable for CI, release gates, and audits.
 *
 * Canonical lane fit
 * ------------------
 * Long-term authorities:
 * - /shared/contracts/chat
 * - /shared/contracts/chat/learning
 * - /backend/src/game/engine/chat
 * - /pzo-server/src/chat
 *
 * This file stays entirely offline / training-side and does not claim runtime
 * authority over transcript, policy enforcement, or orchestration.
 */

import {
  DatasetBuilder,
  CHAT_TRAINING_DATASET_BUILDER_VERSION,
  type JsonValue,
  type TrainingCorpus,
  type TrainingBuildOptions,
  type TrainingRoomArtifacts,
  type TrainingTaskKey,
  type TrainingExample,
  type TrainingTaskDataset,
  type TrainingSplit,
  type TrainingExampleFeatures,
} from './DatasetBuilder';

import {
  LabelAssembler,
  type LabelAssemblyOptions,
  type LabeledTrainingCorpus,
  type LabeledTaskDataset,
  type LabeledTrainingExample,
} from './LabelAssembler';

import {
  PolicyTrainer,
  type PolicyTrainerOptions,
  type TrainedPolicyBundle,
  type TrainedTaskPolicy,
  type TaskEvaluationReport,
  type SplitEvaluationReport,
  type ScalarFeaturePolicy,
  type BooleanFeaturePolicy,
  type CategoricalFeaturePolicy,
  type SequenceFeaturePolicy,
  type RuntimeThresholdProfile,
} from './PolicyTrainer';

import {
  DriftMonitor,
  type DriftMonitorOptions,
  type DriftReport,
  type TaskDriftReport,
  type DriftDisposition,
  type DriftSeverity,
} from './DriftMonitor';

// ============================================================================
// MARK: Public contracts
// ============================================================================

export const CHAT_TRAINING_EVALUATION_HARNESS_VERSION = '2026.03.14' as const;

export type HarnessVerdict =
  | 'DEPLOY'
  | 'DEPLOY_GUARDED'
  | 'HOLD'
  | 'RETRAIN'
  | 'BLOCK';

export type HarnessRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type RuntimeDecisionBucket =
  | 'ACCEPT'
  | 'DEFER'
  | 'SHADOW'
  | 'ESCALATE'
  | 'ABSTAIN';

export interface EvaluationHarnessOptions {
  readonly dataset?: TrainingBuildOptions;
  readonly labeling?: LabelAssemblyOptions;
  readonly trainer?: PolicyTrainerOptions;
  readonly drift?: DriftMonitorOptions;
  readonly minimumValidationMacroF101?: number;
  readonly minimumValidationAccuracy01?: number;
  readonly minimumTestMacroF101?: number;
  readonly minimumTestAccuracy01?: number;
  readonly maximumCalibrationError01?: number;
  readonly minimumAverageConfidence01?: number;
  readonly minimumLabelCoverage01?: number;
  readonly maximumGuardedTasks?: number;
  readonly maximumBlockedTasks?: number;
  readonly deployScoreFloor01?: number;
  readonly guardedDeployScoreFloor01?: number;
  readonly holdScoreFloor01?: number;
  readonly driftPenaltyWeight?: number;
  readonly calibrationPenaltyWeight?: number;
  readonly thresholdPressureWeight?: number;
  readonly splitBalanceWeight?: number;
  readonly confidenceBonusWeight?: number;
  readonly featureDensityFloor01?: number;
  readonly shadowRateWarning01?: number;
  readonly abstainRateWarning01?: number;
  readonly deferRateWarning01?: number;
  readonly escalateRateWarning01?: number;
  readonly topFindingsPerTask?: number;
  readonly topExamplesPerTask?: number;
  readonly exportPrettyJson?: boolean;
}

export interface NormalizedEvaluationHarnessOptions {
  readonly dataset: TrainingBuildOptions;
  readonly labeling: LabelAssemblyOptions;
  readonly trainer: PolicyTrainerOptions;
  readonly drift: DriftMonitorOptions;
  readonly minimumValidationMacroF101: number;
  readonly minimumValidationAccuracy01: number;
  readonly minimumTestMacroF101: number;
  readonly minimumTestAccuracy01: number;
  readonly maximumCalibrationError01: number;
  readonly minimumAverageConfidence01: number;
  readonly minimumLabelCoverage01: number;
  readonly maximumGuardedTasks: number;
  readonly maximumBlockedTasks: number;
  readonly deployScoreFloor01: number;
  readonly guardedDeployScoreFloor01: number;
  readonly holdScoreFloor01: number;
  readonly driftPenaltyWeight: number;
  readonly calibrationPenaltyWeight: number;
  readonly thresholdPressureWeight: number;
  readonly splitBalanceWeight: number;
  readonly confidenceBonusWeight: number;
  readonly featureDensityFloor01: number;
  readonly shadowRateWarning01: number;
  readonly abstainRateWarning01: number;
  readonly deferRateWarning01: number;
  readonly escalateRateWarning01: number;
  readonly topFindingsPerTask: number;
  readonly topExamplesPerTask: number;
  readonly exportPrettyJson: boolean;
}

export interface EvaluationHarnessManifest {
  readonly version: string;
  readonly evaluatedAt: number;
  readonly harnessSignature: string;
  readonly builderVersion: string;
  readonly sourceCorpusVersion: string;
  readonly sourceLabelerVersion: string;
  readonly sourceTrainerVersion: string;
  readonly baselineTrainerVersion: string | null;
  readonly driftAnalyzed: boolean;
  readonly options: NormalizedEvaluationHarnessOptions;
}

export interface EvaluationHarnessReport {
  readonly manifest: EvaluationHarnessManifest;
  readonly corpus: TrainingCorpus;
  readonly labeledCorpus: LabeledTrainingCorpus;
  readonly candidateBundle: TrainedPolicyBundle;
  readonly driftReport: DriftReport | null;
  readonly overall: OverallHarnessSummary;
  readonly tasks: Readonly<Record<TrainingTaskKey, TaskHarnessReport>>;
  readonly exports: HarnessExportManifest;
}

export interface OverallHarnessSummary {
  readonly verdict: HarnessVerdict;
  readonly risk: HarnessRiskLevel;
  readonly deployScore01: number;
  readonly taskCount: number;
  readonly deployableTaskCount: number;
  readonly guardedTaskCount: number;
  readonly holdTaskCount: number;
  readonly retrainTaskCount: number;
  readonly blockedTaskCount: number;
  readonly averageValidationMacroF101: number;
  readonly averageTestMacroF101: number;
  readonly averageCalibrationError01: number;
  readonly averageTaskPressureScore01: number;
  readonly averageTaskDrift01: number;
  readonly findings: readonly string[];
  readonly actions: readonly string[];
}

export interface TaskHarnessReport {
  readonly task: TrainingTaskKey;
  readonly verdict: HarnessVerdict;
  readonly risk: HarnessRiskLevel;
  readonly deployScore01: number;
  readonly gateReasons: readonly string[];
  readonly actions: readonly string[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly evaluation: TaskEvaluationReport;
  readonly replayedEvaluation: HarnessReplayEvaluation;
  readonly drift: TaskDriftReport | null;
  readonly pressure: ThresholdPressureReport;
  readonly labelCoverage01: number;
  readonly featureDensity01: number;
  readonly representativeExamples: readonly RepresentativeExample[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface HarnessReplayEvaluation {
  readonly exampleCount: number;
  readonly overall: ReplaySplitMetrics;
  readonly bySplit: Readonly<Record<TrainingSplit, ReplaySplitMetrics>>;
  readonly calibrationError01: number;
  readonly averageTopProbability01: number;
  readonly topErrors: readonly HarnessErrorExample[];
}

export interface ReplaySplitMetrics {
  readonly split: TrainingSplit | 'OVERALL';
  readonly exampleCount: number;
  readonly accuracy01: number;
  readonly macroF101: number;
  readonly weightedF101: number;
  readonly averageConfidence01: number;
  readonly labelMetrics: Readonly<Record<string, ReplayLabelMetric>>;
}

export interface ReplayLabelMetric {
  readonly label: string;
  readonly support: number;
  readonly precision01: number;
  readonly recall01: number;
  readonly f101: number;
}

export interface HarnessErrorExample {
  readonly exampleId: string;
  readonly split: TrainingSplit;
  readonly actualLabel: string;
  readonly predictedLabel: string;
  readonly confidence01: number;
  readonly roomId: string;
  readonly sceneKey: string;
  readonly anchorKey: string;
  readonly anchorAt: number;
  readonly evidenceSummary: readonly string[];
}

export interface ThresholdPressureReport {
  readonly thresholds: RuntimeThresholdProfile;
  readonly acceptRate01: number;
  readonly deferRate01: number;
  readonly shadowRate01: number;
  readonly escalateRate01: number;
  readonly abstainRate01: number;
  readonly bucketCounts: Readonly<Record<RuntimeDecisionBucket, number>>;
  readonly pressureScore01: number;
  readonly findings: readonly string[];
}

export interface RepresentativeExample {
  readonly exampleId: string;
  readonly split: TrainingSplit;
  readonly label: string;
  readonly predictedLabel: string;
  readonly confidence01: number;
  readonly route: RuntimeDecisionBucket;
  readonly roomId: string;
  readonly sceneKey: string;
  readonly anchorKey: string;
  readonly summary: readonly string[];
}

export interface HarnessExportManifest {
  readonly reportJsonFilename: string;
  readonly candidateBundleFilename: string;
  readonly driftJsonFilename: string | null;
  readonly taskScorecardFilenames: Readonly<Record<TrainingTaskKey, string>>;
}

export interface HarnessArtifactBundle {
  readonly reportJson: string;
  readonly candidateBundleJson: string;
  readonly driftJson: string | null;
  readonly taskScorecards: Readonly<Record<TrainingTaskKey, string>>;
}

interface PolicyPrediction {
  readonly predictedLabel: string;
  readonly probabilities: Readonly<Record<string, number>>;
  readonly topProbability01: number;
  readonly decisionBucket: RuntimeDecisionBucket;
}

interface InternalReplayRow {
  readonly example: LabeledTrainingExample;
  readonly prediction: PolicyPrediction;
}

// ============================================================================
// MARK: Defaults
// ============================================================================

const DEFAULT_OPTIONS: NormalizedEvaluationHarnessOptions = Object.freeze({
  dataset: Object.freeze({}) as TrainingBuildOptions,
  labeling: Object.freeze({}) as LabelAssemblyOptions,
  trainer: Object.freeze({}) as PolicyTrainerOptions,
  drift: Object.freeze({}) as DriftMonitorOptions,
  minimumValidationMacroF101: 0.64,
  minimumValidationAccuracy01: 0.62,
  minimumTestMacroF101: 0.60,
  minimumTestAccuracy01: 0.58,
  maximumCalibrationError01: 0.18,
  minimumAverageConfidence01: 0.52,
  minimumLabelCoverage01: 0.55,
  maximumGuardedTasks: 3,
  maximumBlockedTasks: 0,
  deployScoreFloor01: 0.78,
  guardedDeployScoreFloor01: 0.66,
  holdScoreFloor01: 0.52,
  driftPenaltyWeight: 0.22,
  calibrationPenaltyWeight: 0.18,
  thresholdPressureWeight: 0.14,
  splitBalanceWeight: 0.12,
  confidenceBonusWeight: 0.08,
  featureDensityFloor01: 0.22,
  shadowRateWarning01: 0.25,
  abstainRateWarning01: 0.18,
  deferRateWarning01: 0.22,
  escalateRateWarning01: 0.22,
  topFindingsPerTask: 8,
  topExamplesPerTask: 12,
  exportPrettyJson: true,
});

// ============================================================================
// MARK: Evaluation harness
// ============================================================================

export class EvaluationHarness {
  private readonly options: NormalizedEvaluationHarnessOptions;
  private readonly builder: DatasetBuilder;
  private readonly labelAssembler: LabelAssembler;
  private readonly trainer: PolicyTrainer;
  private readonly driftMonitor: DriftMonitor;

  public constructor(options: EvaluationHarnessOptions = {}) {
    this.options = normalizeHarnessOptions(options);
    this.builder = new DatasetBuilder(this.options.dataset);
    this.labelAssembler = new LabelAssembler(this.options.labeling);
    this.trainer = new PolicyTrainer(this.options.trainer);
    this.driftMonitor = new DriftMonitor(this.options.drift);
  }

  public evaluateRoomArtifacts(
    bundles: readonly TrainingRoomArtifacts[],
    baselineBundle: TrainedPolicyBundle | null = null,
  ): EvaluationHarnessReport {
    const builder = new DatasetBuilder(this.options.dataset);
    builder.registerRoomArtifactsMany(bundles);
    const corpus = builder.buildCorpus();
    return this.evaluateCorpus(corpus, baselineBundle);
  }

  public evaluateCorpus(
    corpus: TrainingCorpus,
    baselineBundle: TrainedPolicyBundle | null = null,
  ): EvaluationHarnessReport {
    const labeledCorpus = this.labelAssembler.assembleCorpus(corpus);
    return this.evaluateLabeledCorpus(corpus, labeledCorpus, baselineBundle);
  }

  public evaluateLabeledCorpus(
    corpus: TrainingCorpus,
    labeledCorpus: LabeledTrainingCorpus,
    baselineBundle: TrainedPolicyBundle | null = null,
  ): EvaluationHarnessReport {
    const candidateBundle = this.trainer.trainCorpus(labeledCorpus);
    const driftReport = baselineBundle
      ? this.driftMonitor.analyzeAgainstBundle(baselineBundle, labeledCorpus)
      : null;

    const tasks = {} as Record<TrainingTaskKey, TaskHarnessReport>;
    const taskKeys = Object.keys(candidateBundle.tasks) as TrainingTaskKey[];

    for (const task of taskKeys) {
      const policy = candidateBundle.tasks[task];
      const labeledDataset = labeledCorpus.tasks[task];
      const driftTask = driftReport ? driftReport.tasks[task] : null;
      tasks[task] = this.evaluateTask(policy, labeledDataset, driftTask);
    }

    const exportManifest = buildExportManifest(taskKeys);

    return Object.freeze({
      manifest: Object.freeze({
        version: CHAT_TRAINING_EVALUATION_HARNESS_VERSION,
        evaluatedAt: Date.now(),
        harnessSignature: 'backend/src/game/engine/chat/training/EvaluationHarness.ts',
        builderVersion: CHAT_TRAINING_DATASET_BUILDER_VERSION,
        sourceCorpusVersion: corpus.manifest.version,
        sourceLabelerVersion: labeledCorpus.manifest.version,
        sourceTrainerVersion: candidateBundle.manifest.version,
        baselineTrainerVersion: baselineBundle ? baselineBundle.manifest.version : null,
        driftAnalyzed: driftReport !== null,
        options: this.options,
      }),
      corpus,
      labeledCorpus,
      candidateBundle,
      driftReport,
      overall: this.buildOverallSummary(tasks),
      tasks: Object.freeze(tasks),
      exports: exportManifest,
    });
  }

  public exportReportJson(report: EvaluationHarnessReport): string {
    return stringifyJson(report, this.options.exportPrettyJson);
  }

  public exportArtifacts(report: EvaluationHarnessReport): HarnessArtifactBundle {
    const taskScorecards = {} as Record<TrainingTaskKey, string>;
    const taskKeys = Object.keys(report.tasks) as TrainingTaskKey[];

    for (const task of taskKeys) {
      taskScorecards[task] = this.exportTaskScorecard(report, task);
    }

    return Object.freeze({
      reportJson: this.exportReportJson(report),
      candidateBundleJson: this.trainer.exportBundleJson(report.candidateBundle),
      driftJson: report.driftReport ? stringifyJson(report.driftReport, this.options.exportPrettyJson) : null,
      taskScorecards: Object.freeze(taskScorecards),
    });
  }

  public exportTaskScorecard(report: EvaluationHarnessReport, task: TrainingTaskKey): string {
    const taskReport = report.tasks[task];
    const lines: string[] = [];

    lines.push(`task=${taskReport.task}`);
    lines.push(`verdict=${taskReport.verdict}`);
    lines.push(`risk=${taskReport.risk}`);
    lines.push(`deploy_score_01=${formatFixed(taskReport.deployScore01)}`);
    lines.push(`validation_macro_f1_01=${formatFixed(taskReport.evaluation.validation.macroF101)}`);
    lines.push(`test_macro_f1_01=${formatFixed(taskReport.evaluation.test.macroF101)}`);
    lines.push(`replay_accuracy_01=${formatFixed(taskReport.replayedEvaluation.overall.accuracy01)}`);
    lines.push(`replay_macro_f1_01=${formatFixed(taskReport.replayedEvaluation.overall.macroF101)}`);
    lines.push(`calibration_error_01=${formatFixed(taskReport.replayedEvaluation.calibrationError01)}`);
    lines.push(`pressure_score_01=${formatFixed(taskReport.pressure.pressureScore01)}`);
    lines.push(`label_coverage_01=${formatFixed(taskReport.labelCoverage01)}`);
    lines.push(`feature_density_01=${formatFixed(taskReport.featureDensity01)}`);

    for (const reason of taskReport.gateReasons) {
      lines.push(`gate_reason=${escapeLine(reason)}`);
    }
    for (const action of taskReport.actions) {
      lines.push(`action=${escapeLine(action)}`);
    }
    for (const finding of taskReport.weaknesses) {
      lines.push(`weakness=${escapeLine(finding)}`);
    }
    for (const finding of taskReport.strengths) {
      lines.push(`strength=${escapeLine(finding)}`);
    }
    for (const example of taskReport.representativeExamples) {
      lines.push(
        `example=${escapeLine(JSON.stringify(example))}`,
      );
    }

    return `${lines.join('\n')}\n`;
  }

  // ========================================================================
  // MARK: Task evaluation
  // ========================================================================

  private evaluateTask(
    policy: TrainedTaskPolicy,
    dataset: LabeledTaskDataset,
    driftTask: TaskDriftReport | null,
  ): TaskHarnessReport {
    const replayRows = dataset.examples.map((example) => Object.freeze({
      example,
      prediction: this.predictExample(policy, example),
    }));

    const replayedEvaluation = this.buildReplayEvaluation(dataset, replayRows);
    const pressure = this.buildThresholdPressure(policy.runtimeThresholds, replayRows);
    const labelCoverage01 = labelSpaceCoverage(policy, dataset);
    const featureDensity01 = this.computeAverageFeatureDensity(dataset.examples);

    const deployScore01 = this.computeDeployScore(policy, replayedEvaluation, pressure, labelCoverage01, featureDensity01, driftTask);
    const risk = riskFromDeployScore(deployScore01, driftTask, replayedEvaluation.calibrationError01);
    const gateReasons = this.buildGateReasons(policy, replayedEvaluation, pressure, labelCoverage01, featureDensity01, driftTask);
    const strengths = this.buildStrengths(policy, replayedEvaluation, pressure, labelCoverage01, driftTask);
    const weaknesses = this.buildWeaknesses(policy, replayedEvaluation, pressure, labelCoverage01, featureDensity01, driftTask);
    const verdict = this.resolveVerdict(deployScore01, gateReasons, driftTask);
    const actions = this.buildActions(policy, verdict, weaknesses, driftTask);
    const representativeExamples = this.buildRepresentativeExamples(replayRows);

    return Object.freeze({
      task: policy.task,
      verdict,
      risk,
      deployScore01,
      gateReasons: Object.freeze(gateReasons.slice(0, this.options.topFindingsPerTask)),
      actions: Object.freeze(actions.slice(0, this.options.topFindingsPerTask)),
      strengths: Object.freeze(strengths.slice(0, this.options.topFindingsPerTask)),
      weaknesses: Object.freeze(weaknesses.slice(0, this.options.topFindingsPerTask)),
      evaluation: policy.evaluation,
      replayedEvaluation,
      drift: driftTask,
      pressure,
      labelCoverage01,
      featureDensity01,
      representativeExamples,
      metadata: Object.freeze({
        trainer_status: policy.status,
        algorithm: policy.algorithm,
        runtime_thresholds: policy.runtimeThresholds as unknown as JsonValue,
        positive_hints: policy.positiveLabelHints as unknown as JsonValue,
        negative_hints: policy.negativeLabelHints as unknown as JsonValue,
      }),
    });
  }

  private buildReplayEvaluation(
    dataset: LabeledTaskDataset,
    rows: readonly InternalReplayRow[],
  ): HarnessReplayEvaluation {
    const bySplit = Object.freeze({
      TRAIN: this.computeReplaySplit('TRAIN', rows.filter((row) => row.example.split === 'TRAIN')),
      VALIDATION: this.computeReplaySplit('VALIDATION', rows.filter((row) => row.example.split === 'VALIDATION')),
      TEST: this.computeReplaySplit('TEST', rows.filter((row) => row.example.split === 'TEST')),
    });

    const overall = this.computeReplaySplit('OVERALL', rows);
    const confidencePairs = rows.map((row) => ({
      predicted: row.prediction.topProbability01,
      correct: row.prediction.predictedLabel === row.example.labels.primaryLabel,
    }));

    const topErrors = rows
      .filter((row) => row.prediction.predictedLabel !== row.example.labels.primaryLabel)
      .sort(
        (a, b) => compareNumbers(b.prediction.topProbability01, a.prediction.topProbability01)
          || compareStrings(a.example.id, b.example.id),
      )
      .slice(0, this.options.topExamplesPerTask)
      .map((row) => Object.freeze({
        exampleId: row.example.id,
        split: row.example.split,
        actualLabel: row.example.labels.primaryLabel,
        predictedLabel: row.prediction.predictedLabel,
        confidence01: row.prediction.topProbability01,
        roomId: row.example.roomId,
        sceneKey: row.example.sceneKey,
        anchorKey: row.example.anchorKey,
        anchorAt: row.example.anchorAt,
        evidenceSummary: summarizeExampleEvidence(row.example),
      }));

    return Object.freeze({
      exampleCount: rows.length,
      overall,
      bySplit,
      calibrationError01: calibrationError(confidencePairs),
      averageTopProbability01: mean(rows.map((row) => row.prediction.topProbability01)),
      topErrors: Object.freeze(topErrors),
    });
  }

  private computeReplaySplit(
    split: TrainingSplit | 'OVERALL',
    rows: readonly InternalReplayRow[],
  ): ReplaySplitMetrics {
    const labelSpace = uniqueStrings(rows.flatMap((row) => [row.example.labels.primaryLabel, row.prediction.predictedLabel]));
    const confusion = buildConfusionMatrix(rows, labelSpace);
    const labelMetrics: Record<string, ReplayLabelMetric> = {};

    for (const label of labelSpace) {
      const tp = confusion[label]?.[label] ?? 0;
      const fp = sum(labelSpace.map((actual) => actual === label ? 0 : (confusion[actual]?.[label] ?? 0)));
      const fn = sum(labelSpace.map((predicted) => predicted === label ? 0 : (confusion[label]?.[predicted] ?? 0)));
      const support = sum(labelSpace.map((predicted) => confusion[label]?.[predicted] ?? 0));
      const precision01 = safeDivide(tp, tp + fp);
      const recall01 = safeDivide(tp, tp + fn);
      const f101 = safeF1(precision01, recall01);

      labelMetrics[label] = Object.freeze({
        label,
        support,
        precision01,
        recall01,
        f101,
      });
    }

    const accuracy01 = safeDivide(
      rows.filter((row) => row.prediction.predictedLabel === row.example.labels.primaryLabel).length,
      rows.length,
    );
    const macroF101 = mean(Object.values(labelMetrics).map((metric) => metric.f101));
    const weightedF101 = weightedMean(
      Object.values(labelMetrics).map((metric) => ({
        value: metric.f101,
        weight: metric.support,
      })),
    );

    return Object.freeze({
      split,
      exampleCount: rows.length,
      accuracy01,
      macroF101,
      weightedF101,
      averageConfidence01: mean(rows.map((row) => row.prediction.topProbability01)),
      labelMetrics: Object.freeze(sortRecord(labelMetrics)),
    });
  }

  private buildThresholdPressure(
    thresholds: RuntimeThresholdProfile,
    rows: readonly InternalReplayRow[],
  ): ThresholdPressureReport {
    const counts: Record<RuntimeDecisionBucket, number> = {
      ACCEPT: 0,
      DEFER: 0,
      SHADOW: 0,
      ESCALATE: 0,
      ABSTAIN: 0,
    };

    for (const row of rows) {
      counts[row.prediction.decisionBucket] += 1;
    }

    const total = Math.max(1, rows.length);
    const acceptRate01 = counts.ACCEPT / total;
    const deferRate01 = counts.DEFER / total;
    const shadowRate01 = counts.SHADOW / total;
    const escalateRate01 = counts.ESCALATE / total;
    const abstainRate01 = counts.ABSTAIN / total;

    const findings: string[] = [];
    if (shadowRate01 > this.options.shadowRateWarning01) {
      findings.push(`shadow routing high at ${formatPercent(shadowRate01)}.`);
    }
    if (abstainRate01 > this.options.abstainRateWarning01) {
      findings.push(`abstain routing high at ${formatPercent(abstainRate01)}.`);
    }
    if (deferRate01 > this.options.deferRateWarning01) {
      findings.push(`defer routing high at ${formatPercent(deferRate01)}.`);
    }
    if (escalateRate01 > this.options.escalateRateWarning01) {
      findings.push(`escalation routing high at ${formatPercent(escalateRate01)}.`);
    }
    if (acceptRate01 < 0.35) {
      findings.push(`accept routing low at ${formatPercent(acceptRate01)}.`);
    }

    const pressureScore01 = clamp01(
      (shadowRate01 * 0.28)
      + (abstainRate01 * 0.28)
      + (deferRate01 * 0.18)
      + (escalateRate01 * 0.12)
      + (acceptRate01 < 0.35 ? 0.14 : 0),
    );

    return Object.freeze({
      thresholds,
      acceptRate01,
      deferRate01,
      shadowRate01,
      escalateRate01,
      abstainRate01,
      bucketCounts: Object.freeze(counts),
      pressureScore01,
      findings: Object.freeze(findings),
    });
  }

  private computeDeployScore(
    policy: TrainedTaskPolicy,
    replayed: HarnessReplayEvaluation,
    pressure: ThresholdPressureReport,
    labelCoverage01: number,
    featureDensity01: number,
    driftTask: TaskDriftReport | null,
  ): number {
    const validation = replayed.bySplit.VALIDATION;
    const test = replayed.bySplit.TEST;
    const validationBlend = (validation.macroF101 * 0.55) + (validation.accuracy01 * 0.45);
    const testBlend = (test.macroF101 * 0.6) + (test.accuracy01 * 0.4);
    const splitGapPenalty = Math.abs(validation.macroF101 - test.macroF101) * this.options.splitBalanceWeight;
    const calibrationPenalty = replayed.calibrationError01 * this.options.calibrationPenaltyWeight;
    const pressurePenalty = pressure.pressureScore01 * this.options.thresholdPressureWeight;
    const driftPenalty = driftTask ? driftTask.driftScore01 * this.options.driftPenaltyWeight : 0;
    const confidenceBonus = bounded01(replayed.averageTopProbability01) * this.options.confidenceBonusWeight;
    const densityBonus = featureDensity01 >= this.options.featureDensityFloor01
      ? bounded01((featureDensity01 - this.options.featureDensityFloor01) / Math.max(1 - this.options.featureDensityFloor01, 0.0001)) * 0.05
      : -0.08;
    const coverageBonus = bounded01(labelCoverage01) * 0.05;
    const trainerBias = verdictBias(policy.status);

    return clamp01(
      (validationBlend * 0.32)
      + (testBlend * 0.34)
      + confidenceBonus
      + densityBonus
      + coverageBonus
      + trainerBias
      - splitGapPenalty
      - calibrationPenalty
      - pressurePenalty
      - driftPenalty,
    );
  }

  private resolveVerdict(
    deployScore01: number,
    gateReasons: readonly string[],
    driftTask: TaskDriftReport | null,
  ): HarnessVerdict {
    const hasBlockReason = gateReasons.some((reason) => /block|critical|failed floor/i.test(reason));
    const hasRetrainReason = gateReasons.some((reason) => /retrain|drift/i.test(reason));

    if (hasBlockReason || (driftTask?.disposition === 'BLOCK_DEPLOY')) {
      return 'BLOCK';
    }
    if (hasRetrainReason) {
      return 'RETRAIN';
    }
    if (deployScore01 >= this.options.deployScoreFloor01) {
      return 'DEPLOY';
    }
    if (deployScore01 >= this.options.guardedDeployScoreFloor01) {
      return 'DEPLOY_GUARDED';
    }
    if (deployScore01 >= this.options.holdScoreFloor01) {
      return 'HOLD';
    }
    return 'RETRAIN';
  }

  private buildGateReasons(
    policy: TrainedTaskPolicy,
    replayed: HarnessReplayEvaluation,
    pressure: ThresholdPressureReport,
    labelCoverage01: number,
    featureDensity01: number,
    driftTask: TaskDriftReport | null,
  ): readonly string[] {
    const reasons: string[] = [];
    const validation = replayed.bySplit.VALIDATION;
    const test = replayed.bySplit.TEST;

    if (validation.macroF101 < this.options.minimumValidationMacroF101) {
      reasons.push(`validation macro F1 failed floor (${formatFixed(validation.macroF101)} < ${formatFixed(this.options.minimumValidationMacroF101)}).`);
    }
    if (validation.accuracy01 < this.options.minimumValidationAccuracy01) {
      reasons.push(`validation accuracy failed floor (${formatFixed(validation.accuracy01)} < ${formatFixed(this.options.minimumValidationAccuracy01)}).`);
    }
    if (test.macroF101 < this.options.minimumTestMacroF101) {
      reasons.push(`test macro F1 failed floor (${formatFixed(test.macroF101)} < ${formatFixed(this.options.minimumTestMacroF101)}).`);
    }
    if (test.accuracy01 < this.options.minimumTestAccuracy01) {
      reasons.push(`test accuracy failed floor (${formatFixed(test.accuracy01)} < ${formatFixed(this.options.minimumTestAccuracy01)}).`);
    }
    if (replayed.calibrationError01 > this.options.maximumCalibrationError01) {
      reasons.push(`calibration error exceeded maximum (${formatFixed(replayed.calibrationError01)} > ${formatFixed(this.options.maximumCalibrationError01)}).`);
    }
    if (replayed.averageTopProbability01 < this.options.minimumAverageConfidence01) {
      reasons.push(`average confidence below floor (${formatFixed(replayed.averageTopProbability01)} < ${formatFixed(this.options.minimumAverageConfidence01)}).`);
    }
    if (labelCoverage01 < this.options.minimumLabelCoverage01) {
      reasons.push(`label coverage below floor (${formatFixed(labelCoverage01)} < ${formatFixed(this.options.minimumLabelCoverage01)}).`);
    }
    if (featureDensity01 < this.options.featureDensityFloor01) {
      reasons.push(`feature density below floor (${formatFixed(featureDensity01)} < ${formatFixed(this.options.featureDensityFloor01)}).`);
    }
    for (const finding of pressure.findings) {
      reasons.push(`threshold pressure: ${finding}`);
    }
    if (driftTask) {
      reasons.push(`drift disposition=${driftTask.disposition} severity=${driftTask.severity} drift_score_01=${formatFixed(driftTask.driftScore01)}.`);
      for (const reason of driftTask.triggeredReasons.slice(0, 3)) {
        reasons.push(`drift trigger: ${reason}`);
      }
    }
    if (policy.status === 'DO_NOT_DEPLOY') {
      reasons.push('trainer status marked task as DO_NOT_DEPLOY.');
    }
    if (policy.status === 'HOLD_FOR_MORE_DATA') {
      reasons.push('trainer status marked task as HOLD_FOR_MORE_DATA.');
    }

    return Object.freeze(uniqueStrings(reasons));
  }

  private buildStrengths(
    policy: TrainedTaskPolicy,
    replayed: HarnessReplayEvaluation,
    pressure: ThresholdPressureReport,
    labelCoverage01: number,
    driftTask: TaskDriftReport | null,
  ): readonly string[] {
    const strengths: string[] = [];
    const validation = replayed.bySplit.VALIDATION;
    const test = replayed.bySplit.TEST;

    if (validation.macroF101 >= this.options.minimumValidationMacroF101) {
      strengths.push(`validation macro F1 cleared target at ${formatFixed(validation.macroF101)}.`);
    }
    if (test.macroF101 >= this.options.minimumTestMacroF101) {
      strengths.push(`test macro F1 cleared target at ${formatFixed(test.macroF101)}.`);
    }
    if (replayed.calibrationError01 <= this.options.maximumCalibrationError01) {
      strengths.push(`calibration error remained controlled at ${formatFixed(replayed.calibrationError01)}.`);
    }
    if (labelCoverage01 >= this.options.minimumLabelCoverage01) {
      strengths.push(`label coverage strong at ${formatPercent(labelCoverage01)}.`);
    }
    if (pressure.acceptRate01 >= 0.45 && pressure.abstainRate01 <= this.options.abstainRateWarning01) {
      strengths.push(`runtime thresholds accept enough traffic without excessive abstain pressure.`);
    }
    if (!driftTask || driftTask.disposition === 'STABLE' || driftTask.disposition === 'WATCH') {
      strengths.push(`drift posture remains manageable${driftTask ? ` (${driftTask.disposition.toLowerCase()})` : ''}.`);
    }
    if (policy.modelCard?.strongestSignals?.length) {
      strengths.push(`model card exposes strong signals for runtime explainability.`);
    }

    return Object.freeze(uniqueStrings(strengths));
  }

  private buildWeaknesses(
    policy: TrainedTaskPolicy,
    replayed: HarnessReplayEvaluation,
    pressure: ThresholdPressureReport,
    labelCoverage01: number,
    featureDensity01: number,
    driftTask: TaskDriftReport | null,
  ): readonly string[] {
    const weaknesses: string[] = [];
    const validation = replayed.bySplit.VALIDATION;
    const test = replayed.bySplit.TEST;

    if (Math.abs(validation.macroF101 - test.macroF101) > 0.08) {
      weaknesses.push(`validation/test macro F1 gap widened to ${formatFixed(Math.abs(validation.macroF101 - test.macroF101))}.`);
    }
    if (replayed.topErrors.length > 0) {
      weaknesses.push(`high-confidence errors remain in replay acceptance set.`);
    }
    if (pressure.pressureScore01 >= 0.5) {
      weaknesses.push(`threshold routing pressure elevated to ${formatFixed(pressure.pressureScore01)}.`);
    }
    if (labelCoverage01 < this.options.minimumLabelCoverage01) {
      weaknesses.push(`label coverage narrow at ${formatPercent(labelCoverage01)}.`);
    }
    if (featureDensity01 < this.options.featureDensityFloor01) {
      weaknesses.push(`feature density thin at ${formatFixed(featureDensity01)}.`);
    }
    if (driftTask && (driftTask.disposition === 'RETRAIN' || driftTask.disposition === 'BLOCK_DEPLOY')) {
      weaknesses.push(`drift posture ${driftTask.disposition.toLowerCase()} with score ${formatFixed(driftTask.driftScore01)}.`);
    }
    if (policy.modelCard?.weakestSignals?.length) {
      weaknesses.push(`model card exposes weak signals that remain unstable.`);
    }

    return Object.freeze(uniqueStrings(weaknesses));
  }

  private buildActions(
    policy: TrainedTaskPolicy,
    verdict: HarnessVerdict,
    weaknesses: readonly string[],
    driftTask: TaskDriftReport | null,
  ): readonly string[] {
    const actions: string[] = [];

    switch (verdict) {
      case 'DEPLOY':
        actions.push('promote candidate bundle for this task to deployment candidate set.');
        actions.push('retain current thresholds but record replay scorecard in release notes.');
        break;
      case 'DEPLOY_GUARDED':
        actions.push('deploy guarded behind runtime observation and elevated telemetry review.');
        actions.push('attach post-deploy drift watch for this task.');
        break;
      case 'HOLD':
        actions.push('hold task from promotion until next labeled batch arrives.');
        actions.push('review high-confidence error examples and threshold routing mix.');
        break;
      case 'RETRAIN':
        actions.push('retrain task with larger or fresher authoritative corpus before promotion.');
        actions.push('review label coverage, weak signals, and threshold pressure.');
        break;
      case 'BLOCK':
        actions.push('block deployment for this task in release gate.');
        actions.push('require corrective retrain and manual review before reconsideration.');
        break;
    }

    if (driftTask && driftTask.triggeredReasons.length > 0) {
      actions.push(`review drift triggers: ${driftTask.triggeredReasons.slice(0, 2).join(' | ')}.`);
    }
    if (weaknesses.some((line) => /feature density/i.test(line))) {
      actions.push('increase evidence-rich windows or improve feature extraction density for this task.');
    }
    if (weaknesses.some((line) => /high-confidence errors/i.test(line))) {
      actions.push('inspect misclassified examples and refine label logic or feature weighting.');
    }
    if (policy.task === 'INTERVENTION_POLICY') {
      actions.push('audit helper/hater intervention false positives before broad rollout.');
    }
    if (policy.task === 'TOXICITY_RISK' || policy.task === 'MODERATION_OUTCOME') {
      actions.push('run moderation-specific false-negative review before shipping.');
    }

    return Object.freeze(uniqueStrings(actions));
  }

  private buildRepresentativeExamples(rows: readonly InternalReplayRow[]): readonly RepresentativeExample[] {
    const ordered = [...rows]
      .sort(
        (a, b) => compareNumbers(b.prediction.topProbability01, a.prediction.topProbability01)
          || compareStrings(a.example.id, b.example.id),
      )
      .slice(0, this.options.topExamplesPerTask);

    return Object.freeze(
      ordered.map((row) => Object.freeze({
        exampleId: row.example.id,
        split: row.example.split,
        label: row.example.labels.primaryLabel,
        predictedLabel: row.prediction.predictedLabel,
        confidence01: row.prediction.topProbability01,
        route: row.prediction.decisionBucket,
        roomId: row.example.roomId,
        sceneKey: row.example.sceneKey,
        anchorKey: row.example.anchorKey,
        summary: summarizeExampleEvidence(row.example),
      })),
    );
  }

  // ========================================================================
  // MARK: Prediction replay
  // ========================================================================

  private predictExample(policy: TrainedTaskPolicy, example: LabeledTrainingExample): PolicyPrediction {
    const scoreEntries = policy.labelSpace.map((label) => {
      let score = Math.log(Math.max(policy.labelPriors[label] ?? 1e-9, 1e-9));
      score += this.scoreScalarFeatures(label, example.features, policy.scalarFeatures);
      score += this.scoreBooleanFeatures(label, example.features, policy.booleanFeatures);
      score += this.scoreCategoricalFeatures(label, example.features, policy.categoricalFeatures);
      score += this.scoreSequenceFeatures(label, example.features, policy.sequenceFeatures);
      score += featureDensityBonus(example.features, policy.globalFeatureDensity01);
      return { label, score };
    });

    const probabilities = softmaxToRecord(scoreEntries);
    const top = topProbability(probabilities);
    const decisionBucket = routeByThresholds(top.probability01, policy.runtimeThresholds);

    return Object.freeze({
      predictedLabel: top.label,
      probabilities,
      topProbability01: top.probability01,
      decisionBucket,
    });
  }

  private scoreScalarFeatures(
    label: string,
    features: TrainingExampleFeatures,
    policies: Readonly<Record<string, ScalarFeaturePolicy>>,
  ): number {
    let score = 0;

    for (const [feature, value] of Object.entries(features.scalar)) {
      if (!isFiniteNumber(value)) {
        continue;
      }
      const policy = policies[feature];
      const labelProfile = policy?.labelProfiles[label];
      if (!policy || !labelProfile) {
        continue;
      }

      const denom = Math.max(policy.globalStdDev, 0.0001);
      const normalizedValue = (value - policy.globalMean) / denom;
      const targetMean = (labelProfile.mean - policy.globalMean) / denom;
      const distance = Math.abs(normalizedValue - targetMean);
      const closeness01 = 1 - clamp01(distance / 3);
      score += closeness01 * labelProfile.zWeight * Math.max(0.05, policy.overallImportance);
      score += labelProfile.relativeWeight * 0.04;
    }

    return score;
  }

  private scoreBooleanFeatures(
    label: string,
    features: TrainingExampleFeatures,
    policies: Readonly<Record<string, BooleanFeaturePolicy>>,
  ): number {
    let score = 0;

    for (const [feature, value] of Object.entries(features.boolean)) {
      const policy = policies[feature];
      const labelProfile = policy?.labelProfiles[label];
      if (!policy || !labelProfile) {
        continue;
      }

      const signedWeight = value ? labelProfile.logOddsWeight : -labelProfile.logOddsWeight * 0.5;
      score += signedWeight * Math.max(0.05, policy.overallImportance);
      score += labelProfile.relativeWeight * 0.03 * (value ? 1 : 0.5);
    }

    return score;
  }

  private scoreCategoricalFeatures(
    label: string,
    features: TrainingExampleFeatures,
    policies: Readonly<Record<string, CategoricalFeaturePolicy>>,
  ): number {
    let score = 0;

    for (const [feature, value] of Object.entries(features.categorical)) {
      if (value === null) {
        continue;
      }
      const policy = policies[feature];
      const labelProfile = policy?.labelProfiles[label];
      if (!policy || !labelProfile) {
        continue;
      }

      const probability01 = labelProfile.probabilities[value] ?? 0.000001;
      const globalProbability01 = policy.globalHistogram[value] ?? 0.000001;
      score += Math.log(probability01 / globalProbability01) * Math.max(0.05, policy.overallImportance);
      score += labelProfile.relativeWeight * 0.025;
    }

    return score;
  }

  private scoreSequenceFeatures(
    label: string,
    features: TrainingExampleFeatures,
    policies: Readonly<Record<string, SequenceFeaturePolicy>>,
  ): number {
    let score = 0;

    for (const [feature, tokens] of Object.entries(features.sequence)) {
      const policy = policies[feature];
      const labelProfile = policy?.labelProfiles[label];
      if (!policy || !labelProfile || tokens.length === 0) {
        continue;
      }

      const uniqueTokens = uniqueStrings(tokens);
      let featureScore = 0;

      for (const token of uniqueTokens) {
        const weight = labelProfile.tokenWeights[token];
        if (typeof weight === 'number') {
          featureScore += weight;
        } else if (policy.globalTokenDocumentFrequency[token]) {
          featureScore -= policy.globalTokenDocumentFrequency[token] * 0.1;
        }
      }

      const normalized = Math.tanh(featureScore / Math.max(1, uniqueTokens.length));
      score += normalized * Math.max(0.05, policy.overallImportance) * 2.2;
      score += labelProfile.relativeWeight * 0.02;
    }

    return score;
  }

  // ========================================================================
  // MARK: Overall summary
  // ========================================================================

  private buildOverallSummary(tasks: Readonly<Record<TrainingTaskKey, TaskHarnessReport>>): OverallHarnessSummary {
    const reports = Object.values(tasks);
    const taskCount = reports.length;
    const deployableTaskCount = reports.filter((task) => task.verdict === 'DEPLOY').length;
    const guardedTaskCount = reports.filter((task) => task.verdict === 'DEPLOY_GUARDED').length;
    const holdTaskCount = reports.filter((task) => task.verdict === 'HOLD').length;
    const retrainTaskCount = reports.filter((task) => task.verdict === 'RETRAIN').length;
    const blockedTaskCount = reports.filter((task) => task.verdict === 'BLOCK').length;

    const deployScore01 = mean(reports.map((task) => task.deployScore01));
    const averageValidationMacroF101 = mean(reports.map((task) => task.evaluation.validation.macroF101));
    const averageTestMacroF101 = mean(reports.map((task) => task.evaluation.test.macroF101));
    const averageCalibrationError01 = mean(reports.map((task) => task.replayedEvaluation.calibrationError01));
    const averageTaskPressureScore01 = mean(reports.map((task) => task.pressure.pressureScore01));
    const averageTaskDrift01 = mean(reports.map((task) => task.drift?.driftScore01 ?? 0));

    const findings: string[] = [];
    const actions: string[] = [];

    if (blockedTaskCount > 0) {
      findings.push(`${blockedTaskCount} tasks are block-level.`);
      actions.push('block release until block-level tasks are corrected or excluded.');
    }
    if (retrainTaskCount > 0) {
      findings.push(`${retrainTaskCount} tasks require retraining.`);
      actions.push('schedule retraining pass for flagged tasks before promotion.');
    }
    if (guardedTaskCount > this.options.maximumGuardedTasks) {
      findings.push(`guarded task count exceeded limit (${guardedTaskCount} > ${this.options.maximumGuardedTasks}).`);
      actions.push('reduce guarded tasks or split release scope.');
    }
    if (averageCalibrationError01 > this.options.maximumCalibrationError01) {
      findings.push(`average calibration error elevated at ${formatFixed(averageCalibrationError01)}.`);
      actions.push('tighten calibration before release.');
    }
    if (averageTaskPressureScore01 > 0.45) {
      findings.push(`threshold pressure elevated at ${formatFixed(averageTaskPressureScore01)}.`);
      actions.push('review runtime thresholds across tasks.');
    }
    if (averageTaskDrift01 > 0.35) {
      findings.push(`average task drift elevated at ${formatFixed(averageTaskDrift01)}.`);
      actions.push('compare candidate behavior against deployed baseline before release.');
    }
    if (deployableTaskCount === taskCount && taskCount > 0) {
      findings.push('all tasks cleared direct deploy status.');
      actions.push('candidate bundle is eligible for promotion.');
    }

    const verdict = this.resolveOverallVerdict({
      taskCount,
      deployScore01,
      guardedTaskCount,
      holdTaskCount,
      retrainTaskCount,
      blockedTaskCount,
    });
    const risk = overallRiskFromVerdict(verdict, blockedTaskCount, retrainTaskCount, averageTaskDrift01);

    return Object.freeze({
      verdict,
      risk,
      deployScore01,
      taskCount,
      deployableTaskCount,
      guardedTaskCount,
      holdTaskCount,
      retrainTaskCount,
      blockedTaskCount,
      averageValidationMacroF101,
      averageTestMacroF101,
      averageCalibrationError01,
      averageTaskPressureScore01,
      averageTaskDrift01,
      findings: Object.freeze(uniqueStrings(findings)),
      actions: Object.freeze(uniqueStrings(actions)),
    });
  }

  private resolveOverallVerdict(input: {
    readonly taskCount: number;
    readonly deployScore01: number;
    readonly guardedTaskCount: number;
    readonly holdTaskCount: number;
    readonly retrainTaskCount: number;
    readonly blockedTaskCount: number;
  }): HarnessVerdict {
    if (input.blockedTaskCount > this.options.maximumBlockedTasks) {
      return 'BLOCK';
    }
    if (input.retrainTaskCount > 0) {
      return 'RETRAIN';
    }
    if (input.holdTaskCount > 0) {
      return 'HOLD';
    }
    if (input.guardedTaskCount > this.options.maximumGuardedTasks) {
      return 'HOLD';
    }
    if (input.deployScore01 >= this.options.deployScoreFloor01) {
      return input.guardedTaskCount > 0 ? 'DEPLOY_GUARDED' : 'DEPLOY';
    }
    if (input.deployScore01 >= this.options.guardedDeployScoreFloor01) {
      return 'DEPLOY_GUARDED';
    }
    if (input.deployScore01 >= this.options.holdScoreFloor01) {
      return 'HOLD';
    }
    return 'RETRAIN';
  }

  private computeAverageFeatureDensity(examples: readonly LabeledTrainingExample[]): number {
    return mean(examples.map((example) => featureDensity(example.features)));
  }
}

// ============================================================================
// MARK: Pure helpers
// ============================================================================

function normalizeHarnessOptions(options: EvaluationHarnessOptions): NormalizedEvaluationHarnessOptions {
  return Object.freeze({
    dataset: Object.freeze(options.dataset ?? {}) as TrainingBuildOptions,
    labeling: Object.freeze(options.labeling ?? {}) as LabelAssemblyOptions,
    trainer: Object.freeze(options.trainer ?? {}) as PolicyTrainerOptions,
    drift: Object.freeze(options.drift ?? {}) as DriftMonitorOptions,
    minimumValidationMacroF101: options.minimumValidationMacroF101 ?? DEFAULT_OPTIONS.minimumValidationMacroF101,
    minimumValidationAccuracy01: options.minimumValidationAccuracy01 ?? DEFAULT_OPTIONS.minimumValidationAccuracy01,
    minimumTestMacroF101: options.minimumTestMacroF101 ?? DEFAULT_OPTIONS.minimumTestMacroF101,
    minimumTestAccuracy01: options.minimumTestAccuracy01 ?? DEFAULT_OPTIONS.minimumTestAccuracy01,
    maximumCalibrationError01: options.maximumCalibrationError01 ?? DEFAULT_OPTIONS.maximumCalibrationError01,
    minimumAverageConfidence01: options.minimumAverageConfidence01 ?? DEFAULT_OPTIONS.minimumAverageConfidence01,
    minimumLabelCoverage01: options.minimumLabelCoverage01 ?? DEFAULT_OPTIONS.minimumLabelCoverage01,
    maximumGuardedTasks: options.maximumGuardedTasks ?? DEFAULT_OPTIONS.maximumGuardedTasks,
    maximumBlockedTasks: options.maximumBlockedTasks ?? DEFAULT_OPTIONS.maximumBlockedTasks,
    deployScoreFloor01: options.deployScoreFloor01 ?? DEFAULT_OPTIONS.deployScoreFloor01,
    guardedDeployScoreFloor01: options.guardedDeployScoreFloor01 ?? DEFAULT_OPTIONS.guardedDeployScoreFloor01,
    holdScoreFloor01: options.holdScoreFloor01 ?? DEFAULT_OPTIONS.holdScoreFloor01,
    driftPenaltyWeight: options.driftPenaltyWeight ?? DEFAULT_OPTIONS.driftPenaltyWeight,
    calibrationPenaltyWeight: options.calibrationPenaltyWeight ?? DEFAULT_OPTIONS.calibrationPenaltyWeight,
    thresholdPressureWeight: options.thresholdPressureWeight ?? DEFAULT_OPTIONS.thresholdPressureWeight,
    splitBalanceWeight: options.splitBalanceWeight ?? DEFAULT_OPTIONS.splitBalanceWeight,
    confidenceBonusWeight: options.confidenceBonusWeight ?? DEFAULT_OPTIONS.confidenceBonusWeight,
    featureDensityFloor01: options.featureDensityFloor01 ?? DEFAULT_OPTIONS.featureDensityFloor01,
    shadowRateWarning01: options.shadowRateWarning01 ?? DEFAULT_OPTIONS.shadowRateWarning01,
    abstainRateWarning01: options.abstainRateWarning01 ?? DEFAULT_OPTIONS.abstainRateWarning01,
    deferRateWarning01: options.deferRateWarning01 ?? DEFAULT_OPTIONS.deferRateWarning01,
    escalateRateWarning01: options.escalateRateWarning01 ?? DEFAULT_OPTIONS.escalateRateWarning01,
    topFindingsPerTask: options.topFindingsPerTask ?? DEFAULT_OPTIONS.topFindingsPerTask,
    topExamplesPerTask: options.topExamplesPerTask ?? DEFAULT_OPTIONS.topExamplesPerTask,
    exportPrettyJson: options.exportPrettyJson ?? DEFAULT_OPTIONS.exportPrettyJson,
  });
}

function buildExportManifest(taskKeys: readonly TrainingTaskKey[]): HarnessExportManifest {
  const taskScorecardFilenames = {} as Record<TrainingTaskKey, string>;
  for (const task of taskKeys) {
    taskScorecardFilenames[task] = `chat-training-scorecard-${task.toLowerCase()}.txt`;
  }
  return Object.freeze({
    reportJsonFilename: 'chat-training-evaluation-report.json',
    candidateBundleFilename: 'chat-training-candidate-bundle.json',
    driftJsonFilename: 'chat-training-drift-report.json',
    taskScorecardFilenames: Object.freeze(taskScorecardFilenames),
  });
}

function labelSpaceCoverage(policy: TrainedTaskPolicy, dataset: LabeledTaskDataset): number {
  const present = new Set(dataset.examples.map((example) => example.labels.primaryLabel));
  const overlap = policy.labelSpace.filter((label) => present.has(label)).length;
  return safeDivide(overlap, Math.max(1, policy.labelSpace.length));
}

function featureDensity(features: TrainingExampleFeatures): number {
  const scalar = Object.keys(features.scalar).length;
  const boolean = Object.keys(features.boolean).length;
  const categorical = Object.keys(features.categorical).length;
  const sequence = Object.values(features.sequence).reduce((count, tokens) => count + (tokens.length > 0 ? 1 : 0), 0);
  return clamp01((scalar + boolean + categorical + sequence) / 32);
}

function featureDensityBonus(features: TrainingExampleFeatures, globalFeatureDensity01: number): number {
  const current = featureDensity(features);
  return (current - globalFeatureDensity01) * 0.35;
}

function buildConfusionMatrix(
  rows: readonly InternalReplayRow[],
  labelSpace: readonly string[],
): Readonly<Record<string, Readonly<Record<string, number>>>> {
  const matrix: Record<string, Record<string, number>> = {};

  for (const actual of labelSpace) {
    matrix[actual] = {};
    for (const predicted of labelSpace) {
      matrix[actual][predicted] = 0;
    }
  }

  for (const row of rows) {
    const actual = row.example.labels.primaryLabel;
    const predicted = row.prediction.predictedLabel;
    if (!matrix[actual]) {
      matrix[actual] = {};
    }
    matrix[actual][predicted] = (matrix[actual][predicted] ?? 0) + 1;
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(matrix).map(([actual, byPredicted]) => [actual, Object.freeze(sortRecord(byPredicted))]),
    ),
  );
}

function summarizeExampleEvidence(example: LabeledTrainingExample): readonly string[] {
  const lines: string[] = [];
  lines.push(`task=${example.task}`);
  lines.push(`label=${example.labels.primaryLabel}`);
  lines.push(`window_messages=${example.window.preMessages.length + example.window.anchorMessages.length + example.window.postMessages.length}`);
  lines.push(`window_telemetry=${example.window.telemetry.length}`);
  lines.push(`window_replay=${example.window.replayArtifacts.length}`);
  lines.push(`window_inference=${example.window.inferenceSnapshots.length}`);
  lines.push(`evidence_refs=${example.window.evidence.length}`);
  if (example.labels.rationale.length > 0) {
    lines.push(`rationale=${example.labels.rationale.slice(0, 2).join(' | ')}`);
  }
  return Object.freeze(lines);
}

function softmaxToRecord(entries: readonly { readonly label: string; readonly score: number }[]): Readonly<Record<string, number>> {
  const maxScore = Math.max(...entries.map((entry) => entry.score));
  const exponentials = entries.map((entry) => ({
    label: entry.label,
    value: Math.exp(entry.score - maxScore),
  }));
  const total = sum(exponentials.map((entry) => entry.value));
  const record: Record<string, number> = {};
  for (const entry of exponentials) {
    record[entry.label] = safeDivide(entry.value, total);
  }
  return Object.freeze(sortRecord(record));
}

function topProbability(probabilities: Readonly<Record<string, number>>): { readonly label: string; readonly probability01: number } {
  const entries = Object.entries(probabilities);
  if (entries.length === 0) {
    return Object.freeze({ label: 'UNKNOWN', probability01: 0 });
  }
  entries.sort((a, b) => compareNumbers(b[1], a[1]) || compareStrings(a[0], b[0]));
  return Object.freeze({
    label: entries[0][0],
    probability01: entries[0][1],
  });
}

function routeByThresholds(confidence01: number, thresholds: RuntimeThresholdProfile): RuntimeDecisionBucket {
  if (confidence01 >= thresholds.acceptThreshold01) {
    return 'ACCEPT';
  }
  if (confidence01 >= thresholds.deferThreshold01) {
    return 'DEFER';
  }
  if (confidence01 >= thresholds.shadowThreshold01) {
    return 'SHADOW';
  }
  if (confidence01 >= thresholds.escalateThreshold01) {
    return 'ESCALATE';
  }
  return 'ABSTAIN';
}

function verdictBias(status: TrainedTaskPolicy['status']): number {
  switch (status) {
    case 'DEPLOY':
      return 0.04;
    case 'DEPLOY_WITH_GUARDRAILS':
      return 0.02;
    case 'HOLD_FOR_MORE_DATA':
      return -0.04;
    case 'RETRAIN':
      return -0.06;
    case 'DO_NOT_DEPLOY':
      return -0.12;
    default:
      return 0;
  }
}

function riskFromDeployScore(
  deployScore01: number,
  driftTask: TaskDriftReport | null,
  calibrationError01: number,
): HarnessRiskLevel {
  if ((driftTask?.severity === 'CRITICAL') || deployScore01 < 0.45 || calibrationError01 > 0.24) {
    return 'CRITICAL';
  }
  if ((driftTask?.severity === 'HIGH') || deployScore01 < 0.6 || calibrationError01 > 0.18) {
    return 'HIGH';
  }
  if ((driftTask?.severity === 'MEDIUM') || deployScore01 < 0.75 || calibrationError01 > 0.12) {
    return 'MODERATE';
  }
  return 'LOW';
}

function overallRiskFromVerdict(
  verdict: HarnessVerdict,
  blockedTaskCount: number,
  retrainTaskCount: number,
  averageTaskDrift01: number,
): HarnessRiskLevel {
  if (verdict === 'BLOCK' || blockedTaskCount > 0) {
    return 'CRITICAL';
  }
  if (verdict === 'RETRAIN' || retrainTaskCount > 0 || averageTaskDrift01 > 0.5) {
    return 'HIGH';
  }
  if (verdict === 'HOLD' || averageTaskDrift01 > 0.3) {
    return 'MODERATE';
  }
  return 'LOW';
}

function calibrationError(pairs: readonly { readonly predicted: number; readonly correct: boolean }[]): number {
  if (pairs.length === 0) {
    return 0;
  }
  const buckets = 10;
  const bucketStats = Array.from({ length: buckets }, () => ({ count: 0, predicted: 0, correct: 0 }));

  for (const pair of pairs) {
    const index = Math.min(buckets - 1, Math.floor(clamp01(pair.predicted) * buckets));
    bucketStats[index].count += 1;
    bucketStats[index].predicted += pair.predicted;
    bucketStats[index].correct += pair.correct ? 1 : 0;
  }

  let error = 0;
  for (const bucket of bucketStats) {
    if (bucket.count === 0) {
      continue;
    }
    const avgPredicted = bucket.predicted / bucket.count;
    const empirical = bucket.correct / bucket.count;
    error += (bucket.count / pairs.length) * Math.abs(avgPredicted - empirical);
  }

  return clamp01(error);
}

function stringifyJson(value: unknown, pretty: boolean): string {
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

function sortRecord<T>(record: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).sort((a, b) => compareStrings(a[0], b[0])),
  ) as Readonly<Record<string, T>>;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.filter(Boolean))]);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function bounded01(value: number): number {
  return clamp01(value);
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

function safeF1(precision01: number, recall01: number): number {
  const denom = precision01 + recall01;
  if (denom <= 0) {
    return 0;
  }
  return (2 * precision01 * recall01) / denom;
}

function mean(values: readonly number[]): number {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return 0;
  }
  return sum(filtered) / filtered.length;
}

function weightedMean(values: readonly { readonly value: number; readonly weight: number }[]): number {
  const filtered = values.filter((value) => Number.isFinite(value.value) && Number.isFinite(value.weight) && value.weight > 0);
  if (filtered.length === 0) {
    return 0;
  }
  const totalWeight = sum(filtered.map((entry) => entry.weight));
  if (totalWeight <= 0) {
    return 0;
  }
  return sum(filtered.map((entry) => entry.value * entry.weight)) / totalWeight;
}

function proportion(values: readonly boolean[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.filter(Boolean).length / values.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((accumulator, value) => accumulator + (Number.isFinite(value) ? value : 0), 0);
}

function compareNumbers(a: number, b: number): number {
  return a === b ? 0 : (a < b ? -1 : 1);
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatFixed(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : '0.0000';
}

function formatPercent(value: number): string {
  return `${(clamp01(value) * 100).toFixed(2)}%`;
}

function escapeLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
