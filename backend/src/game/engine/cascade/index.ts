/**
 * backend/src/game/engine/cascade/index.ts
 *
 * Canonical public barrel and runtime wiring hub for the cascade subsystem.
 *
 * Architecture:
 *  - `export * from './types'`            → all cascade types, constants, guards
 *  - per-file named exports              → classes and file-specific interfaces
 *  - `CascadeSubsystem`                  → unified runtime wiring: registry,
 *                                           queue, recovery, positive, validator,
 *                                           engine — all pre-wired, ML/DL ready
 *
 * Naming conventions:
 *  - Types and constants from types.ts are the canonical versions.
 *  - RecoveryConditionChecker.ts defines its own local RecoveryConditionStatus
 *    and RecoveryConditionEvaluation (different shapes from types.ts).
 *    They are re-exported with the "Checker" prefix to avoid TS2308 collisions.
 *
 * Usage from engine/index.ts:
 *   export * as Cascade from './cascade';
 *   // Consumers: import { Cascade } from '../../engine';
 *   //            const sub = new Cascade.CascadeSubsystem();
 *
 * ML / DL surfaces exposed by this barrel:
 *   CascadeSubsystem.extractMLBundle(snapshot, templates)
 *   CascadeSubsystem.extractDLInputTensor(snapshot, templates)
 *   CascadeSubsystem.runInferenceCycle(snapshot, template, trigger, pending)
 *   CascadeSubsystem.batchInferenceCycle(snapshot, templates, pending)
 */

// ─── 1. CANONICAL TYPES & CONSTANTS (ground truth) ───────────────────────────
export * from './types';

// ─── 2. CASCADE ENGINE (main SimulationEngine implementation) ─────────────────
export { CascadeEngine } from './CascadeEngine';

// ─── 3. CASCADE CHAIN REGISTRY ────────────────────────────────────────────────
export {
  CascadeChainRegistry,
  type CascadeTemplateEffectProfile,
  type CascadeTemplateMLSignal,
  type CascadeModePressureMatrix,
  type CascadeLayerAffinityMap,
  type CascadeRegistrySnapshot,
  type CascadeRecoveryTagUniverseReport,
  type CascadeTemplateRankingEntry,
  type CascadeRegistryDiagnostics,
} from './CascadeChainRegistry';

// ─── 4. CASCADE QUEUE MANAGER ─────────────────────────────────────────────────
export { CascadeQueueManager } from './CascadeQueueManager';

// ─── 5. RECOVERY CONDITION CHECKER ───────────────────────────────────────────
// Note: RecoveryConditionStatus and RecoveryConditionEvaluation exist in
// BOTH types.ts (canonical shapes) AND RecoveryConditionChecker.ts (local
// shapes with different fields). The checker-local versions are aliased.
export {
  RecoveryConditionChecker,
  type RecoveryEvidenceSource,
  type LegacyRecoveryHit,
  type RecoveryEvaluationReport,
  type RecoveryConditionStatus as CheckerRecoveryConditionStatus,
  type RecoveryConditionEvaluation as CheckerRecoveryConditionEvaluation,
} from './RecoveryConditionChecker';

// ─── 6. POSITIVE CASCADE TRACKER ─────────────────────────────────────────────
export {
  PositiveCascadeTracker,
  type PositiveCascadeInferenceReport,
} from './PositiveCascadeTracker';

// ─── 7. CASCADE TEMPLATE VALIDATOR ───────────────────────────────────────────
export { CascadeTemplateValidator } from './CascadeTemplateValidator';

// ─── 8. INTERNAL IMPORTS FOR WIRING ──────────────────────────────────────────
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import type { CascadeChainInstance, EffectPayload } from '../core/GamePrimitives';
import { CascadeEngine } from './CascadeEngine';
import { CascadeChainRegistry } from './CascadeChainRegistry';
import type { CascadeRegistrySnapshot, CascadeTemplateMLSignal } from './CascadeChainRegistry';
import { CascadeQueueManager } from './CascadeQueueManager';
import { RecoveryConditionChecker } from './RecoveryConditionChecker';
import { PositiveCascadeTracker } from './PositiveCascadeTracker';
import { CascadeTemplateValidator } from './CascadeTemplateValidator';
import type {
  CascadeTemplate,
  CascadeTemplateId,
  CascadeSeverity,
  CreationDiagnostics,
  NumericEffectField,
  PositiveCascadeEvaluationState,
  QueueDecisionResult,
  QueueLinkEffectBreakdown,
} from './types';
import {
  CASCADE_TEMPLATE_IDS,
  CASCADE_TEMPLATE_POLARITY_BY_ID,
  CASCADE_SEVERITIES,
  NUMERIC_EFFECT_FIELDS,
  POSITIVE_CASCADE_EVALUATION_STATES,
  buildCascadeTemplateManifest,
} from './types';

// ─── 9. SUBSYSTEM TYPES ───────────────────────────────────────────────────────

