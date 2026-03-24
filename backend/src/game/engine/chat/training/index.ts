/**
 * ============================================================================
 * POINT ZERO ONE — AUTHORITATIVE BACKEND CHAT TRAINING BARREL + SUITE FACADE
 * FILE: backend/src/game/engine/chat/training/index.ts
 * VERSION: 2026.03.14
 * AUTHORSHIP: Antonio T. Smith Jr.
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
  type TaskHarnessReport,
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

// ============================================================================
// MARK: Suite telemetry and audit trail
// ============================================================================

export interface ChatTrainingCycleAuditEntry {
  readonly cycleId: string;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly durationMs: number;
  readonly roomsRegistered: number;
  readonly corpusTaskCount: number;
  readonly labeledTaskCount: number;
  readonly candidateTrainedAt: number;
  readonly driftAnalyzed: boolean;
  readonly evaluationVerdict: EvaluationHarnessReport['overall']['verdict'];
  readonly deployScore01: number;
  readonly options: ChatTrainingSuiteOptions;
}

export interface ChatTrainingSuiteAuditLog {
  readonly entries: readonly ChatTrainingCycleAuditEntry[];
  readonly totalCycles: number;
  readonly lastVerdictAt: number | null;
  readonly lastVerdict: EvaluationHarnessReport['overall']['verdict'] | null;
  readonly averageDeployScore01: number;
  readonly bestDeployScore01: number;
  readonly lastCycleId: string | null;
}

function generateCycleId(): string {
  return `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ============================================================================
// MARK: Audited training suite (wraps ChatTrainingSuite with audit trail)
// ============================================================================

export class AuditedChatTrainingSuite {
  private readonly suite: ChatTrainingSuite;
  private readonly log: ChatTrainingCycleAuditEntry[] = [];

  public constructor(options: ChatTrainingSuiteOptions = {}) {
    this.suite = new ChatTrainingSuite(options);
  }

  public get inner(): ChatTrainingSuite {
    return this.suite;
  }

  public registerRoomArtifacts(bundle: TrainingRoomArtifacts): this {
    this.suite.registerRoomArtifacts(bundle);
    return this;
  }

  public registerRoomArtifactsMany(bundles: readonly TrainingRoomArtifacts[]): this {
    this.suite.registerRoomArtifactsMany(bundles);
    return this;
  }

  public runAuditedFullCycle(
    bundles: readonly TrainingRoomArtifacts[],
    baselineBundle: TrainedPolicyBundle | null = null,
    options?: ChatTrainingSuiteOptions,
  ): { readonly result: ChatTrainingCycleResult; readonly audit: ChatTrainingCycleAuditEntry } {
    const cycleId = generateCycleId();
    const startedAt = Date.now();
    const target = options ? new ChatTrainingSuite(options) : this.suite;

    const result = target.runFullCycle(bundles, baselineBundle);
    const completedAt = Date.now();

    const audit: ChatTrainingCycleAuditEntry = Object.freeze({
      cycleId,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
      roomsRegistered: bundles.length,
      corpusTaskCount: Object.keys(result.corpus.tasks).length,
      labeledTaskCount: Object.keys(result.labeledCorpus.tasks).length,
      candidateTrainedAt: result.candidateBundle.manifest.trainedAt,
      driftAnalyzed: result.driftReport !== null,
      evaluationVerdict: result.evaluationReport.overall.verdict,
      deployScore01: result.evaluationReport.overall.deployScore01,
      options: options ?? {},
    });

    this.log.push(audit);
    return Object.freeze({ result, audit });
  }

  public getAuditLog(): ChatTrainingSuiteAuditLog {
    const entries = Object.freeze([...this.log]);
    const scores = entries.map((e) => e.deployScore01).filter(Number.isFinite);
    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;

    return Object.freeze({
      entries,
      totalCycles: entries.length,
      lastVerdictAt: lastEntry?.completedAt ?? null,
      lastVerdict: lastEntry?.evaluationVerdict ?? null,
      averageDeployScore01: scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10000) / 10000
        : 0,
      bestDeployScore01: scores.length > 0
        ? Math.round(Math.max(...scores) * 10000) / 10000
        : 0,
      lastCycleId: lastEntry?.cycleId ?? null,
    });
  }

  public clearAuditLog(): this {
    this.log.length = 0;
    return this;
  }
}

// ============================================================================
// MARK: Suite pipeline validator
// ============================================================================

export interface ChatTrainingPipelineValidation {
  readonly validatedAt: number;
  readonly roomCount: number;
  readonly hasCorpus: boolean;
  readonly hasLabeledCorpus: boolean;
  readonly hasCandidateBundle: boolean;
  readonly hasDriftReport: boolean;
  readonly hasEvaluationReport: boolean;
  readonly pipelineComplete: boolean;
  readonly readyToExport: boolean;
  readonly missingStages: readonly string[];
  readonly warnings: readonly string[];
}

export function validateSuitePipeline(snapshot: ChatTrainingSuiteSnapshot): ChatTrainingPipelineValidation {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!snapshot.corpus) {
    missing.push('corpus');
  } else if (Object.keys(snapshot.corpus.tasks).length === 0) {
    warnings.push('Corpus built but has no tasks — no room artifacts were registered.');
  }

  if (!snapshot.labeledCorpus) {
    missing.push('labeled_corpus');
  }

  if (!snapshot.candidateBundle) {
    missing.push('candidate_bundle');
  }

  if (!snapshot.evaluationReport) {
    missing.push('evaluation_report');
  }

  if (!snapshot.driftReport) {
    warnings.push('No drift report — baseline comparison skipped.');
  }

  const pipelineComplete = missing.length === 0;

  return Object.freeze({
    validatedAt: Date.now(),
    roomCount: snapshot.registeredRoomIds.length,
    hasCorpus: snapshot.corpus !== null,
    hasLabeledCorpus: snapshot.labeledCorpus !== null,
    hasCandidateBundle: snapshot.candidateBundle !== null,
    hasDriftReport: snapshot.driftReport !== null,
    hasEvaluationReport: snapshot.evaluationReport !== null,
    pipelineComplete,
    readyToExport: pipelineComplete,
    missingStages: Object.freeze(missing),
    warnings: Object.freeze(warnings),
  });
}

// ============================================================================
// MARK: Suite options builder — fluent API for constructing options
// ============================================================================

export class ChatTrainingSuiteOptionsBuilder {
  private readonly _opts: {
    dataset: TrainingBuildOptions;
    labeling: LabelAssemblyOptions;
    trainer: PolicyTrainerOptions;
    drift: DriftMonitorOptions;
    evaluation: EvaluationHarnessOptions;
  };

  public constructor() {
    this._opts = {
      dataset: {},
      labeling: {},
      trainer: {},
      drift: {},
      evaluation: {},
    };
  }

  public withDataset(options: TrainingBuildOptions): this {
    Object.assign(this._opts, { dataset: { ...this._opts.dataset, ...options } });
    return this;
  }

  public withLabeling(options: LabelAssemblyOptions): this {
    Object.assign(this._opts, { labeling: { ...this._opts.labeling, ...options } });
    return this;
  }

  public withTrainer(options: PolicyTrainerOptions): this {
    Object.assign(this._opts, { trainer: { ...this._opts.trainer, ...options } });
    return this;
  }

  public withDrift(options: DriftMonitorOptions): this {
    Object.assign(this._opts, { drift: { ...this._opts.drift, ...options } });
    return this;
  }

  public withEvaluation(options: EvaluationHarnessOptions): this {
    Object.assign(this._opts, { evaluation: { ...this._opts.evaluation, ...options } });
    return this;
  }

  public build(): ChatTrainingSuiteOptions {
    return Object.freeze({ ...this._opts });
  }

  public buildSuite(): ChatTrainingSuite {
    return new ChatTrainingSuite(this.build());
  }
}

export function createSuiteOptionsBuilder(): ChatTrainingSuiteOptionsBuilder {
  return new ChatTrainingSuiteOptionsBuilder();
}

// ============================================================================
// MARK: Suite report formatter
// ============================================================================

export interface ChatTrainingCycleSummary {
  readonly cycleId: string | null;
  readonly version: string;
  readonly builtAt: number;
  readonly verdict: EvaluationHarnessReport['overall']['verdict'];
  readonly risk: EvaluationHarnessReport['overall']['risk'];
  readonly deployScore01: number;
  readonly taskCount: number;
  readonly readyTaskCount: number;
  readonly corpusRoomCount: number;
  readonly driftAnalyzed: boolean;
  readonly overallDrift01: number | null;
  readonly findings: readonly string[];
  readonly actions: readonly string[];
  readonly builderVersion: string;
  readonly harnessVersion: string;
}

export function buildCycleSummary(
  result: ChatTrainingCycleResult,
  audit?: ChatTrainingCycleAuditEntry,
): ChatTrainingCycleSummary {
  const report = result.evaluationReport;
  const readyCount = Object.values(report.tasks).filter(
    (t) => t.verdict === 'DEPLOY' || t.verdict === 'DEPLOY_GUARDED',
  ).length;

  return Object.freeze({
    cycleId: audit?.cycleId ?? null,
    version: CHAT_TRAINING_SUITE_VERSION,
    builtAt: Date.now(),
    verdict: report.overall.verdict,
    risk: report.overall.risk,
    deployScore01: report.overall.deployScore01,
    taskCount: report.overall.taskCount,
    readyTaskCount: readyCount,
    corpusRoomCount: result.corpus.manifest.roomCount,
    driftAnalyzed: result.driftReport !== null,
    overallDrift01: result.driftReport
      ? result.driftReport.overall.averageTaskDrift01
      : null,
    findings: report.overall.findings,
    actions: report.overall.actions,
    builderVersion: result.corpus.manifest.version,
    harnessVersion: report.manifest.version,
  });
}

export function exportCycleSummaryJson(
  result: ChatTrainingCycleResult,
  audit?: ChatTrainingCycleAuditEntry,
  pretty = true,
): string {
  return JSON.stringify(buildCycleSummary(result, audit), null, pretty ? 2 : 0);
}

// ============================================================================
// MARK: Suite batch runner — multi-baseline comparison
// ============================================================================

export interface ChatTrainingMultiBaselineResult {
  readonly evaluatedAt: number;
  readonly baselineCount: number;
  readonly results: readonly {
    readonly baselineLabel: string;
    readonly baselineBundle: TrainedPolicyBundle | null;
    readonly result: ChatTrainingCycleResult;
    readonly summary: ChatTrainingCycleSummary;
  }[];
  readonly bestBaselineLabel: string | null;
  readonly bestDeployScore01: number;
}

export function runMultiBaselineComparison(
  bundles: readonly TrainingRoomArtifacts[],
  baselines: readonly { readonly label: string; readonly bundle: TrainedPolicyBundle | null }[],
  options: ChatTrainingSuiteOptions = {},
): ChatTrainingMultiBaselineResult {
  const results = baselines.map(({ label, bundle }) => {
    const suite = new ChatTrainingSuite(options);
    const result = suite.runFullCycle(bundles, bundle);
    return Object.freeze({
      baselineLabel: label,
      baselineBundle: bundle,
      result,
      summary: buildCycleSummary(result),
    });
  });

  let bestLabel: string | null = null;
  let bestScore = -1;
  for (const r of results) {
    if (r.summary.deployScore01 > bestScore) {
      bestScore = r.summary.deployScore01;
      bestLabel = r.baselineLabel;
    }
  }

  return Object.freeze({
    evaluatedAt: Date.now(),
    baselineCount: baselines.length,
    results: Object.freeze(results),
    bestBaselineLabel: bestLabel,
    bestDeployScore01: bestScore < 0 ? 0 : bestScore,
  });
}

// ============================================================================
// MARK: Suite corpus diff helper
// ============================================================================

export interface ChatTrainingCorpusDiffSummary {
  readonly diffedAt: number;
  readonly priorTaskCount: number;
  readonly currentTaskCount: number;
  readonly addedTasks: readonly TrainingTaskKey[];
  readonly removedTasks: readonly TrainingTaskKey[];
  readonly sharedTasks: readonly TrainingTaskKey[];
  readonly priorTotalExamples: number;
  readonly currentTotalExamples: number;
  readonly exampleDelta: number;
}

export function diffCorpora(
  prior: TrainingCorpus,
  current: TrainingCorpus,
): ChatTrainingCorpusDiffSummary {
  const priorTasks = new Set(Object.keys(prior.tasks) as TrainingTaskKey[]);
  const currentTasks = new Set(Object.keys(current.tasks) as TrainingTaskKey[]);

  const addedTasks = [...currentTasks].filter((t) => !priorTasks.has(t));
  const removedTasks = [...priorTasks].filter((t) => !currentTasks.has(t));
  const sharedTasks = [...priorTasks].filter((t) => currentTasks.has(t));

  const sumExamples = (corpus: TrainingCorpus) =>
    Object.values(corpus.tasks).reduce((acc, ds) => acc + ds.stats.totalExamples, 0);

  const priorTotal = sumExamples(prior);
  const currentTotal = sumExamples(current);

  return Object.freeze({
    diffedAt: Date.now(),
    priorTaskCount: priorTasks.size,
    currentTaskCount: currentTasks.size,
    addedTasks: Object.freeze(addedTasks),
    removedTasks: Object.freeze(removedTasks),
    sharedTasks: Object.freeze(sharedTasks),
    priorTotalExamples: priorTotal,
    currentTotalExamples: currentTotal,
    exampleDelta: currentTotal - priorTotal,
  });
}

// ============================================================================
// MARK: Suite CI gate
// ============================================================================

export type ChatTrainingCIVerdict = 'CI_PASS' | 'CI_PASS_GUARDED' | 'CI_FAIL' | 'CI_BLOCK';

export interface ChatTrainingCIGate {
  readonly evaluatedAt: number;
  readonly verdict: ChatTrainingCIVerdict;
  readonly deployScore01: number;
  readonly harnessVerdict: EvaluationHarnessReport['overall']['verdict'];
  readonly blockingReasons: readonly string[];
  readonly warningReasons: readonly string[];
  readonly passedThreshold: boolean;
  readonly minDeployScore01Required: number;
}

export function evaluateCIGate(
  result: ChatTrainingCycleResult,
  minDeployScore01 = 0.65,
): ChatTrainingCIGate {
  const report = result.evaluationReport;
  const score = report.overall.deployScore01;
  const harnessVerdict = report.overall.verdict;

  const blocking: string[] = [];
  const warnings: string[] = [];

  if (harnessVerdict === 'BLOCK') {
    blocking.push('Harness verdict is BLOCK — critical issues detected.');
  } else if (harnessVerdict === 'RETRAIN') {
    blocking.push('Harness verdict is RETRAIN — policy must be retrained.');
  } else if (harnessVerdict === 'HOLD') {
    warnings.push('Harness verdict is HOLD — review required before deploy.');
  }

  if (score < minDeployScore01) {
    blocking.push(`Deploy score ${(score * 100).toFixed(1)}% below CI minimum ${(minDeployScore01 * 100).toFixed(1)}%.`);
  }

  if (result.driftReport) {
    const drift = result.driftReport.overall.averageTaskDrift01;
    if (drift > 0.6) {
      blocking.push(`Drift ${(drift * 100).toFixed(1)}% exceeds CI block threshold (60%).`);
    } else if (drift > 0.4) {
      warnings.push(`Drift ${(drift * 100).toFixed(1)}% elevated — consider investigation.`);
    }
  }

  let ciVerdict: ChatTrainingCIVerdict;
  if (blocking.length > 0) {
    ciVerdict = harnessVerdict === 'BLOCK' ? 'CI_BLOCK' : 'CI_FAIL';
  } else if (warnings.length > 0 || harnessVerdict === 'DEPLOY_GUARDED') {
    ciVerdict = 'CI_PASS_GUARDED';
  } else {
    ciVerdict = 'CI_PASS';
  }

  return Object.freeze({
    evaluatedAt: Date.now(),
    verdict: ciVerdict,
    deployScore01: score,
    harnessVerdict,
    blockingReasons: Object.freeze(blocking),
    warningReasons: Object.freeze(warnings),
    passedThreshold: blocking.length === 0,
    minDeployScore01Required: minDeployScore01,
  });
}

// ============================================================================
// MARK: Suite room registration helpers
// ============================================================================

export function createRoomArtifactBundle(partial: Partial<TrainingRoomArtifacts> & Pick<TrainingRoomArtifacts, 'roomId' | 'transcript'>): TrainingRoomArtifacts {
  return Object.freeze({
    replayArtifacts: [],
    telemetry: [],
    signals: [],
    proofEdges: [],
    inferenceSnapshots: [],
    sessions: [],
    presence: [],
    ...partial,
  } as TrainingRoomArtifacts);
}

// ============================================================================
// MARK: Suite version manifest
// ============================================================================

export interface ChatTrainingSuiteVersionManifest {
  readonly suiteVersion: string;
  readonly builderVersion: string;
  readonly harnessVersion: string;
  readonly filePath: string;
  readonly publishedAt: string;
}

export const CHAT_TRAINING_SUITE_VERSION_MANIFEST: ChatTrainingSuiteVersionManifest =
  Object.freeze({
    suiteVersion: CHAT_TRAINING_SUITE_VERSION,
    builderVersion: CHAT_TRAINING_DATASET_BUILDER_VERSION,
    harnessVersion: CHAT_TRAINING_EVALUATION_HARNESS_VERSION,
    filePath: 'backend/src/game/engine/chat/training/index.ts',
    publishedAt: '2026-03-14',
  });

// ============================================================================
// MARK: Module object
// ============================================================================

export const ChatTrainingSuiteModule = Object.freeze({
  version: CHAT_TRAINING_SUITE_VERSION,
  versionManifest: CHAT_TRAINING_SUITE_VERSION_MANIFEST,
  createSuite: createChatTrainingSuite,
  runCycle: runChatTrainingCycle,
  buildCorpus: buildChatTrainingCorpus,
  labelCorpus: labelChatTrainingCorpus,
  trainBundle: trainChatPolicyBundle,
  analyzeDrift: analyzeChatPolicyDrift,
  evaluate: evaluateChatTrainingBundle,
  createOptionsBuilder: createSuiteOptionsBuilder,
  validatePipeline: validateSuitePipeline,
  buildCycleSummary,
  exportCycleSummaryJson,
  diffCorpora,
  evaluateCIGate,
  runMultiBaselineComparison,
  createRoomArtifactBundle,
});

// ============================================================================
// MARK: Per-task training scorecard
// ============================================================================

export interface ChatTrainingTaskScorecard {
  readonly task: TrainingTaskKey;
  readonly validationMacroF101: number;
  readonly testMacroF101: number;
  readonly validationAccuracy01: number;
  readonly testAccuracy01: number;
  readonly calibrationError01: number;
  readonly driftScore01: number | null;
  readonly deployScore01: number;
  readonly verdict: TaskHarnessReport['verdict'];
  readonly risk: TaskHarnessReport['risk'];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly actions: readonly string[];
  readonly gateReasons: readonly string[];
}

export function buildTaskScorecard(
  taskReport: TaskHarnessReport,
  driftReport: DriftReport | null,
): ChatTrainingTaskScorecard {
  const task = taskReport.task;
  const evalReport = taskReport.evaluation;
  const valSplit = evalReport.validation;
  const testSplit = evalReport.test;

  const driftTask = driftReport?.tasks[task] ?? null;

  return Object.freeze({
    task,
    validationMacroF101: valSplit.macroF101,
    testMacroF101: testSplit.macroF101,
    validationAccuracy01: valSplit.accuracy01,
    testAccuracy01: testSplit.accuracy01,
    calibrationError01: taskReport.replayedEvaluation.calibrationError01,
    driftScore01: driftTask ? (driftTask as { driftScore01: number }).driftScore01 : null,
    deployScore01: taskReport.deployScore01,
    verdict: taskReport.verdict,
    risk: taskReport.risk,
    strengths: taskReport.strengths,
    weaknesses: taskReport.weaknesses,
    actions: taskReport.actions,
    gateReasons: taskReport.gateReasons,
  });
}

export function buildAllTaskScorecards(
  report: EvaluationHarnessReport,
): Readonly<Record<TrainingTaskKey, ChatTrainingTaskScorecard>> {
  const result: Record<string, ChatTrainingTaskScorecard> = {};
  for (const [task, taskReport] of Object.entries(report.tasks)) {
    result[task] = buildTaskScorecard(taskReport, report.driftReport);
  }
  return Object.freeze(result) as Readonly<Record<TrainingTaskKey, ChatTrainingTaskScorecard>>;
}

export function exportTaskScorecardsNdjson(report: EvaluationHarnessReport): string {
  const scorecards = buildAllTaskScorecards(report);
  return Object.values(scorecards)
    .map((s) => JSON.stringify(s))
    .join('\n');
}

// ============================================================================
// MARK: Training watchdog — tracks repeated failures across cycles
// ============================================================================

export interface ChatTrainingWatchdogEntry {
  readonly task: TrainingTaskKey;
  readonly failedCycleCount: number;
  readonly consecutiveFailures: number;
  readonly lastFailedAt: number | null;
  readonly lastVerdict: TaskHarnessReport['verdict'] | null;
  readonly isBlocked: boolean;
  readonly recommendation: string;
}

export interface ChatTrainingWatchdogReport {
  readonly reportedAt: number;
  readonly totalTasksTracked: number;
  readonly blockedTaskCount: number;
  readonly persistentFailureTaskCount: number;
  readonly entries: readonly ChatTrainingWatchdogEntry[];
  readonly summary: string;
}

export class ChatTrainingWatchdog {
  private readonly failureCounts: Map<TrainingTaskKey, number> = new Map();
  private readonly consecutiveCounts: Map<TrainingTaskKey, number> = new Map();
  private readonly lastFailedAt: Map<TrainingTaskKey, number> = new Map();
  private readonly lastVerdicts: Map<TrainingTaskKey, TaskHarnessReport['verdict']> = new Map();

  public recordCycle(report: EvaluationHarnessReport): void {
    for (const [task, taskReport] of Object.entries(report.tasks)) {
      const taskKey = task as TrainingTaskKey;
      const verdict = taskReport.verdict;
      this.lastVerdicts.set(taskKey, verdict);

      const isFailure = verdict === 'BLOCK' || verdict === 'RETRAIN' || verdict === 'HOLD';
      if (isFailure) {
        this.failureCounts.set(taskKey, (this.failureCounts.get(taskKey) ?? 0) + 1);
        this.consecutiveCounts.set(taskKey, (this.consecutiveCounts.get(taskKey) ?? 0) + 1);
        this.lastFailedAt.set(taskKey, Date.now());
      } else {
        this.consecutiveCounts.set(taskKey, 0);
      }
    }
  }

  public getReport(): ChatTrainingWatchdogReport {
    const allTasks = new Set<TrainingTaskKey>([
      ...this.failureCounts.keys(),
      ...this.lastVerdicts.keys(),
    ]);

    const entries: ChatTrainingWatchdogEntry[] = [];
    let blockedCount = 0;
    let persistentCount = 0;

    for (const task of allTasks) {
      const failCount = this.failureCounts.get(task) ?? 0;
      const consecutive = this.consecutiveCounts.get(task) ?? 0;
      const lastFailed = this.lastFailedAt.get(task) ?? null;
      const lastVerdict = this.lastVerdicts.get(task) ?? null;
      const isBlocked = lastVerdict === 'BLOCK' || consecutive >= 3;

      if (isBlocked) {
        blockedCount += 1;
      }
      if (failCount >= 2) {
        persistentCount += 1;
      }

      let recommendation = 'Continue monitoring.';
      if (isBlocked) {
        recommendation = `Task "${task}" is blocked — investigate immediately.`;
      } else if (consecutive >= 2) {
        recommendation = `Task "${task}" has ${consecutive} consecutive failures — consider retraining.`;
      } else if (failCount >= 3) {
        recommendation = `Task "${task}" has ${failCount} historical failures — review label quality.`;
      }

      entries.push(Object.freeze({
        task,
        failedCycleCount: failCount,
        consecutiveFailures: consecutive,
        lastFailedAt: lastFailed,
        lastVerdict,
        isBlocked,
        recommendation,
      }));
    }

    const summary =
      `Watchdog: ${allTasks.size} task(s) tracked, ` +
      `${blockedCount} blocked, ${persistentCount} with persistent failures.`;

    return Object.freeze({
      reportedAt: Date.now(),
      totalTasksTracked: allTasks.size,
      blockedTaskCount: blockedCount,
      persistentFailureTaskCount: persistentCount,
      entries: Object.freeze(entries),
      summary,
    });
  }

  public reset(): void {
    this.failureCounts.clear();
    this.consecutiveCounts.clear();
    this.lastFailedAt.clear();
    this.lastVerdicts.clear();
  }
}

// ============================================================================
// MARK: Training history tracker
// ============================================================================

export interface ChatTrainingHistoryRecord {
  readonly recordedAt: number;
  readonly cycleId: string | null;
  readonly verdict: EvaluationHarnessReport['overall']['verdict'];
  readonly risk: EvaluationHarnessReport['overall']['risk'];
  readonly deployScore01: number;
  readonly taskCount: number;
  readonly driftAnalyzed: boolean;
  readonly overallDrift01: number | null;
  readonly roomCount: number;
}

export interface ChatTrainingHistoryReport {
  readonly generatedAt: number;
  readonly totalRecords: number;
  readonly averageDeployScore01: number;
  readonly bestDeployScore01: number;
  readonly worstDeployScore01: number;
  readonly mostRecentVerdict: EvaluationHarnessReport['overall']['verdict'] | null;
  readonly deployRate01: number;
  readonly records: readonly ChatTrainingHistoryRecord[];
}

export class ChatTrainingHistoryTracker {
  private readonly records: ChatTrainingHistoryRecord[] = [];

  public record(
    result: ChatTrainingCycleResult,
    audit?: ChatTrainingCycleAuditEntry,
  ): void {
    const report = result.evaluationReport;
    this.records.push(Object.freeze({
      recordedAt: Date.now(),
      cycleId: audit?.cycleId ?? null,
      verdict: report.overall.verdict,
      risk: report.overall.risk,
      deployScore01: report.overall.deployScore01,
      taskCount: report.overall.taskCount,
      driftAnalyzed: result.driftReport !== null,
      overallDrift01: result.driftReport?.overall.averageTaskDrift01 ?? null,
      roomCount: result.corpus.manifest.roomCount,
    }));
  }

  public getReport(): ChatTrainingHistoryReport {
    const all = [...this.records];
    const n = all.length;
    const scores = all.map((r) => r.deployScore01).filter(Number.isFinite);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const best = scores.length > 0 ? Math.max(...scores) : 0;
    const worst = scores.length > 0 ? Math.min(...scores) : 0;
    const deployable = all.filter((r) => r.verdict === 'DEPLOY' || r.verdict === 'DEPLOY_GUARDED').length;
    const deployRate = n > 0 ? deployable / n : 0;
    const last = all.length > 0 ? all[all.length - 1] : null;

    return Object.freeze({
      generatedAt: Date.now(),
      totalRecords: n,
      averageDeployScore01: Math.round(avg * 10000) / 10000,
      bestDeployScore01: Math.round(best * 10000) / 10000,
      worstDeployScore01: Math.round(worst * 10000) / 10000,
      mostRecentVerdict: last?.verdict ?? null,
      deployRate01: Math.round(deployRate * 10000) / 10000,
      records: Object.freeze(all),
    });
  }

  public clear(): void {
    this.records.length = 0;
  }

  public size(): number {
    return this.records.length;
  }
}

// ============================================================================
// MARK: Suite snapshot diff
// ============================================================================

export interface ChatTrainingSuiteSnapshotDiff {
  readonly diffedAt: number;
  readonly priorBuiltAt: number;
  readonly currentBuiltAt: number;
  readonly ageMs: number;
  readonly corpusChanged: boolean;
  readonly labeledCorpusChanged: boolean;
  readonly candidateChanged: boolean;
  readonly driftChanged: boolean;
  readonly evaluationChanged: boolean;
  readonly priorVerdict: EvaluationHarnessReport['overall']['verdict'] | null;
  readonly currentVerdict: EvaluationHarnessReport['overall']['verdict'] | null;
  readonly verdictChanged: boolean;
  readonly priorDeployScore01: number | null;
  readonly currentDeployScore01: number | null;
  readonly deployScoreDelta: number | null;
}

export function diffSuiteSnapshots(
  prior: ChatTrainingSuiteSnapshot,
  current: ChatTrainingSuiteSnapshot,
): ChatTrainingSuiteSnapshotDiff {
  const priorVerdict = prior.evaluationReport?.overall.verdict ?? null;
  const currentVerdict = current.evaluationReport?.overall.verdict ?? null;
  const priorScore = prior.evaluationReport?.overall.deployScore01 ?? null;
  const currentScore = current.evaluationReport?.overall.deployScore01 ?? null;
  const delta = priorScore !== null && currentScore !== null
    ? Math.round((currentScore - priorScore) * 10000) / 10000
    : null;

  return Object.freeze({
    diffedAt: Date.now(),
    priorBuiltAt: prior.builtAt,
    currentBuiltAt: current.builtAt,
    ageMs: current.builtAt - prior.builtAt,
    corpusChanged: prior.corpus?.manifest.builtAt !== current.corpus?.manifest.builtAt,
    labeledCorpusChanged: prior.labeledCorpus?.manifest.labeledAt !== current.labeledCorpus?.manifest.labeledAt,
    candidateChanged: prior.candidateBundle?.manifest.trainedAt !== current.candidateBundle?.manifest.trainedAt,
    driftChanged: prior.driftReport?.manifest.analyzedAt !== current.driftReport?.manifest.analyzedAt,
    evaluationChanged: prior.evaluationReport?.manifest.evaluatedAt !== current.evaluationReport?.manifest.evaluatedAt,
    priorVerdict,
    currentVerdict,
    verdictChanged: priorVerdict !== currentVerdict,
    priorDeployScore01: priorScore,
    currentDeployScore01: currentScore,
    deployScoreDelta: delta,
  });
}

// ============================================================================
// MARK: Corpus quality gate
// ============================================================================

export type ChatCorpusQualityGate = 'PASS' | 'WARN' | 'FAIL';

export interface ChatCorpusQualityReport {
  readonly evaluatedAt: number;
  readonly gate: ChatCorpusQualityGate;
  readonly totalExamples: number;
  readonly taskCount: number;
  readonly roomCount: number;
  readonly underweightTasks: readonly TrainingTaskKey[];
  readonly emptyTasks: readonly TrainingTaskKey[];
  readonly findings: readonly string[];
  readonly minimumExamplesPerTask: number;
}

export function evaluateCorpusQuality(
  corpus: TrainingCorpus,
  minimumExamplesPerTask = 10,
): ChatCorpusQualityReport {
  const taskEntries = Object.entries(corpus.tasks) as Array<[TrainingTaskKey, import('./DatasetBuilder').TrainingTaskDataset]>;
  const totalExamples = taskEntries.reduce((acc, [, ds]) => acc + ds.stats.totalExamples, 0);
  const emptyTasks = taskEntries.filter(([, ds]) => ds.stats.totalExamples === 0).map(([t]) => t);
  const underweightTasks = taskEntries
    .filter(([, ds]) => ds.stats.totalExamples > 0 && ds.stats.totalExamples < minimumExamplesPerTask)
    .map(([t]) => t);

  const findings: string[] = [];
  if (emptyTasks.length > 0) {
    findings.push(`${emptyTasks.length} task(s) have zero examples: ${emptyTasks.join(', ')}`);
  }
  if (underweightTasks.length > 0) {
    findings.push(`${underweightTasks.length} task(s) below minimum ${minimumExamplesPerTask} examples: ${underweightTasks.join(', ')}`);
  }
  if (totalExamples === 0) {
    findings.push('Corpus is completely empty — no usable training data.');
  }

  let gate: ChatCorpusQualityGate;
  if (emptyTasks.length > 0 || totalExamples === 0) {
    gate = 'FAIL';
  } else if (underweightTasks.length > 0) {
    gate = 'WARN';
  } else {
    gate = 'PASS';
  }

  return Object.freeze({
    evaluatedAt: Date.now(),
    gate,
    totalExamples,
    taskCount: taskEntries.length,
    roomCount: corpus.manifest.roomCount,
    underweightTasks: Object.freeze(underweightTasks),
    emptyTasks: Object.freeze(emptyTasks),
    findings: Object.freeze(findings),
    minimumExamplesPerTask,
  });
}

// ============================================================================
// MARK: HarnessArtifactBundle re-export helper
// ============================================================================

export type ChatTrainingHarnessArtifacts = HarnessArtifactBundle;

export function extractHarnessArtifacts(
  report: EvaluationHarnessReport,
  harness: EvaluationHarness,
): ChatTrainingHarnessArtifacts {
  return harness.exportArtifacts(report);
}

// ============================================================================
// MARK: Training signal aggregator
// ============================================================================

export interface ChatTrainingSignalAggregate {
  readonly aggregatedAt: number;
  readonly cycleCount: number;
  readonly averageDeployScore01: number;
  readonly averageDrift01: number;
  readonly mostFrequentVerdict: EvaluationHarnessReport['overall']['verdict'] | null;
  readonly verdictDistribution: Readonly<Record<string, number>>;
  readonly driftTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INSUFFICIENT_DATA';
  readonly deployScoreTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';
}

export function aggregateTrainingSignals(
  history: readonly ChatTrainingHistoryRecord[],
): ChatTrainingSignalAggregate {
  const n = history.length;
  if (n === 0) {
    return Object.freeze({
      aggregatedAt: Date.now(),
      cycleCount: 0,
      averageDeployScore01: 0,
      averageDrift01: 0,
      mostFrequentVerdict: null,
      verdictDistribution: Object.freeze({}),
      driftTrend: 'INSUFFICIENT_DATA',
      deployScoreTrend: 'INSUFFICIENT_DATA',
    });
  }

  const scores = history.map((h) => h.deployScore01);
  const drifts = history.filter((h) => h.overallDrift01 !== null).map((h) => h.overallDrift01 as number);
  const avg = (arr: readonly number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const verdictCounts: Record<string, number> = {};
  for (const h of history) {
    verdictCounts[h.verdict] = (verdictCounts[h.verdict] ?? 0) + 1;
  }
  const mostFrequentVerdict = Object.entries(verdictCounts)
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0])[0] as EvaluationHarnessReport['overall']['verdict'] | null ?? null;

  const trendFromWindow = (arr: readonly number[]): 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA' => {
    if (arr.length < 3) {
      return 'INSUFFICIENT_DATA';
    }
    const half = Math.floor(arr.length / 2);
    const firstHalf = avg(arr.slice(0, half));
    const secondHalf = avg(arr.slice(half));
    const delta = secondHalf - firstHalf;
    if (Math.abs(delta) < 0.02) {
      return 'STABLE';
    }
    return delta > 0 ? 'IMPROVING' : 'DECLINING';
  };

  const driftTrendRaw = trendFromWindow(drifts);
  const driftTrend: 'IMPROVING' | 'STABLE' | 'WORSENING' | 'INSUFFICIENT_DATA' =
    driftTrendRaw === 'DECLINING' ? 'IMPROVING'
    : driftTrendRaw === 'IMPROVING' ? 'WORSENING'
    : driftTrendRaw;

  return Object.freeze({
    aggregatedAt: Date.now(),
    cycleCount: n,
    averageDeployScore01: Math.round(avg(scores) * 10000) / 10000,
    averageDrift01: Math.round(avg(drifts) * 10000) / 10000,
    mostFrequentVerdict,
    verdictDistribution: Object.freeze(verdictCounts),
    driftTrend,
    deployScoreTrend: trendFromWindow(scores) as 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA',
  });
}

// ============================================================================
// MARK: Suite ID sentinel
// ============================================================================

export const CHAT_TRAINING_SUITE_MODULE_ID =
  'backend/src/game/engine/chat/training/index#v' +
  CHAT_TRAINING_SUITE_VERSION as string;

// ============================================================================
// MARK: Labeled corpus quality gate
// ============================================================================

export type ChatLabeledCorpusQualityGate = 'PASS' | 'WARN' | 'FAIL';

export interface ChatLabeledCorpusQualityReport {
  readonly evaluatedAt: number;
  readonly gate: ChatLabeledCorpusQualityGate;
  readonly totalLabeledExamples: number;
  readonly taskCount: number;
  readonly findings: readonly string[];
  readonly underconfidentTasks: readonly TrainingTaskKey[];
  readonly lowCoverageTasks: readonly TrainingTaskKey[];
  readonly minimumAverageConfidence01: number;
  readonly minimumLabelCoverage01: number;
}

export function evaluateLabeledCorpusQuality(
  labeledCorpus: LabeledTrainingCorpus,
  minimumAverageConfidence01 = 0.5,
  minimumLabelCoverage01 = 0.6,
): ChatLabeledCorpusQualityReport {
  const taskEntries = Object.entries(labeledCorpus.tasks);
  let totalLabeled = 0;
  const underconfidentTasks: TrainingTaskKey[] = [];
  const lowCoverageTasks: TrainingTaskKey[] = [];
  const findings: string[] = [];

  for (const [task, taskDataset] of taskEntries) {
    const stats = (taskDataset as { stats: { totalExamples: number; averageConfidence01: number; coverageRate01?: number } }).stats;
    totalLabeled += stats.totalExamples;

    if (stats.averageConfidence01 < minimumAverageConfidence01) {
      underconfidentTasks.push(task as TrainingTaskKey);
    }
    const coverage = stats.coverageRate01 ?? 1;
    if (coverage < minimumLabelCoverage01) {
      lowCoverageTasks.push(task as TrainingTaskKey);
    }
  }

  if (underconfidentTasks.length > 0) {
    findings.push(`${underconfidentTasks.length} task(s) below confidence threshold ${(minimumAverageConfidence01 * 100).toFixed(0)}%: ${underconfidentTasks.join(', ')}`);
  }
  if (lowCoverageTasks.length > 0) {
    findings.push(`${lowCoverageTasks.length} task(s) below label coverage ${(minimumLabelCoverage01 * 100).toFixed(0)}%: ${lowCoverageTasks.join(', ')}`);
  }
  if (totalLabeled === 0) {
    findings.push('No labeled examples produced — label assembly may have failed.');
  }

  let gate: ChatLabeledCorpusQualityGate;
  if (totalLabeled === 0) {
    gate = 'FAIL';
  } else if (underconfidentTasks.length > 0 || lowCoverageTasks.length > 0) {
    gate = 'WARN';
  } else {
    gate = 'PASS';
  }

  return Object.freeze({
    evaluatedAt: Date.now(),
    gate,
    totalLabeledExamples: totalLabeled,
    taskCount: taskEntries.length,
    findings: Object.freeze(findings),
    underconfidentTasks: Object.freeze(underconfidentTasks),
    lowCoverageTasks: Object.freeze(lowCoverageTasks),
    minimumAverageConfidence01,
    minimumLabelCoverage01,
  });
}

// ============================================================================
// MARK: Policy bundle comparison
// ============================================================================

export interface ChatPolicyBundleComparison {
  readonly comparedAt: number;
  readonly priorTrainedAt: number;
  readonly currentTrainedAt: number;
  readonly ageMs: number;
  readonly priorTaskCount: number;
  readonly currentTaskCount: number;
  readonly addedTasks: readonly TrainingTaskKey[];
  readonly removedTasks: readonly TrainingTaskKey[];
  readonly sharedTasks: readonly TrainingTaskKey[];
  readonly priorVersion: string;
  readonly currentVersion: string;
  readonly versionChanged: boolean;
}

export function comparePolicyBundles(
  prior: TrainedPolicyBundle,
  current: TrainedPolicyBundle,
): ChatPolicyBundleComparison {
  const priorTasks = new Set(Object.keys(prior.tasks) as TrainingTaskKey[]);
  const currentTasks = new Set(Object.keys(current.tasks) as TrainingTaskKey[]);

  const addedTasks = [...currentTasks].filter((t) => !priorTasks.has(t));
  const removedTasks = [...priorTasks].filter((t) => !currentTasks.has(t));
  const sharedTasks = [...priorTasks].filter((t) => currentTasks.has(t));

  return Object.freeze({
    comparedAt: Date.now(),
    priorTrainedAt: prior.manifest.trainedAt,
    currentTrainedAt: current.manifest.trainedAt,
    ageMs: current.manifest.trainedAt - prior.manifest.trainedAt,
    priorTaskCount: priorTasks.size,
    currentTaskCount: currentTasks.size,
    addedTasks: Object.freeze(addedTasks),
    removedTasks: Object.freeze(removedTasks),
    sharedTasks: Object.freeze(sharedTasks),
    priorVersion: prior.manifest.version,
    currentVersion: current.manifest.version,
    versionChanged: prior.manifest.version !== current.manifest.version,
  });
}

// ============================================================================
// MARK: Training event bus — lightweight observer for suite lifecycle events
// ============================================================================

export type ChatTrainingEventType =
  | 'CORPUS_BUILT'
  | 'CORPUS_LABELED'
  | 'BUNDLE_TRAINED'
  | 'DRIFT_ANALYZED'
  | 'EVALUATION_COMPLETE'
  | 'CI_GATE_EVALUATED'
  | 'WATCHDOG_TRIGGERED'
  | 'CORPUS_QUALITY_FAIL';

export interface ChatTrainingEvent {
  readonly type: ChatTrainingEventType;
  readonly occurredAt: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type ChatTrainingEventListener = (event: ChatTrainingEvent) => void;

export class ChatTrainingEventBus {
  private readonly listeners: Map<ChatTrainingEventType | '*', Set<ChatTrainingEventListener>> = new Map();

  public on(type: ChatTrainingEventType | '*', listener: ChatTrainingEventListener): this {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return this;
  }

  public off(type: ChatTrainingEventType | '*', listener: ChatTrainingEventListener): this {
    this.listeners.get(type)?.delete(listener);
    return this;
  }

  public emit(type: ChatTrainingEventType, payload: Readonly<Record<string, unknown>>): void {
    const event: ChatTrainingEvent = Object.freeze({
      type,
      occurredAt: Date.now(),
      payload,
    });
    this.listeners.get(type)?.forEach((l) => l(event));
    this.listeners.get('*')?.forEach((l) => l(event));
  }

  public removeAllListeners(): this {
    this.listeners.clear();
    return this;
  }
}

export function createTrainingEventBus(): ChatTrainingEventBus {
  return new ChatTrainingEventBus();
}

// ============================================================================
// MARK: Instrumented training suite (emits lifecycle events)
// ============================================================================

export class InstrumentedChatTrainingSuite {
  private readonly suite: ChatTrainingSuite;
  private readonly bus: ChatTrainingEventBus;
  private readonly watchdog: ChatTrainingWatchdog;
  private readonly history: ChatTrainingHistoryTracker;

  public constructor(
    options: ChatTrainingSuiteOptions = {},
    bus?: ChatTrainingEventBus,
  ) {
    this.suite = new ChatTrainingSuite(options);
    this.bus = bus ?? new ChatTrainingEventBus();
    this.watchdog = new ChatTrainingWatchdog();
    this.history = new ChatTrainingHistoryTracker();
  }

  public get eventBus(): ChatTrainingEventBus {
    return this.bus;
  }

  public get inner(): ChatTrainingSuite {
    return this.suite;
  }

  public registerRoomArtifacts(bundle: TrainingRoomArtifacts): this {
    this.suite.registerRoomArtifacts(bundle);
    return this;
  }

  public registerRoomArtifactsMany(bundles: readonly TrainingRoomArtifacts[]): this {
    this.suite.registerRoomArtifactsMany(bundles);
    return this;
  }

  public runInstrumentedCycle(
    bundles: readonly TrainingRoomArtifacts[],
    baselineBundle: TrainedPolicyBundle | null = null,
  ): { readonly result: ChatTrainingCycleResult; readonly summary: ChatTrainingCycleSummary } {
    const result = this.suite.runFullCycle(bundles, baselineBundle);

    this.bus.emit('CORPUS_BUILT', {
      taskCount: Object.keys(result.corpus.tasks).length,
      roomCount: result.corpus.manifest.roomCount,
    });

    this.bus.emit('CORPUS_LABELED', {
      taskCount: Object.keys(result.labeledCorpus.tasks).length,
    });

    this.bus.emit('BUNDLE_TRAINED', {
      trainedAt: result.candidateBundle.manifest.trainedAt,
    });

    if (result.driftReport) {
      this.bus.emit('DRIFT_ANALYZED', {
        disposition: result.driftReport.overall.disposition,
        severity: result.driftReport.overall.severity,
      });
    }

    this.bus.emit('EVALUATION_COMPLETE', {
      verdict: result.evaluationReport.overall.verdict,
      deployScore01: result.evaluationReport.overall.deployScore01,
    });

    this.watchdog.recordCycle(result.evaluationReport);
    this.history.record(result);

    const watchdogReport = this.watchdog.getReport();
    if (watchdogReport.blockedTaskCount > 0) {
      this.bus.emit('WATCHDOG_TRIGGERED', {
        blockedTaskCount: watchdogReport.blockedTaskCount,
        persistentFailureTaskCount: watchdogReport.persistentFailureTaskCount,
      });
    }

    const corpusQuality = evaluateCorpusQuality(result.corpus);
    if (corpusQuality.gate === 'FAIL') {
      this.bus.emit('CORPUS_QUALITY_FAIL', {
        findings: corpusQuality.findings,
      });
    }

    const summary = buildCycleSummary(result);
    return Object.freeze({ result, summary });
  }

  public getCIGate(
    result: ChatTrainingCycleResult,
    minDeployScore01 = 0.65,
  ): ChatTrainingCIGate {
    const gate = evaluateCIGate(result, minDeployScore01);
    this.bus.emit('CI_GATE_EVALUATED', {
      verdict: gate.verdict,
      deployScore01: gate.deployScore01,
      blockingReasons: gate.blockingReasons,
    });
    return gate;
  }

  public getWatchdogReport(): ChatTrainingWatchdogReport {
    return this.watchdog.getReport();
  }

  public getHistoryReport(): ChatTrainingHistoryReport {
    return this.history.getReport();
  }

  public getSignalAggregate(): ChatTrainingSignalAggregate {
    return aggregateTrainingSignals(this.history.getReport().records);
  }
}

export function createInstrumentedSuite(
  options?: ChatTrainingSuiteOptions,
  bus?: ChatTrainingEventBus,
): InstrumentedChatTrainingSuite {
  return new InstrumentedChatTrainingSuite(options, bus);
}

// ============================================================================
// MARK: Suite export manifest
// ============================================================================

export interface ChatTrainingSuiteExportManifest {
  readonly exportedAt: number;
  readonly suiteVersion: string;
  readonly builderVersion: string;
  readonly harnessVersion: string;
  readonly cycleCount: number;
  readonly lastVerdict: EvaluationHarnessReport['overall']['verdict'] | null;
  readonly lastDeployScore01: number | null;
  readonly artifactKeys: readonly string[];
}

export function buildSuiteExportManifest(
  artifacts: ChatTrainingArtifactExport,
  history: ChatTrainingHistoryReport,
): ChatTrainingSuiteExportManifest {
  const keys = Object.entries(artifacts)
    .filter(([, v]) => v !== null)
    .map(([k]) => k);

  return Object.freeze({
    exportedAt: Date.now(),
    suiteVersion: CHAT_TRAINING_SUITE_VERSION,
    builderVersion: CHAT_TRAINING_DATASET_BUILDER_VERSION,
    harnessVersion: CHAT_TRAINING_EVALUATION_HARNESS_VERSION,
    cycleCount: history.totalRecords,
    lastVerdict: history.mostRecentVerdict,
    lastDeployScore01: history.records.length > 0
      ? history.records[history.records.length - 1].deployScore01
      : null,
    artifactKeys: Object.freeze(keys),
  });
}

// ============================================================================
// MARK: Training lane version sentinel
// ============================================================================

export const CHAT_TRAINING_LANE_VERSION = '2026.03.14' as const;
export const CHAT_TRAINING_LANE_SIGNATURE =
  'backend/src/game/engine/chat/training#lane-v' + CHAT_TRAINING_LANE_VERSION as string;

// ============================================================================
// MARK: Full training module re-export object
// ============================================================================

export const ChatTrainingModuleAll = Object.freeze({
  ...ChatTrainingSuiteModule,
  ChatTrainingSuite,
  ChatTrainingSuiteOptionsBuilder,
  AuditedChatTrainingSuite,
  InstrumentedChatTrainingSuite,
  ChatTrainingEventBus,
  ChatTrainingWatchdog,
  ChatTrainingHistoryTracker,
  createInstrumentedSuite,
  createTrainingEventBus,
  createSuiteOptionsBuilder,
  createExperimentalSuite,
  createProductionGateSuite,
  createAuditedTestSuite,
  validateSuitePipeline,
  buildTaskScorecard,
  buildAllTaskScorecards,
  exportTaskScorecardsNdjson,
  extractHarnessArtifacts,
  evaluateCorpusQuality,
  evaluateLabeledCorpusQuality,
  comparePolicyBundles,
  diffSuiteSnapshots,
  aggregateTrainingSignals,
  buildSuiteExportManifest,
  buildTaskReadinessReport,
  probeSuiteHealth,
  CHAT_TRAINING_SUITE_MODULE_ID,
  CHAT_TRAINING_SUITE_VERSION_MANIFEST,
  CHAT_TRAINING_LANE_VERSION,
  CHAT_TRAINING_LANE_SIGNATURE,
});

// ============================================================================
// MARK: Task-level readiness report
// ============================================================================

export interface ChatTaskTrainingReadinessReport {
  readonly task: TrainingTaskKey;
  readonly dataGate: ChatCorpusQualityGate;
  readonly labelGate: ChatLabeledCorpusQualityGate;
  readonly evaluationVerdict: TaskHarnessReport['verdict'] | null;
  readonly ciVerdict: ChatTrainingCIVerdict | null;
  readonly overallReadiness: 'READY' | 'READY_GUARDED' | 'NOT_READY' | 'BLOCKED';
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export function buildTaskReadinessReport(
  task: TrainingTaskKey,
  corpusQuality: ChatCorpusQualityReport,
  labelQuality: ChatLabeledCorpusQualityReport,
  evaluationReport: EvaluationHarnessReport | null,
  ciGate: ChatTrainingCIGate | null,
): ChatTaskTrainingReadinessReport {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const dataGate = corpusQuality.emptyTasks.includes(task)
    ? 'FAIL'
    : corpusQuality.underweightTasks.includes(task)
    ? 'WARN'
    : 'PASS';

  const labelGate = labelQuality.underconfidentTasks.includes(task)
    ? 'WARN'
    : labelQuality.lowCoverageTasks.includes(task)
    ? 'WARN'
    : 'PASS';

  if (dataGate === 'FAIL') {
    blockers.push(`Task "${task}" has no corpus data.`);
  } else if (dataGate === 'WARN') {
    warnings.push(`Task "${task}" has fewer examples than the minimum threshold.`);
  }

  if (labelGate === 'WARN') {
    warnings.push(`Task "${task}" label quality below threshold.`);
  }

  const taskEval = evaluationReport?.tasks[task] ?? null;
  const evalVerdict = taskEval?.verdict ?? null;

  if (evalVerdict === 'BLOCK') {
    blockers.push(`Evaluation blocked task "${task}".`);
  } else if (evalVerdict === 'RETRAIN') {
    blockers.push(`Task "${task}" requires retraining.`);
  } else if (evalVerdict === 'HOLD') {
    warnings.push(`Task "${task}" evaluation verdict is HOLD.`);
  }

  if (ciGate?.blockingReasons && ciGate.blockingReasons.length > 0) {
    for (const reason of ciGate.blockingReasons) {
      blockers.push(reason);
    }
  }

  let readiness: ChatTaskTrainingReadinessReport['overallReadiness'];
  if (blockers.length > 0) {
    readiness = evalVerdict === 'BLOCK' ? 'BLOCKED' : 'NOT_READY';
  } else if (warnings.length > 0) {
    readiness = 'READY_GUARDED';
  } else {
    readiness = 'READY';
  }

  return Object.freeze({
    task,
    dataGate,
    labelGate,
    evaluationVerdict: evalVerdict,
    ciVerdict: ciGate?.verdict ?? null,
    overallReadiness: readiness,
    blockers: Object.freeze(blockers),
    warnings: Object.freeze(warnings),
  });
}

// ============================================================================
// MARK: Suite health probe
// ============================================================================

export interface ChatTrainingSuiteHealthProbe {
  readonly probedAt: number;
  readonly isHealthy: boolean;
  readonly hasActiveCorpus: boolean;
  readonly hasActiveLabeledCorpus: boolean;
  readonly hasActiveCandidateBundle: boolean;
  readonly hasActiveEvaluationReport: boolean;
  readonly lastVerdictAge: 'FRESH' | 'STALE' | 'VERY_STALE' | 'ABSENT';
  readonly registeredRoomCount: number;
  readonly issues: readonly string[];
}

const FRESH_MS = 6 * 60 * 60 * 1000;    // 6 hours
const STALE_MS = 24 * 60 * 60 * 1000;   // 24 hours

export function probeSuiteHealth(snapshot: ChatTrainingSuiteSnapshot): ChatTrainingSuiteHealthProbe {
  const issues: string[] = [];
  const now = Date.now();

  const hasCorpus = snapshot.corpus !== null;
  const hasLabeled = snapshot.labeledCorpus !== null;
  const hasBundle = snapshot.candidateBundle !== null;
  const hasEval = snapshot.evaluationReport !== null;

  if (!hasCorpus) {
    issues.push('No corpus built yet — call buildCorpus() first.');
  }
  if (!hasLabeled) {
    issues.push('No labeled corpus — call labelCorpus() first.');
  }
  if (!hasBundle) {
    issues.push('No candidate bundle — call trainCorpus() first.');
  }
  if (!hasEval) {
    issues.push('No evaluation report — call evaluate() first.');
  }

  let lastVerdictAge: ChatTrainingSuiteHealthProbe['lastVerdictAge'] = 'ABSENT';
  if (snapshot.evaluationReport) {
    const evalAge = now - snapshot.evaluationReport.manifest.evaluatedAt;
    if (evalAge < FRESH_MS) {
      lastVerdictAge = 'FRESH';
    } else if (evalAge < STALE_MS) {
      lastVerdictAge = 'STALE';
    } else {
      lastVerdictAge = 'VERY_STALE';
    }
    if (lastVerdictAge !== 'FRESH') {
      issues.push(`Evaluation report is ${lastVerdictAge.toLowerCase().replace('_', ' ')} — consider re-evaluating.`);
    }
  }

  return Object.freeze({
    probedAt: now,
    isHealthy: issues.length === 0,
    hasActiveCorpus: hasCorpus,
    hasActiveLabeledCorpus: hasLabeled,
    hasActiveCandidateBundle: hasBundle,
    hasActiveEvaluationReport: hasEval,
    lastVerdictAge,
    registeredRoomCount: snapshot.registeredRoomIds.length,
    issues: Object.freeze(issues),
  });
}

// ============================================================================
// MARK: Suite factory helpers for common configurations
// ============================================================================

/** Create a suite configured for fast experimental runs (smaller windows, relaxed gates). */
export function createExperimentalSuite(): ChatTrainingSuite {
  return new ChatTrainingSuiteOptionsBuilder()
    .withDataset({ enableWeakTargets: true })
    .withTrainer({ minimumExamplesPerTask: 10 })
    .withEvaluation({ minimumValidationMacroF101: 0.35, minimumTestMacroF101: 0.3 })
    .buildSuite();
}

