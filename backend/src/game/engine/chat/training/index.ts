/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TRAINING BARREL + SUITE FACADE
 * FILE: backend/src/game/engine/chat/training/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: OpenAI for Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Canonical barrel and orchestration facade for the backend chat training lane.
 *
 * This file does four jobs:
 * 1. exports the full public surface of the training lane,
 * 2. gives the backend chat authority one stable import path,
 * 3. provides a high-level suite facade for deterministic offline workflows,
 * 4. keeps training orchestration out of pzo-server transport and frontend
 *    mirror lanes.
 *
 * This is intentionally not a thin "export *" only file. Your architecture is
 * explicit about authoritative ownership and deterministic engine surfaces. The
 * training lane deserves the same discipline.
 *
 * Canonical fit
 * -------------
 * backend/src/game/engine/chat/training/
 *   DatasetBuilder.ts
 *   LabelAssembler.ts
 *   PolicyTrainer.ts
 *   DriftMonitor.ts
 *   EvaluationHarness.ts
 *   index.ts        <-- this file
 *
 * High-level doctrine
 * -------------------
 * - DatasetBuilder consumes authoritative backend artifacts.
 * - LabelAssembler converts windows into supervised truth.
 * - PolicyTrainer produces candidate policy bundles.
 * - DriftMonitor compares a candidate or live baseline against fresh truth.
 * - EvaluationHarness makes the release decision.
 * - ChatTrainingSuite ties the full lane together without leaking runtime
 *   authority into the wrong layers.
 */

export * from './DatasetBuilder';
export * from './LabelAssembler';
export * from './PolicyTrainer';
export * from './DriftMonitor';
export * from './EvaluationHarness';

import {
  DatasetBuilder,
  CHAT_TRAINING_DATASET_BUILDER_VERSION,
  type TrainingBuildOptions,
  type TrainingCorpus,
  type TrainingRoomArtifacts,
  type TrainingTaskKey,
} from './DatasetBuilder';

import {
  LabelAssembler,
  type LabelAssemblyOptions,
  type LabeledTrainingCorpus,
} from './LabelAssembler';

import {
  PolicyTrainer,
  type PolicyTrainerOptions,
  type TrainedPolicyBundle,
} from './PolicyTrainer';

import {
  DriftMonitor,
  type DriftMonitorOptions,
  type DriftReport,
} from './DriftMonitor';

import {
  EvaluationHarness,
  CHAT_TRAINING_EVALUATION_HARNESS_VERSION,
  type EvaluationHarnessOptions,
  type EvaluationHarnessReport,
  type HarnessArtifactBundle,
} from './EvaluationHarness';

// ============================================================================
// MARK: Public suite contracts
// ============================================================================

export const CHAT_TRAINING_SUITE_VERSION = '2026.03.14' as const;

export interface ChatTrainingSuiteOptions {
  readonly dataset?: TrainingBuildOptions;
  readonly labeling?: LabelAssemblyOptions;
  readonly trainer?: PolicyTrainerOptions;
  readonly drift?: DriftMonitorOptions;
  readonly evaluation?: EvaluationHarnessOptions;
}

export interface ChatTrainingSuiteSnapshot {
  readonly version: string;
  readonly builtAt: number;
  readonly suiteSignature: string;
  readonly builderVersion: string;
  readonly harnessVersion: string;
  readonly registeredRoomIds: readonly string[];
  readonly corpus: TrainingCorpus | null;
  readonly labeledCorpus: LabeledTrainingCorpus | null;
  readonly candidateBundle: TrainedPolicyBundle | null;
  readonly driftReport: DriftReport | null;
  readonly evaluationReport: EvaluationHarnessReport | null;
}

export interface ChatTrainingCycleResult {
  readonly corpus: TrainingCorpus;
  readonly labeledCorpus: LabeledTrainingCorpus;
  readonly candidateBundle: TrainedPolicyBundle;
  readonly driftReport: DriftReport | null;
  readonly evaluationReport: EvaluationHarnessReport;
}

export interface ChatTrainingArtifactExport {
  readonly manifestJson: string;
  readonly corpusManifestJson: string | null;
  readonly labeledManifestJson: string | null;
  readonly candidateBundleJson: string | null;
  readonly driftJson: string | null;
  readonly evaluationJson: string | null;
  readonly evaluationArtifacts: HarnessArtifactBundle | null;
}

// ============================================================================
// MARK: Training suite facade
// ============================================================================

export class ChatTrainingSuite {
  private readonly builder: DatasetBuilder;
  private readonly labelAssembler: LabelAssembler;
  private readonly trainer: PolicyTrainer;
  private readonly driftMonitor: DriftMonitor;
  private readonly evaluationHarness: EvaluationHarness;

  private lastCorpus: TrainingCorpus | null = null;
  private lastLabeledCorpus: LabeledTrainingCorpus | null = null;
  private lastCandidateBundle: TrainedPolicyBundle | null = null;
  private lastDriftReport: DriftReport | null = null;
  private lastEvaluationReport: EvaluationHarnessReport | null = null;