/** Full ML feature bundle produced by the subsystem's inference aggregation. */
export interface CascadeMLBundle {
  /** Queue scalar feature vector (14 elements). */
  readonly queueScalarVector: readonly number[];
  /** Queue acceleration feature vector (9 elements). */
  readonly queueAccelerationVector: readonly number[];
  /** Recovery readiness score per active chain (0–1). */
  readonly recoveryReadinessScores: Readonly<Record<string, number>>;
  /** Recovery ML feature vectors per active chain (12 elements each). */
  readonly recoveryMLVectors: Readonly<Record<string, readonly number[]>>;
  /** Positive cascade momentum vector (16 elements). */
  readonly momentumVector: readonly number[];
  /** Positive cascade comeback vector (16 elements). */
  readonly comebackVector: readonly number[];
  /** Normalized metrics for every positive cascade metric key (0–1). */
  readonly normalizedPositiveMetrics: Readonly<Record<string, number>>;
  /** Evaluation states per positive cascade template ID. */
  readonly positiveCascadeStates: Readonly<Record<string, PositiveCascadeEvaluationState>>;
  /** Unlock probability projection per positive cascade (0–1). */
  readonly unlockProbabilities: Readonly<Record<string, number>>;
  /** Template quality scores per template ID (0–1). */
  readonly templateQualityScores: Readonly<Record<CascadeTemplateId, number>>;
  /** Chain count by severity. */
  readonly chainCountBySeverity: Readonly<Record<CascadeSeverity, number>>;
  /** Active chain count. */
  readonly activeChainCount: number;
  /** Tick at which this bundle was computed. */
  readonly computedAtTick: number;
}

/** Single-chain inference result for DL pipelines. */
export interface CascadeChainInferenceResult {
  readonly chainId: string;
  readonly templateId: string;
  readonly recoveryReadiness: number;
  readonly recoveryMLVector: readonly number[];
  readonly queueDecision: QueueDecisionResult | null;
  readonly linkEffectBreakdown: readonly QueueLinkEffectBreakdown[];
  readonly effectTotals: Readonly<Record<NumericEffectField, number>> | null;
  readonly notes: readonly string[];
}

/** DL input tensor: flat Float32-ready array + dimension metadata. */
export interface CascadeDLInputTensor {
  readonly data: readonly number[];
  readonly dims: readonly number[];
  readonly labels: readonly string[];
  readonly computedAtTick: number;
}

/** Runtime cycle result from `runInferenceCycle`. */
export interface CascadeInferenceCycleResult {
  readonly queueDecision: QueueDecisionResult;
  readonly creationDiagnostics: CreationDiagnostics;
  readonly linkBreakdown: readonly QueueLinkEffectBreakdown[];
  readonly effectTotals: Readonly<Record<NumericEffectField, number>> | null;
  readonly recoveryReadiness: number;
  readonly recoveryMLVector: readonly number[];
  readonly templateQualityScore: number;
  readonly notes: readonly string[];
}

/** Aggregate diagnostic report for the whole subsystem at a given tick. */
export interface CascadeSubsystemDiagnostics {
  readonly tick: number;
  readonly activeChainCount: number;
  readonly completedChainCount: number;
  readonly positiveEvaluation: Readonly<Record<string, PositiveCascadeEvaluationState>>;
  readonly recoveryReadinessByChain: Readonly<Record<string, number>>;
  readonly templateValidityByChain: Readonly<Record<string, boolean>>;
  readonly registrySnapshot: CascadeRegistrySnapshot;
  readonly notes: readonly string[];
}

/** Health report for the cascade subsystem. */
export interface CascadeSubsystemHealth {
  readonly healthy: boolean;
  readonly engineInitialized: boolean;
  readonly registryPopulated: boolean;
  readonly queueManagerReady: boolean;
  readonly recoveryCheckerReady: boolean;
  readonly positiveTrackerReady: boolean;
  readonly validatorReady: boolean;
  readonly activeChainCount: number;
  readonly lastComputedTick: number | null;
  readonly issues: readonly string[];
}

// ─── 10. CASCADE SUBSYSTEM ────────────────────────────────────────────────────

/**
 * CascadeSubsystem
 *
 * The primary wiring hub for the entire cascade subsystem. Instantiate once
 * per run and call methods to drive all ML and DL operations.
 *
 * All six service components (Engine, Registry, QueueManager, RecoveryChecker,
 * PositiveTracker, TemplateValidator) are pre-wired and available as readonly
 * properties. The subsystem also provides:
 *
 *  - `extractMLBundle()`        → full ML feature bundle per tick
 *  - `extractDLInputTensor()`   → flat Float32-ready DL tensor
 *  - `runInferenceCycle()`      → per-template ML/DL inference pass
 *  - `batchInferenceCycle()`    → all active chains in one pass
 *  - `getDiagnostics()`         → aggregate system health snapshot
 *  - `getHealth()`              → boolean health summary
 *
 * The engine is a SimulationEngine driven by the orchestrator.
 * The registry, queue, recovery, positive, and validator components are
 * independent analytics instances separate from the engine's internals.
 */
export class CascadeSubsystem {
  // ── Service components ──────────────────────────────────────────────────────
  readonly engine: CascadeEngine;
  readonly registry: CascadeChainRegistry;
  readonly queue: CascadeQueueManager;
  readonly recovery: RecoveryConditionChecker;
  readonly positive: PositiveCascadeTracker;
  readonly validator: CascadeTemplateValidator;

  // ── Internal state ──────────────────────────────────────────────────────────
  private _lastComputedTick: number | null = null;
  private _lastMLBundle: CascadeMLBundle | null = null;

  constructor() {
    this.engine = new CascadeEngine();
    this.registry = new CascadeChainRegistry();
    this.queue = new CascadeQueueManager();
    this.recovery = new RecoveryConditionChecker();
    this.positive = new PositiveCascadeTracker();
    this.validator = new CascadeTemplateValidator();
  }