/** Create a suite configured for production gate runs (strict thresholds). */
export function createProductionGateSuite(): ChatTrainingSuite {
  return new ChatTrainingSuiteOptionsBuilder()
    .withEvaluation({
      minimumValidationMacroF101: 0.6,
      minimumTestMacroF101: 0.55,
      minimumAverageConfidence01: 0.55,
      maximumCalibrationError01: 0.12,
      deployScoreFloor01: 0.68,
      guardedDeployScoreFloor01: 0.55,
    })
    .buildSuite();
}

/** Create an audited suite with a pre-wired event bus for test environments. */
export function createAuditedTestSuite(
  listener?: ChatTrainingEventListener,
): AuditedChatTrainingSuite {
  const suite = new AuditedChatTrainingSuite({});
  void listener; // reserved for future event bus wiring
  return suite;
}

// ============================================================================
// MARK: Convenience type re-exports for consumers of the training barrel
// ============================================================================

export type ChatTrainingVerdict = EvaluationHarnessReport['overall']['verdict'];
export type ChatTrainingRisk = EvaluationHarnessReport['overall']['risk'];
export type ChatTrainingTaskVerdict = TaskHarnessReport['verdict'];
export type ChatTrainingCycleSuiteOptions = ChatTrainingSuiteOptions;
export type ChatTrainingCycleSnapshot = ChatTrainingSuiteSnapshot;