  public constructor(options: ChatTrainingSuiteOptions = {}) {
    this.builder = new DatasetBuilder(options.dataset ?? {});
    this.labelAssembler = new LabelAssembler(options.labeling ?? {});
    this.trainer = new PolicyTrainer(options.trainer ?? {});
    this.driftMonitor = new DriftMonitor(options.drift ?? {});
    this.evaluationHarness = new EvaluationHarness({
      dataset: options.dataset,
      labeling: options.labeling,
      trainer: options.trainer,
      drift: options.drift,
      ...(options.evaluation ?? {}),
    });
  }

  public clear(): this {
    this.builder.clear();
    this.lastCorpus = null;
    this.lastLabeledCorpus = null;
    this.lastCandidateBundle = null;
    this.lastDriftReport = null;
    this.lastEvaluationReport = null;
    return this;
  }

  public registerRoomArtifacts(bundle: TrainingRoomArtifacts): this {
    this.builder.registerRoomArtifacts(bundle);
    return this;
  }

  public registerRoomArtifactsMany(bundles: readonly TrainingRoomArtifacts[]): this {
    this.builder.registerRoomArtifactsMany(bundles);
    return this;
  }

  public getRegisteredRoomIds(): readonly string[] {
    return this.builder.getRegisteredRoomIds();
  }

  public buildCorpus(): TrainingCorpus {
    this.lastCorpus = this.builder.buildCorpus();
    return this.lastCorpus;
  }

  public labelCorpus(corpus?: TrainingCorpus): LabeledTrainingCorpus {
    const resolvedCorpus = corpus ?? this.lastCorpus ?? this.buildCorpus();
    this.lastLabeledCorpus = this.labelAssembler.assembleCorpus(resolvedCorpus);
    return this.lastLabeledCorpus;
  }

  public trainCorpus(labeledCorpus?: LabeledTrainingCorpus): TrainedPolicyBundle {
    const resolvedLabeled = labeledCorpus ?? this.lastLabeledCorpus ?? this.labelCorpus();
    this.lastCandidateBundle = this.trainer.trainCorpus(resolvedLabeled);
    return this.lastCandidateBundle;
  }

  public analyzeDrift(
    baselineBundle: TrainedPolicyBundle,
    labeledCorpus?: LabeledTrainingCorpus,
  ): DriftReport {
    const resolvedLabeled = labeledCorpus ?? this.lastLabeledCorpus ?? this.labelCorpus();
    this.lastDriftReport = this.driftMonitor.analyzeAgainstBundle(baselineBundle, resolvedLabeled);
    return this.lastDriftReport;
  }

  public evaluate(
    baselineBundle: TrainedPolicyBundle | null = null,
    corpus?: TrainingCorpus,
    labeledCorpus?: LabeledTrainingCorpus,
  ): EvaluationHarnessReport {
    const resolvedCorpus = corpus ?? this.lastCorpus ?? this.buildCorpus();
    const resolvedLabeled = labeledCorpus ?? this.lastLabeledCorpus ?? this.labelCorpus(resolvedCorpus);
    this.lastEvaluationReport = this.evaluationHarness.evaluateLabeledCorpus(
      resolvedCorpus,
      resolvedLabeled,
      baselineBundle,
    );
    this.lastCandidateBundle = this.lastEvaluationReport.candidateBundle;
    this.lastDriftReport = this.lastEvaluationReport.driftReport;
    return this.lastEvaluationReport;
  }

  public runFullCycle(
    bundles: readonly TrainingRoomArtifacts[],
    baselineBundle: TrainedPolicyBundle | null = null,
  ): ChatTrainingCycleResult {
    this.clear();
    this.registerRoomArtifactsMany(bundles);

    const corpus = this.buildCorpus();
    const labeledCorpus = this.labelCorpus(corpus);
    const candidateBundle = this.trainCorpus(labeledCorpus);
    const driftReport = baselineBundle ? this.analyzeDrift(baselineBundle, labeledCorpus) : null;
    const evaluationReport = this.evaluate(baselineBundle, corpus, labeledCorpus);

    return Object.freeze({
      corpus,
      labeledCorpus,
      candidateBundle,
      driftReport,
      evaluationReport,
    });
  }

  public exportArtifacts(): ChatTrainingArtifactExport {
    const evaluationArtifacts = this.lastEvaluationReport
      ? this.evaluationHarness.exportArtifacts(this.lastEvaluationReport)
      : null;

    return Object.freeze({
      manifestJson: JSON.stringify(this.snapshot(), null, 2),
      corpusManifestJson: this.lastCorpus ? this.builder.exportCorpusManifest(this.lastCorpus) : null,
      labeledManifestJson: this.lastLabeledCorpus ? JSON.stringify(this.lastLabeledCorpus.manifest, null, 2) : null,
      candidateBundleJson: this.lastCandidateBundle ? this.trainer.exportBundleJson(this.lastCandidateBundle) : null,
      driftJson: this.lastDriftReport ? JSON.stringify(this.lastDriftReport, null, 2) : null,
      evaluationJson: this.lastEvaluationReport ? this.evaluationHarness.exportReportJson(this.lastEvaluationReport) : null,
      evaluationArtifacts,
    });
  }