  // ── ML / DL entry points ────────────────────────────────────────────────────

  /**
   * Extracts the full ML feature bundle for the current snapshot.
   * Covers: queue scalars, queue acceleration, recovery readiness per chain,
   * positive cascade states, unlock probabilities, template quality scores.
   *
   * Results are cached per tick — calling multiple times on the same tick
   * is essentially free.
   */
  extractMLBundle(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[]
  ): CascadeMLBundle {
    const tick = snapshot.tick;
    if (this._lastComputedTick === tick && this._lastMLBundle !== null) {
      return this._lastMLBundle;
    }

    const activeChains = snapshot.cascade.activeChains;
    const firstTemplate = templates[0] ?? null;

    let queueScalarVector: readonly number[] = [];
    let queueAccelerationVector: readonly number[] = [];

    if (firstTemplate !== null) {
      const trigger = this._buildSyntheticTrigger(snapshot, firstTemplate);
      queueScalarVector = this.queue.computeScalarFeatureVector(
        snapshot,
        firstTemplate,
        trigger,
        activeChains
      );
      queueAccelerationVector = this.queue.computeAccelerationFeatureVector(
        snapshot,
        firstTemplate,
        trigger,
        activeChains
      );
    }

    // Recovery readiness per active chain
    const recoveryReadinessScores: Record<string, number> = {};
    const recoveryMLVectors: Record<string, readonly number[]> = {};
    for (const chain of activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId) ?? null;
      if (tpl === null) continue;
      recoveryReadinessScores[chain.chainId] =
        this.recovery.computeRecoveryReadinessScore(chain, snapshot, tpl);
      recoveryMLVectors[chain.chainId] =
        this.recovery.computeMLRecoveryFeatureVector(chain, snapshot, tpl);
    }

    // Positive cascade tracking
    const momentumVector = this.positive.computeMomentumMLFeatureVector(snapshot);
    const comebackVector = this.positive.computeComebackMLFeatureVector(snapshot);
    const normalizedPositiveMetrics = this.positive.computeNormalizedMetrics(snapshot);
    const positiveCascadeStates = this._buildPositiveCascadeStates(snapshot);
    const unlockProbabilities = this.positive.getUnlockProbabilityProjection(snapshot);

    // Template quality scores
    const templateQualityScores = this._buildTemplateQualityScores(templates);

    // Chain counts by severity (derived from templates)
    const chainCountBySeverity = this._buildChainCountBySeverity(activeChains, templates);

    const bundle: CascadeMLBundle = {
      queueScalarVector,
      queueAccelerationVector,
      recoveryReadinessScores,
      recoveryMLVectors,
      momentumVector,
      comebackVector,
      normalizedPositiveMetrics,
      positiveCascadeStates,
      unlockProbabilities,
      templateQualityScores,
      chainCountBySeverity,
      activeChainCount: activeChains.length,
      computedAtTick: tick,
    };