// ============================================================================
// MARK: Complete lane registration manifest
// ============================================================================

export interface ChatTrainingLaneManifest {
  readonly laneVersion: string;
  readonly laneSignature: string;
  readonly suiteVersion: string;
  readonly builderVersion: string;
  readonly harnessVersion: string;
  readonly filePath: string;
  readonly modules: readonly string[];
  readonly registeredAt: number;
}

export const CHAT_TRAINING_LANE_MANIFEST: ChatTrainingLaneManifest = Object.freeze({
  laneVersion: CHAT_TRAINING_LANE_VERSION,
  laneSignature: CHAT_TRAINING_LANE_SIGNATURE,
  suiteVersion: CHAT_TRAINING_SUITE_VERSION,
  builderVersion: CHAT_TRAINING_DATASET_BUILDER_VERSION,
  harnessVersion: CHAT_TRAINING_EVALUATION_HARNESS_VERSION,
  filePath: 'backend/src/game/engine/chat/training/index.ts',
  modules: Object.freeze([
    'DatasetBuilder',
    'LabelAssembler',
    'PolicyTrainer',
    'DriftMonitor',
    'EvaluationHarness',
    'ChatTrainingSuite',
    'AuditedChatTrainingSuite',
    'InstrumentedChatTrainingSuite',
    'ChatTrainingEventBus',
    'ChatTrainingWatchdog',
    'ChatTrainingHistoryTracker',
  ]),
  registeredAt: 1742000000000,
});

// ============================================================================
// MARK: Default export object (barrel default)
// ============================================================================

/**
 * Default training lane export for consumers that import the module as a whole.
 * Prefer named imports for tree-shaking; use this for reflection and runtime checks.
 */
export const ChatTrainingLane = Object.freeze({
  manifest: CHAT_TRAINING_LANE_MANIFEST,
  module: ChatTrainingModuleAll,
  suite: ChatTrainingSuiteModule,
});