  public exportTaskNdjson(task: TrainingTaskKey): string {
    if (!this.lastCorpus) {
      throw new Error(`Cannot export task NDJSON for ${task} before corpus has been built.`);
    }
    return this.builder.exportTaskNdjson(this.lastCorpus, task);
  }

  public exportLabeledTaskNdjson(task: TrainingTaskKey): string {
    if (!this.lastLabeledCorpus) {
      throw new Error(`Cannot export labeled task NDJSON for ${task} before labeled corpus has been assembled.`);
    }
    return this.labelAssembler.exportTaskNdjson(this.lastLabeledCorpus, task);
  }

  public exportRuntimeTaskJson(task: TrainingTaskKey): string {
    if (!this.lastCandidateBundle) {
      throw new Error(`Cannot export runtime task JSON for ${task} before candidate bundle has been trained.`);
    }
    return this.trainer.exportTaskRuntimeJson(this.lastCandidateBundle, task);
  }

  public snapshot(): ChatTrainingSuiteSnapshot {
    return Object.freeze({
      version: CHAT_TRAINING_SUITE_VERSION,
      builtAt: Date.now(),
      suiteSignature: 'backend/src/game/engine/chat/training/index.ts#ChatTrainingSuite',
      builderVersion: CHAT_TRAINING_DATASET_BUILDER_VERSION,
      harnessVersion: CHAT_TRAINING_EVALUATION_HARNESS_VERSION,
      registeredRoomIds: this.builder.getRegisteredRoomIds(),
      corpus: this.lastCorpus,
      labeledCorpus: this.lastLabeledCorpus,
      candidateBundle: this.lastCandidateBundle,
      driftReport: this.lastDriftReport,
      evaluationReport: this.lastEvaluationReport,
    });
  }
}

// ============================================================================
// MARK: Convenience helpers
// ============================================================================

export function createChatTrainingSuite(options: ChatTrainingSuiteOptions = {}): ChatTrainingSuite {
  return new ChatTrainingSuite(options);
}

export function runChatTrainingCycle(
  bundles: readonly TrainingRoomArtifacts[],
  options: ChatTrainingSuiteOptions = {},
  baselineBundle: TrainedPolicyBundle | null = null,
): ChatTrainingCycleResult {
  const suite = new ChatTrainingSuite(options);
  return suite.runFullCycle(bundles, baselineBundle);
}

export function buildChatTrainingCorpus(
  bundles: readonly TrainingRoomArtifacts[],
  options: TrainingBuildOptions = {},
): TrainingCorpus {
  const builder = new DatasetBuilder(options);
  builder.registerRoomArtifactsMany(bundles);
  return builder.buildCorpus();
}

export function labelChatTrainingCorpus(
  corpus: TrainingCorpus,
  options: LabelAssemblyOptions = {},
): LabeledTrainingCorpus {
  const assembler = new LabelAssembler(options);
  return assembler.assembleCorpus(corpus);
}

export function trainChatPolicyBundle(
  labeledCorpus: LabeledTrainingCorpus,
  options: PolicyTrainerOptions = {},
): TrainedPolicyBundle {
  const trainer = new PolicyTrainer(options);
  return trainer.trainCorpus(labeledCorpus);
}

export function analyzeChatPolicyDrift(
  baselineBundle: TrainedPolicyBundle,
  labeledCorpus: LabeledTrainingCorpus,
  options: DriftMonitorOptions = {},
): DriftReport {
  const monitor = new DriftMonitor(options);
  return monitor.analyzeAgainstBundle(baselineBundle, labeledCorpus);
}

export function evaluateChatTrainingBundle(
  corpus: TrainingCorpus,
  labeledCorpus: LabeledTrainingCorpus,
  baselineBundle: TrainedPolicyBundle | null = null,
  options: EvaluationHarnessOptions = {},
): EvaluationHarnessReport {
  const harness = new EvaluationHarness(options);
  return harness.evaluateLabeledCorpus(corpus, labeledCorpus, baselineBundle);
}

// ============================================================================
// MARK: Stable import aliases
// ============================================================================

export type ChatTrainingBuilder = DatasetBuilder;
export type ChatTrainingLabeler = LabelAssembler;
export type ChatTrainingPolicyTrainer = PolicyTrainer;
export type ChatTrainingDriftMonitor = DriftMonitor;
export type ChatTrainingEvaluationHarness = EvaluationHarness;