    this._lastComputedTick = tick;
    this._lastMLBundle = bundle;
    return bundle;
  }

  /**
   * Produces a flat Float32-ready DL input tensor from the current snapshot.
   * The tensor concatenates all ML feature vectors in a stable order so that
   * a downstream DL model always receives the same-shaped input.
   *
   * Layout:
   *   [0..13]   queue scalar vector (14)
   *   [14..22]  queue acceleration vector (9)
   *   [23..38]  positive momentum vector (16)
   *   [39..54]  positive comeback vector (16)
   *   [55..N]   normalized positive metrics (variable, sorted by key)
   *   [N+1..]   recovery readiness scores (sorted by chainId, zero-padded)
   *
   * Total fixed prefix = 55 elements, plus dynamic sections.
   */
  extractDLInputTensor(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[]
  ): CascadeDLInputTensor {
    const bundle = this.extractMLBundle(snapshot, templates);

    const sortedPositiveMetricKeys = Object.keys(bundle.normalizedPositiveMetrics).sort();
    const positiveMetricValues = sortedPositiveMetricKeys.map(
      (k) => bundle.normalizedPositiveMetrics[k] ?? 0
    );

    const sortedChainIds = Object.keys(bundle.recoveryReadinessScores).sort();
    const recoveryValues = sortedChainIds.map(
      (id) => bundle.recoveryReadinessScores[id] ?? 0
    );

    const data: number[] = [
      ...bundle.queueScalarVector,
      ...bundle.queueAccelerationVector,
      ...bundle.momentumVector,
      ...bundle.comebackVector,
      ...positiveMetricValues,
      ...recoveryValues,
    ];

    const labels: string[] = [
      ...Array.from({ length: bundle.queueScalarVector.length }, (_, i) => `queue_scalar_${i}`),
      ...Array.from({ length: bundle.queueAccelerationVector.length }, (_, i) => `queue_accel_${i}`),
      ...Array.from({ length: bundle.momentumVector.length }, (_, i) => `momentum_${i}`),
      ...Array.from({ length: bundle.comebackVector.length }, (_, i) => `comeback_${i}`),
      ...sortedPositiveMetricKeys.map((k) => `pos_metric_${k}`),
      ...sortedChainIds.map((id) => `recovery_${id}`),
    ];

    return {
      data,
      dims: [1, data.length],
      labels,
      computedAtTick: snapshot.tick,
    };
  }

  /**
   * Runs a full ML/DL inference cycle for a specific template and trigger.
   * Returns queue decision, creation diagnostics, link breakdown, effect
   * totals, recovery readiness, and template quality score.
   */
  runInferenceCycle(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[]
  ): CascadeInferenceCycleResult {
    const activeChains = snapshot.cascade.activeChains;
    const allPending = this._mergeChains(pendingChains, activeChains);
    const pendingTriggerCount = allPending.filter(
      (c) => c.templateId === template.templateId
    ).length;

    const queueDecision = this.queue.getQueueDecision(
      snapshot,
      template,
      trigger,
      allPending,
      pendingTriggerCount
    );

    const creationDiagnostics = this.queue.diagnose(
      snapshot,
      template,
      trigger,
      allPending
    );

    const linkBreakdown = this.queue.breakdownLinkEffects(
      snapshot,
      template,
      trigger,
      allPending
    );

    const effectTotals = this.queue.computeChainEffectTotals(
      snapshot,
      template,
      trigger,
      allPending
    );

    const matchingChain = allPending.find((c) => c.templateId === template.templateId) ?? null;

    let recoveryReadiness = 0;
    let recoveryMLVector: readonly number[] = [];
    if (matchingChain !== null) {
      recoveryReadiness = this.recovery.computeRecoveryReadinessScore(
        matchingChain,
        snapshot,
        template
      );
      recoveryMLVector = this.recovery.computeMLRecoveryFeatureVector(
        matchingChain,
        snapshot,
        template
      );
    }

    const templateQualityScore = this.validator.computeTemplateQualityScore(template);

    const notes: string[] = [];
    if (queueDecision.allowed) notes.push('queue:WOULD_CREATE');
    if (!queueDecision.allowed) notes.push(`queue:DENIED:${queueDecision.reasonCode}`);
    if (recoveryReadiness > 0.8) notes.push('recovery:HIGH_READINESS');
    if (templateQualityScore < 0.5) notes.push('template:LOW_QUALITY');

    return {
      queueDecision,
      creationDiagnostics,
      linkBreakdown,
      effectTotals,
      recoveryReadiness,
      recoveryMLVector,
      templateQualityScore,
      notes,
    };
  }

  /**
   * Runs inference for every chain in pendingChains simultaneously.
   * Useful for batch DL pipelines processing all active chains in one pass.
   */
  batchInferenceCycle(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[],
    pendingChains: readonly CascadeChainInstance[]
  ): readonly CascadeChainInferenceResult[] {
    const results: CascadeChainInferenceResult[] = [];

    for (const chain of pendingChains) {
      const template = templates.find((t) => t.templateId === chain.templateId);
      if (template === undefined) {
        results.push({
          chainId: chain.chainId,
          templateId: chain.templateId,
          recoveryReadiness: 0,
          recoveryMLVector: [],
          queueDecision: null,
          linkEffectBreakdown: [],
          effectTotals: null,
          notes: ['template:NOT_FOUND'],
        });
        continue;
      }

      const trigger = this._buildSyntheticTrigger(snapshot, template);
      const pendingTriggerCount = pendingChains.filter(
        (c) => c.templateId === template.templateId
      ).length;

      const queueDecision = this.queue.getQueueDecision(
        snapshot,
        template,
        trigger,
        pendingChains,
        pendingTriggerCount
      );

      const linkBreakdown = this.queue.breakdownLinkEffects(
        snapshot,
        template,
        trigger,
        pendingChains
      );

      const effectTotals = this.queue.computeChainEffectTotals(
        snapshot,
        template,
        trigger,
        pendingChains
      );

      const recoveryReadiness = this.recovery.computeRecoveryReadinessScore(
        chain,
        snapshot,
        template
      );

      const recoveryMLVector = this.recovery.computeMLRecoveryFeatureVector(
        chain,
        snapshot,
        template
      );

      const notes: string[] = [];
      if (queueDecision.allowed) notes.push('queue:WOULD_CREATE');
      if (!queueDecision.allowed) notes.push('queue:SUPPRESSED');
      if (recoveryReadiness > 0.8) notes.push('recovery:NEAR');

      results.push({
        chainId: chain.chainId,
        templateId: chain.templateId,
        recoveryReadiness,
        recoveryMLVector,
        queueDecision,
        linkEffectBreakdown: linkBreakdown,
        effectTotals,
        notes,
      });
    }

    return results;
  }

  /**
   * Produces an aggregate diagnostic report for the full subsystem.
   */
  getDiagnostics(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[]
  ): CascadeSubsystemDiagnostics {
    const activeChains = snapshot.cascade.activeChains;
    const completedChains = activeChains.filter(
      (c) => c.status === 'COMPLETED' || c.status === 'BROKEN'
    );

    const positiveEvaluation = this._buildPositiveCascadeStates(snapshot);

    const recoveryReadinessByChain: Record<string, number> = {};
    for (const chain of activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) continue;
      recoveryReadinessByChain[chain.chainId] =
        this.recovery.computeRecoveryReadinessScore(chain, snapshot, tpl);
    }

    const templateValidityByChain: Record<string, boolean> = {};
    for (const chain of activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) {
        templateValidityByChain[chain.chainId] = false;
        continue;
      }
      templateValidityByChain[chain.chainId] = this.validator.isTemplateValid(tpl);
    }

    const registrySnapshot = this.registry.getCatalogSnapshot();

    const notes: string[] = [];
    if (activeChains.length === 0) notes.push('cascade:NO_ACTIVE_CHAINS');
    if (activeChains.length > 5) notes.push('cascade:HIGH_CHAIN_COUNT');

    return {
      tick: snapshot.tick,
      activeChainCount: activeChains.length,
      completedChainCount: completedChains.length,
      positiveEvaluation,
      recoveryReadinessByChain,
      templateValidityByChain,
      registrySnapshot,
      notes,
    };
  }

  /**
   * Returns a boolean health summary for the subsystem.
   */
  getHealth(snapshot: RunStateSnapshot): CascadeSubsystemHealth {
    const issues: string[] = [];
    const activeChainCount = snapshot.cascade.activeChains.length;

    const registrySnapshot = this.registry.getCatalogSnapshot();
    const registryPopulated = registrySnapshot.totalCount > 0;
    if (!registryPopulated) issues.push('registry:EMPTY');

    const supportedStates = this.positive.listSupportedEvaluationStates();
    const positiveTrackerReady = supportedStates.length > 0;

    const validatorIssueCodes = this.validator.listSupportedIssueCodes();
    const validatorReady = Object.keys(validatorIssueCodes).length > 0;

    return {
      healthy: issues.length === 0,
      engineInitialized: true,
      registryPopulated,
      queueManagerReady: true,
      recoveryCheckerReady: true,
      positiveTrackerReady,
      validatorReady,
      activeChainCount,
      lastComputedTick: this._lastComputedTick,
      issues,
    };
  }

  /**
   * Validates all templates and returns a summary of invalid ones.
   */
  validateTemplates(
    templates: readonly CascadeTemplate[]
  ): readonly { templateId: CascadeTemplateId; errors: readonly string[] }[] {
    const invalid: { templateId: CascadeTemplateId; errors: readonly string[] }[] = [];
    for (const template of templates) {
      const result = this.validator.validateTemplate(template);
      if (!result.valid) {
        invalid.push({
          templateId: template.templateId,
          errors: result.issues.map((i) => i.message),
        });
      }
    }
    return invalid;
  }

  /**
   * Computes recovery readiness for ALL active chains.
   * Returns a map of chainId → recovery readiness score (0–1).
   */
  computeAllRecoveryReadiness(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[]
  ): Readonly<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const chain of snapshot.cascade.activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) continue;
      result[chain.chainId] = this.recovery.computeRecoveryReadinessScore(
        chain,
        snapshot,
        tpl
      );
    }
    return result;
  }

  /**
   * Returns the registry catalog snapshot for the current registry state.
   */
  getRegistrySnapshot(): CascadeRegistrySnapshot {
    return this.registry.getCatalogSnapshot();
  }

  /**
   * Checks whether a given template would be created given current state.
   */
  wouldCreateChain(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[]
  ): boolean {
    const pendingTriggerCount = pendingChains.filter(
      (c) => c.templateId === template.templateId
    ).length;
    return this.queue.getQueueDecision(
      snapshot,
      template,
      trigger,
      pendingChains,
      pendingTriggerCount
    ).allowed;
  }

  /**
   * Returns the canonical positive cascade evaluation states for this snapshot.
   */
  getPositiveCascadeStates(
    snapshot: RunStateSnapshot
  ): Readonly<Record<string, PositiveCascadeEvaluationState>> {
    return this._buildPositiveCascadeStates(snapshot);
  }

  /**
   * Returns the effect totals for a given template across all active chains.
   * Useful for budget / difficulty projection.
   */
  computeEffectBudget(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[]
  ): Readonly<Record<NumericEffectField, number>> | null {
    return this.queue.computeChainEffectTotals(
      snapshot,
      template,
      trigger,
      pendingChains
    );
  }

  /**
   * Returns quality scores for all provided templates.
   * Useful for manifest-level authoring feedback.
   */
  scoreAllTemplates(
    templates: readonly CascadeTemplate[]
  ): Readonly<Record<CascadeTemplateId, number>> {
    return this._buildTemplateQualityScores(templates);
  }

  /**
   * Returns a summary line for a template's validation state.
   */
  getTemplateSummary(template: CascadeTemplate): string {
    return this.validator.getValidationSummaryLine(template);
  }

  /**
   * Returns the full human-readable validation report for a template.
   */
  getTemplateValidationReport(template: CascadeTemplate): string {
    return this.validator.getValidationReport(template);
  }

  /**
   * Checks whether any positive cascade is currently eligible for activation.
   */
  hasEligiblePositiveCascade(snapshot: RunStateSnapshot): boolean {
    const states = this._buildPositiveCascadeStates(snapshot);
    return Object.values(states).some((s) => s === 'ELIGIBLE');
  }

  /**
   * Returns all chains that have recovery readiness above a given threshold.
   */
  getChainsNearRecovery(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[],
    threshold = 0.7
  ): readonly CascadeChainInstance[] {
    const result: CascadeChainInstance[] = [];
    for (const chain of snapshot.cascade.activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) continue;
      const score = this.recovery.computeRecoveryReadinessScore(chain, snapshot, tpl);
      if (score >= threshold) result.push(chain);
    }
    return result;
  }

  /**
   * Returns the queue policy shape for a given template (for debugging / UI).
   */
  getPolicyShape(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[]
  ): ReturnType<CascadeQueueManager['composePolicyShape']> {
    return this.queue.composePolicyShape(snapshot, template, trigger, pendingChains);
  }

  /**
   * Returns which templates have the highest ML quality scores.
   * Sorted descending by score. Useful for adaptive difficulty selection.
   */
  rankTemplatesByQuality(
    templates: readonly CascadeTemplate[]
  ): readonly { templateId: CascadeTemplateId; score: number }[] {
    return templates
      .map((t) => ({
        templateId: t.templateId,
        score: this.validator.computeTemplateQualityScore(t),
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Returns momentum trend: whether any positive cascade unlock probability
   * has improved between two snapshots.
   */
  hasMomentumImproved(before: RunStateSnapshot, after: RunStateSnapshot): boolean {
    const improved = this.positive.hasUnlockImproved(before, after);
    return Object.values(improved).some(Boolean);
  }

  /**
   * Returns recovery gap summary for all active chains.
   * Useful for constructing player-facing narrative hints.
   */
  getRecoveryGapSummaries(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[]
  ): readonly { chainId: string; templateId: string; summary: string }[] {
    const results: { chainId: string; templateId: string; summary: string }[] = [];
    for (const chain of snapshot.cascade.activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) continue;
      results.push({
        chainId: chain.chainId,
        templateId: chain.templateId,
        summary: this.recovery.getRecoveryGapSummary(tpl, snapshot),
      });
    }
    return results;
  }

  /**
   * Returns detailed recovery audit for all active chains.
   * Each entry includes condition kind, comparator, pass/fail, and gap.
   */
  getFullRecoveryAudits(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[]
  ): readonly {
    chainId: string;
    templateId: string;
    audit: ReturnType<RecoveryConditionChecker['getFullRecoveryAudit']>;
  }[] {
    const results: {
      chainId: string;
      templateId: string;
      audit: ReturnType<RecoveryConditionChecker['getFullRecoveryAudit']>;
    }[] = [];
    for (const chain of snapshot.cascade.activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) continue;
      results.push({
        chainId: chain.chainId,
        templateId: chain.templateId,
        audit: this.recovery.getFullRecoveryAudit(tpl, snapshot),
      });
    }
    return results;
  }

  /**
   * Returns the batch inference reports from the PositiveCascadeTracker.
   */
  getPositiveBatchInference(
    snapshots: readonly RunStateSnapshot[]
  ): ReturnType<PositiveCascadeTracker['getBatchInferenceReports']> {
    return this.positive.getBatchInferenceReports(snapshots);
  }

  /**
   * Returns recovery progression stats for all active chains.
   */
  getRecoveryProgressionStats(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[]
  ): readonly {
    chainId: string;
    templateId: string;
    stats: ReturnType<RecoveryConditionChecker['getRecoveryProgressionStats']>;
  }[] {
    const results: {
      chainId: string;
      templateId: string;
      stats: ReturnType<RecoveryConditionChecker['getRecoveryProgressionStats']>;
    }[] = [];
    for (const chain of snapshot.cascade.activeChains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) continue;
      results.push({
        chainId: chain.chainId,
        templateId: chain.templateId,
        stats: this.recovery.getRecoveryProgressionStats(tpl, snapshot),
      });
    }
    return results;
  }

  /**
   * Returns the ML registry signal for a given template (affinity, ML signals,
   * pressure matrix).
   */
  getTemplateMLSignal(templateId: CascadeTemplateId): CascadeTemplateMLSignal {
    return this.registry.computeMLSignal(templateId);
  }

  /**
   * Returns the top-N templates ranked by recovery proximity for the current
   * snapshot. Useful for adaptive difficulty ranking.
   */
  getTopRecoveryProximityTemplates(
    snapshot: RunStateSnapshot,
    templates: readonly CascadeTemplate[],
    topN = 3
  ): readonly { templateId: CascadeTemplateId; proximity: number }[] {
    return templates
      .map((tpl) => {
        const proximities = this.recovery.computeConditionProximities(tpl, snapshot);
        const avgProximity =
          proximities.length === 0
            ? 0
            : proximities.reduce((sum, p) => sum + p.proximity, 0) / proximities.length;
        return { templateId: tpl.templateId, proximity: avgProximity };
      })
      .sort((a, b) => b.proximity - a.proximity)
      .slice(0, topN);
  }

  /**
   * Returns the scored manifest quality for a set of templates.
   * Internally builds a CascadeTemplateManifest from the array.
   */
  getManifestQualityScore(templates: readonly CascadeTemplate[]): number {
    const manifest = buildCascadeTemplateManifest(templates);
    return this.validator.computeManifestQualityScore(manifest);
  }

  /**
   * Clears the ML bundle cache (call after a tick advances).
   */
  invalidateMLCache(): void {
    this._lastComputedTick = null;
    this._lastMLBundle = null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _buildSyntheticTrigger(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate
  ): string {
    return `subsystem:${template.templateId}:tick_${snapshot.tick}`;
  }

  private _buildPositiveCascadeStates(
    snapshot: RunStateSnapshot
  ): Readonly<Record<string, PositiveCascadeEvaluationState>> {
    const result: Record<string, PositiveCascadeEvaluationState> = {};
    // Reference POSITIVE_CASCADE_EVALUATION_STATES for exhaustiveness awareness
    void POSITIVE_CASCADE_EVALUATION_STATES;
    for (const id of CASCADE_TEMPLATE_IDS) {
      const polarity = CASCADE_TEMPLATE_POLARITY_BY_ID[id];
      if (polarity !== 'POSITIVE') continue;
      result[id] = this.positive.getEvaluationState(snapshot, id);
    }
    return result;
  }

  private _buildTemplateQualityScores(
    templates: readonly CascadeTemplate[]
  ): Readonly<Record<CascadeTemplateId, number>> {
    const result = {} as Record<CascadeTemplateId, number>;
    for (const template of templates) {
      result[template.templateId] = this.validator.computeTemplateQualityScore(template);
    }
    return result;
  }

  private _buildChainCountBySeverity(
    chains: readonly CascadeChainInstance[],
    templates: readonly CascadeTemplate[]
  ): Readonly<Record<CascadeSeverity, number>> {
    const counts = {} as Record<CascadeSeverity, number>;
    for (const sev of CASCADE_SEVERITIES) {
      counts[sev] = 0;
    }
    for (const chain of chains) {
      const tpl = templates.find((t) => t.templateId === chain.templateId);
      if (tpl === undefined) continue;
      const sev = tpl.severity;
      counts[sev] = (counts[sev] ?? 0) + 1;
    }
    return counts;
  }

  private _mergeChains(
    a: readonly CascadeChainInstance[],
    b: readonly CascadeChainInstance[]
  ): readonly CascadeChainInstance[] {
    const seen = new Set(a.map((c) => c.chainId));
    return [...a, ...b.filter((c) => !seen.has(c.chainId))];
  }
}

// ─── 11. FACTORY FUNCTION ─────────────────────────────────────────────────────

/**
 * Creates a fresh, fully-wired CascadeSubsystem.
 * This is the recommended entry point for the orchestrator and engine/index.ts.
 *
 * @example
 * ```ts
 * import { Cascade } from '../../engine';
 * const cascade = Cascade.createCascadeSubsystem();
 * const bundle = cascade.extractMLBundle(snapshot, templates);
 * ```
 */
export function createCascadeSubsystem(): CascadeSubsystem {
  return new CascadeSubsystem();
}

// ─── 12. STATIC ML UTILITIES ─────────────────────────────────────────────────

/**
 * Merges multiple ML bundles (e.g. from different tick windows) into a single
 * aggregate bundle by averaging numeric fields.
 */
export function mergeCascadeMLBundles(
  bundles: readonly CascadeMLBundle[]
): CascadeMLBundle | null {
  if (bundles.length === 0) return null;
  const base = bundles[0]!;
  void base; // referenced for stability

  const avg = (vectors: readonly (readonly number[])[]): readonly number[] => {
    if (vectors.length === 0) return [];
    const len = vectors[0]!.length;
    return Array.from({ length: len }, (_, i) =>
      vectors.reduce((sum, v) => sum + (v[i] ?? 0), 0) / vectors.length
    );
  };

  const avgScalar = avg(bundles.map((b) => b.queueScalarVector));
  const avgAccel = avg(bundles.map((b) => b.queueAccelerationVector));
  const avgMomentum = avg(bundles.map((b) => b.momentumVector));
  const avgComeback = avg(bundles.map((b) => b.comebackVector));

  // Average recovery readiness by chain
  const allChainIds = new Set(
    bundles.flatMap((b) => Object.keys(b.recoveryReadinessScores))
  );
  const mergedReadiness: Record<string, number> = {};
  for (const id of allChainIds) {
    const vals = bundles
      .map((b) => b.recoveryReadinessScores[id])
      .filter((v): v is number => v !== undefined);
    mergedReadiness[id] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  // Average recovery ML vectors by chain
  const mergedRecoveryVectors: Record<string, readonly number[]> = {};
  for (const id of allChainIds) {
    const vecs = bundles
      .map((b) => b.recoveryMLVectors[id])
      .filter((v): v is readonly number[] => v !== undefined);
    mergedRecoveryVectors[id] = avg(vecs);
  }

  // Average normalized positive metrics
  const allMetricKeys = new Set(
    bundles.flatMap((b) => Object.keys(b.normalizedPositiveMetrics))
  );
  const mergedMetrics: Record<string, number> = {};
  for (const key of allMetricKeys) {
    const vals = bundles
      .map((b) => b.normalizedPositiveMetrics[key])
      .filter((v): v is number => v !== undefined);
    mergedMetrics[key] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  const lastBundle = bundles[bundles.length - 1]!;

  // Average template quality scores
  const allTemplateIds = new Set(
    bundles.flatMap((b) => Object.keys(b.templateQualityScores))
  ) as Set<CascadeTemplateId>;
  const mergedTemplateScores = {} as Record<CascadeTemplateId, number>;
  for (const id of allTemplateIds) {
    const vals = bundles
      .map((b) => b.templateQualityScores[id])
      .filter((v): v is number => v !== undefined);
    mergedTemplateScores[id] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  // Average chain counts by severity
  const mergedChainCounts = {} as Record<CascadeSeverity, number>;
  for (const sev of CASCADE_SEVERITIES) {
    const vals = bundles.map((b) => b.chainCountBySeverity[sev] ?? 0);
    mergedChainCounts[sev] = Math.round(
      vals.reduce((s, v) => s + v, 0) / vals.length
    );
  }

  return {
    queueScalarVector: avgScalar,
    queueAccelerationVector: avgAccel,
    recoveryReadinessScores: mergedReadiness,
    recoveryMLVectors: mergedRecoveryVectors,
    momentumVector: avgMomentum,
    comebackVector: avgComeback,
    normalizedPositiveMetrics: mergedMetrics,
    positiveCascadeStates: lastBundle.positiveCascadeStates,
    unlockProbabilities: lastBundle.unlockProbabilities,
    templateQualityScores: mergedTemplateScores,
    chainCountBySeverity: mergedChainCounts,
    activeChainCount: Math.round(
      bundles.reduce((s, b) => s + b.activeChainCount, 0) / bundles.length
    ),
    computedAtTick: lastBundle.computedAtTick,
  };
}

/**
 * Extracts only the numeric effect fields used by the ML pipeline.
 * Useful for building model input directly from an EffectPayload.
 */
export function effectPayloadToMLVector(
  effect: Partial<EffectPayload>
): readonly number[] {
  return NUMERIC_EFFECT_FIELDS.map((field) => {
    const val = (effect as Record<string, unknown>)[field];
    return typeof val === 'number' ? val : 0;
  });
}

/**
 * Returns a normalized (0–1) version of an effect payload ML vector.
 * Normalization uses a domain-specific absolute scale constant.
 */
export function normalizeEffectMLVector(
  vector: readonly number[]
): readonly number[] {
  const MAX_FIELD_SCALE = 1000;
  return vector.map((v) => Math.min(1, Math.abs(v) / MAX_FIELD_SCALE));
}

/**
 * Returns a boolean mask for which effect fields are non-zero in a vector.
 * Useful for sparse DL input encoding.
 */
export function effectMLVectorSparseMask(
  vector: readonly number[]
): readonly boolean[] {
  return vector.map((v) => v !== 0);
}

/**
 * Computes cosine similarity between two ML vectors.
 * Used for template similarity / clustering in DL pipelines.
 */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[]
): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) ** 2;
    magB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Computes the L2 distance between two ML vectors.
 * Used for k-NN recovery pattern matching in DL pipelines.
 */
export function l2Distance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - (b[i] ?? 0)) ** 2, 0));
}

/**
 * Returns the dominant cascade severity for a given set of chains.
 * Used for adaptive difficulty budgeting.
 */
export function dominantSeverity(
  chains: readonly CascadeChainInstance[],
  templates: readonly CascadeTemplate[]
): CascadeSeverity | null {
  if (chains.length === 0) return null;

  const severityCounts: Record<CascadeSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  for (const chain of chains) {
    const tpl = templates.find((t) => t.templateId === chain.templateId);
    if (tpl === undefined) continue;
    severityCounts[tpl.severity]++;
  }

  let topSev: CascadeSeverity | null = null;
  let topCount = 0;
  for (const sev of CASCADE_SEVERITIES) {
    if (severityCounts[sev] > topCount) {
      topCount = severityCounts[sev];
      topSev = sev;
    }
  }
  return topSev;
}

/**
 * Returns a stable string key for the current cascade state.
 * Useful for memoization / caching cascade computations.
 */
export function buildCascadeStateKey(snapshot: RunStateSnapshot): string {
  const activeIds = snapshot.cascade.activeChains
    .map((c) => c.chainId)
    .sort()
    .join(',');
  return `tick:${snapshot.tick}|mode:${snapshot.mode}|chains:${activeIds}`;
}

/**
 * Type guard: checks whether a value is a valid CascadeMLBundle.
 */
export function isCascadeMLBundle(value: unknown): value is CascadeMLBundle {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['queueScalarVector']) &&
    Array.isArray(v['momentumVector']) &&
    typeof v['activeChainCount'] === 'number' &&
    typeof v['computedAtTick'] === 'number'
  );
}

/**
 * Type guard: checks whether a value is a valid CascadeDLInputTensor.
 */
export function isCascadeDLInputTensor(
  value: unknown
): value is CascadeDLInputTensor {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['data']) &&
    Array.isArray(v['dims']) &&
    Array.isArray(v['labels']) &&
    typeof v['computedAtTick'] === 'number'
  );
}

// ─── 13. SUBSYSTEM VERSION & MANIFEST ────────────────────────────────────────

/** Cascade subsystem version identifier. */
export const CASCADE_SUBSYSTEM_VERSION = '1.0.0' as const;

/** Human-readable manifest of the cascade subsystem components. */
export const CASCADE_SUBSYSTEM_MANIFEST = Object.freeze({
  version: CASCADE_SUBSYSTEM_VERSION,
  components: Object.freeze([
    'CascadeEngine',
    'CascadeChainRegistry',
    'CascadeQueueManager',
    'RecoveryConditionChecker',
    'PositiveCascadeTracker',
    'CascadeTemplateValidator',
  ] as const),
  mlSurfaces: Object.freeze([
    'extractMLBundle',
    'extractDLInputTensor',
    'runInferenceCycle',
    'batchInferenceCycle',
  ] as const),
  dlUtilities: Object.freeze([
    'effectPayloadToMLVector',
    'normalizeEffectMLVector',
    'effectMLVectorSparseMask',
    'cosineSimilarity',
    'l2Distance',
    'mergeCascadeMLBundles',
  ] as const),
} as const);

/** Cascade numeric effect field names (re-exported for DL pipelines). */
export const CASCADE_ML_EFFECT_FIELDS = NUMERIC_EFFECT_FIELDS;

/** Cascade polarity lookup (re-exported for DL routing). */
export const CASCADE_ML_POLARITY_MAP = CASCADE_TEMPLATE_POLARITY_BY_ID;

/** All positive cascade evaluation states (re-exported for DL routing). */
export const CASCADE_ML_EVALUATION_STATES = POSITIVE_CASCADE_EVALUATION_STATES;
