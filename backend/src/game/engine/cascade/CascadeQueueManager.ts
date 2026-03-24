/*
 * POINT ZERO ONE — BACKEND CASCADE QUEUE MANAGER
 * /backend/src/game/engine/cascade/CascadeQueueManager.ts
 *
 * Doctrine:
 * - chain scheduling must be deterministic
 * - link timing must remain mode-aware, pressure-aware, and replay-safe
 * - repeated triggers may intensify results, but never randomly
 * - queue policy must align with backend authority, not frontend guesses
 * - positive cascades are stabilized; negative cascades are allowed to bite
 * - every returned chain instance must remain serializable and hash-stable
 */

import { createDeterministicId } from '../core/Deterministic';
import type {
  CascadeChainInstance,
  CascadeLink,
  EffectPayload,
  ModeCode,
  PressureTier,
  RunPhase,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  NUMERIC_EFFECT_FIELDS,
} from './types';
import type {
  CascadeSeverity,
  CascadeTemplate,
  CascadeTemplateId,
  CreationDiagnostics as RichCreationDiagnostics,
  CreationScalarBundle,
  MutableEffectPayload,
  NumericEffectField,
  QueueDecision,
  QueueDecisionResult,
  QueueLinkEffectBreakdown,
  QueuePolicyContextShape,
  RecoveryCondition,
  ScheduledLinkPlan,
  TimingAccelerationBundle,
} from './types';

// -----------------------------------------------------------------------------
// Internal Types
// -----------------------------------------------------------------------------

interface QueuePolicyContext {
  readonly snapshot: RunStateSnapshot;
  readonly template: CascadeTemplate;
  readonly trigger: string;
  readonly normalizedTrigger: string;
  readonly triggerFamily: string;
  readonly triggerFacet: string | null;
  readonly instanceOrdinal: number;
  readonly activeOfTemplate: number;
  readonly pendingOfTemplate: number;
  readonly triggerCount: number;
  readonly totalVisibleThreats: number;
  readonly weakestLayerId: ShieldLayerId;
  readonly weakestLayerRatio: number;
  readonly allShieldRatioAverage: number;
  readonly pendingChains: readonly CascadeChainInstance[];
}

interface OffsetPlanningContext {
  readonly policy: QueuePolicyContext;
  readonly scalars: CreationScalarBundle;
  readonly acceleration: TimingAccelerationBundle;
}

/**
 * Internal-only policy gate result. The richer `RichCreationDiagnostics`
 * (exported from types.ts as `CreationDiagnostics`) is exposed via the
 * public `diagnose()` surface.
 */
interface InternalPolicyCheck {
  readonly reasons: readonly string[];
  readonly wouldCreate: boolean;
}

interface TriggerParsingResult {
  readonly normalized: string;
  readonly family: string;
  readonly facet: string | null;
}

// -----------------------------------------------------------------------------
// Deterministic Policy Tables
// -----------------------------------------------------------------------------

const MODE_CREATION_SCALAR: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo: 1.0,
  pvp: 1.08,
  coop: 0.96,
  ghost: 1.1,
});

const MODE_POSITIVE_SCALAR: Readonly<Record<ModeCode, number>> = Object.freeze({
  solo: 1.0,
  pvp: 0.95,
  coop: 1.08,
  ghost: 0.97,
});

const PHASE_CREATION_SCALAR: Readonly<Record<RunPhase, number>> = Object.freeze({
  FOUNDATION: 0.95,
  ESCALATION: 1.0,
  SOVEREIGNTY: 1.08,
});

const PHASE_ACCELERATION: Readonly<Record<RunPhase, number>> = Object.freeze({
  FOUNDATION: 0,
  ESCALATION: 0,
  SOVEREIGNTY: 1,
});

const SEVERITY_SCALAR: Readonly<Record<CascadeSeverity, number>> = Object.freeze({
  LOW: 0.94,
  MEDIUM: 1.0,
  HIGH: 1.1,
  CRITICAL: 1.22,
});

const SEVERITY_MIN_SPACING: Readonly<Record<CascadeSeverity, number>> = Object.freeze({
  LOW: 1,
  MEDIUM: 1,
  HIGH: 1,
  CRITICAL: 1,
});

const SEVERITY_MAX_SCALAR: Readonly<Record<CascadeSeverity, number>> = Object.freeze({
  LOW: 1.35,
  MEDIUM: 1.55,
  HIGH: 1.85,
  CRITICAL: 2.1,
});

const PRESSURE_ACCELERATION: Readonly<Record<PressureTier, number>> = Object.freeze({
  T0: 0,
  T1: 0,
  T2: 0,
  T3: 1,
  T4: 1,
});

const PRESSURE_SCALAR_FALLBACK: Readonly<Record<PressureTier, number>> = Object.freeze({
  T0: 0.92,
  T1: 1.0,
  T2: 1.08,
  T3: 1.18,
  T4: 1.3,
});

const HEAT_SCALAR_BREAKPOINTS = Object.freeze([
  { maxInclusive: 9, scalar: 0.96 },
  { maxInclusive: 19, scalar: 1.0 },
  { maxInclusive: 34, scalar: 1.05 },
  { maxInclusive: 54, scalar: 1.12 },
  { maxInclusive: 74, scalar: 1.2 },
  { maxInclusive: 100, scalar: 1.28 },
]);

const HEAT_ACCELERATION_BREAKPOINTS = Object.freeze([
  { minInclusive: 0, acceleration: 0 },
  { minInclusive: 35, acceleration: 0 },
  { minInclusive: 55, acceleration: 1 },
  { minInclusive: 75, acceleration: 1 },
  { minInclusive: 90, acceleration: 2 },
]);

const TENSION_SCALAR_BREAKPOINTS = Object.freeze([
  { maxInclusive: 0.15, scalar: 0.97 },
  { maxInclusive: 0.30, scalar: 1.0 },
  { maxInclusive: 0.50, scalar: 1.04 },
  { maxInclusive: 0.70, scalar: 1.1 },
  { maxInclusive: 0.85, scalar: 1.18 },
  { maxInclusive: 1.5, scalar: 1.28 },
]);

const SHIELD_DISTRESS_BREAKPOINTS = Object.freeze([
  { maxInclusive: 0.15, scalar: 1.3 },
  { maxInclusive: 0.25, scalar: 1.22 },
  { maxInclusive: 0.40, scalar: 1.14 },
  { maxInclusive: 0.55, scalar: 1.07 },
  { maxInclusive: 0.70, scalar: 1.0 },
  { maxInclusive: 1.0, scalar: 0.95 },
]);

const ECONOMY_NET_WORTH_BREAKPOINTS = Object.freeze([
  { maxInclusive: -10000, scalar: 1.25 },
  { maxInclusive: -5000, scalar: 1.18 },
  { maxInclusive: -1, scalar: 1.1 },
  { maxInclusive: 4999, scalar: 1.03 },
  { maxInclusive: 14999, scalar: 0.99 },
  { maxInclusive: Number.POSITIVE_INFINITY, scalar: 0.96 },
]);

const ECONOMY_CASH_BREAKPOINTS = Object.freeze([
  { maxInclusive: -1, scalar: 1.18 },
  { maxInclusive: 249, scalar: 1.14 },
  { maxInclusive: 999, scalar: 1.08 },
  { maxInclusive: 2499, scalar: 1.02 },
  { maxInclusive: 7499, scalar: 0.98 },
  { maxInclusive: Number.POSITIVE_INFINITY, scalar: 0.95 },
]);

const TELEMETRY_EVENT_SCALAR_BREAKPOINTS = Object.freeze([
  { maxInclusive: 5, scalar: 0.98 },
  { maxInclusive: 12, scalar: 1.0 },
  { maxInclusive: 25, scalar: 1.04 },
  { maxInclusive: 40, scalar: 1.08 },
  { maxInclusive: Number.POSITIVE_INFINITY, scalar: 1.12 },
]);

const TELEMETRY_EVENT_ACCELERATION_BREAKPOINTS = Object.freeze([
  { minInclusive: 0, acceleration: 0 },
  { minInclusive: 12, acceleration: 0 },
  { minInclusive: 24, acceleration: 1 },
  { minInclusive: 40, acceleration: 1 },
  { minInclusive: 60, acceleration: 2 },
]);

const WARNING_SCALAR_BREAKPOINTS = Object.freeze([
  { maxInclusive: 0, scalar: 1.0 },
  { maxInclusive: 1, scalar: 1.03 },
  { maxInclusive: 2, scalar: 1.06 },
  { maxInclusive: 4, scalar: 1.1 },
  { maxInclusive: Number.POSITIVE_INFINITY, scalar: 1.14 },
]);

const TRIGGER_FAMILY_SCALARS: Readonly<Record<string, number>> = Object.freeze({
  'shield': 1.06,
  'pressure': 1.04,
  'economy': 1.08,
  'cards': 1.0,
  'mode': 1.02,
  'positive': 0.98,
});

const POSITIVE_TRIGGER_FAMILY_SCALARS: Readonly<Record<string, number>> = Object.freeze({
  'shield': 0.98,
  'pressure': 1.02,
  'economy': 1.04,
  'cards': 1.02,
  'mode': 1.01,
  'positive': 1.0,
});

const TRIGGER_FACET_SCALARS: Readonly<Record<string, number>> = Object.freeze({
  'L1': 1.05,
  'L2': 1.08,
  'L3': 1.11,
  'L4': 1.16,
  'privileged': 1.08,
  'rescue': 0.94,
  'trust': 0.97,
  'momentum': 0.96,
  'recovery': 0.95,
});

const POSITIVE_NEGATIVE_REPEAT_FALLOFF = Object.freeze({
  positiveRepeatSlope: 0.08,
  negativeRepeatSlope: 0.12,
  positiveMax: 1.32,
  negativeMax: 1.6,
});

const DENSITY_SCALAR_BREAKPOINTS = Object.freeze([
  { maxInclusive: 0, scalar: 1.0 },
  { maxInclusive: 1, scalar: 1.02 },
  { maxInclusive: 2, scalar: 1.05 },
  { maxInclusive: 3, scalar: 1.08 },
  { maxInclusive: Number.POSITIVE_INFINITY, scalar: 1.12 },
]);

const POSITIVE_BRAKE_BREAKPOINTS = Object.freeze([
  { minInclusive: 0, brake: 0 },
  { minInclusive: 2, brake: 1 },
  { minInclusive: 4, brake: 1 },
  { minInclusive: 6, brake: 2 },
]);

const POSITIVE_SCALAR_CEILING = 1.45;
const NEGATIVE_SCALAR_FLOOR = 0.82;
const NEGATIVE_SCALAR_CEILING = 2.1;
const EFFECT_MIN_MAGNITUDE_WHEN_NONZERO = 1;
const HARD_MAX_ACCELERATION = 4;
const HARD_MIN_OFFSET = 0;
const HARD_MAX_LINKS_PER_CHAIN = 16;
const HARD_MAX_TEMPLATE_CONCURRENCY_GUARD = 32;
const HARD_MAX_TRIGGERS_PER_RUN_GUARD = 128;

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.trunc(clampNumber(value, min, max));
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return Object.freeze(Array.from(new Set(values.filter((value) => value.trim().length > 0))));
}

function pickScalarFromMaxInclusiveTable(
  value: number,
  table: ReadonlyArray<{ readonly maxInclusive: number; readonly scalar: number }>,
): number {
  for (const entry of table) {
    if (value <= entry.maxInclusive) {
      return entry.scalar;
    }
  }
  return table[table.length - 1]?.scalar ?? 1;
}

function pickAccelerationFromMinInclusiveTable(
  value: number,
  table: ReadonlyArray<{ readonly minInclusive: number; readonly acceleration: number }>,
): number {
  let selected = table[0]?.acceleration ?? 0;

  for (const entry of table) {
    if (value >= entry.minInclusive) {
      selected = entry.acceleration;
      continue;
    }

    break;
  }

  return selected;
}

function pickBrakeFromMinInclusiveTable(
  value: number,
  table: ReadonlyArray<{ readonly minInclusive: number; readonly brake: number }>,
): number {
  let selected = table[0]?.brake ?? 0;

  for (const entry of table) {
    if (value >= entry.minInclusive) {
      selected = entry.brake;
      continue;
    }

    break;
  }

  return selected;
}

// -----------------------------------------------------------------------------
// CascadeQueueManager
// -----------------------------------------------------------------------------

export class CascadeQueueManager {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public canCreate(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
    pendingTriggerCount = 0,
  ): boolean {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);
    const diagnostics = this.evaluateCreationPolicy(policy, pendingTriggerCount);
    return diagnostics.wouldCreate;
  }

  public create(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): CascadeChainInstance {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);
    const diagnostics = this.evaluateCreationPolicy(policy, 0);

    if (!diagnostics.wouldCreate) {
      throw new Error(
        [
          `[CascadeQueueManager] Attempted to create a chain that violates queue policy.`,
          `template=${template.templateId}`,
          `trigger=${trigger}`,
          `reasons=${diagnostics.reasons.join('|') || 'unknown'}`,
        ].join(' '),
      );
    }

    const scalars = this.resolveCreationScalars(policy);
    const acceleration = this.resolveTimingAcceleration(policy, scalars);
    const offsetContext: OffsetPlanningContext = {
      policy,
      scalars,
      acceleration,
    };

    const links = this.planLinks(offsetContext);
    const recoveryTags = this.resolveRecoveryTags(template);
    const chainId = this.composeChainId(policy);

    return {
      chainId,
      templateId: template.templateId,
      trigger: policy.normalizedTrigger,
      positive: template.positive,
      status: 'ACTIVE',
      createdAtTick: snapshot.tick,
      recoveryTags: [...recoveryTags],
      links: [...links],
    };
  }

  // ---------------------------------------------------------------------------
  // Policy Context
  // ---------------------------------------------------------------------------

  private buildPolicyContext(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[],
  ): QueuePolicyContext {
    const parsedTrigger = this.parseTrigger(trigger);
    const activeOfTemplate = this.countActiveChainsOfTemplate(snapshot, template.templateId);
    const pendingOfTemplate = this.countPendingChainsOfTemplate(pendingChains, template.templateId);
    const instanceOrdinal = this.resolveInstanceOrdinal(snapshot, template.templateId, pendingChains);

    return {
      snapshot,
      template,
      trigger,
      normalizedTrigger: parsedTrigger.normalized,
      triggerFamily: parsedTrigger.family,
      triggerFacet: parsedTrigger.facet,
      instanceOrdinal,
      activeOfTemplate,
      pendingOfTemplate,
      triggerCount: snapshot.cascade.repeatedTriggerCounts[parsedTrigger.normalized] ?? 0,
      totalVisibleThreats: snapshot.tension.visibleThreats.length,
      weakestLayerId: snapshot.shield.weakestLayerId,
      weakestLayerRatio: snapshot.shield.weakestLayerRatio,
      allShieldRatioAverage: this.computeAverageShieldRatio(snapshot),
      pendingChains,
    };
  }

  private parseTrigger(trigger: string): TriggerParsingResult {
    const normalized = trigger.trim().replace(/\s+/g, '_');
    const [familyRaw, facetRaw] = normalized.split(':', 2);

    return {
      normalized,
      family: familyRaw || 'unknown',
      facet: facetRaw ?? null,
    };
  }

  private countActiveChainsOfTemplate(
    snapshot: RunStateSnapshot,
    templateId: CascadeTemplateId,
  ): number {
    return snapshot.cascade.activeChains.filter(
      (chain) => chain.templateId === templateId && chain.status === 'ACTIVE',
    ).length;
  }

  private countPendingChainsOfTemplate(
    pendingChains: readonly CascadeChainInstance[],
    templateId: CascadeTemplateId,
  ): number {
    return pendingChains.filter(
      (chain) => chain.templateId === templateId && chain.status === 'ACTIVE',
    ).length;
  }

  private resolveInstanceOrdinal(
    snapshot: RunStateSnapshot,
    templateId: CascadeTemplateId,
    pendingChains: readonly CascadeChainInstance[],
  ): number {
    return (
      snapshot.cascade.activeChains.filter((chain) => chain.templateId === templateId).length +
      pendingChains.filter((chain) => chain.templateId === templateId).length
    );
  }

  private computeAverageShieldRatio(snapshot: RunStateSnapshot): number {
    if (snapshot.shield.layers.length === 0) {
      return 0;
    }

    const total = snapshot.shield.layers.reduce((sum, layer) => sum + layer.integrityRatio, 0);
    return total / snapshot.shield.layers.length;
  }

  // ---------------------------------------------------------------------------
  // Creation Policy Evaluation
  // ---------------------------------------------------------------------------

  private evaluateCreationPolicy(
    policy: QueuePolicyContext,
    pendingTriggerCount: number,
  ): InternalPolicyCheck {
    const reasons: string[] = [];

    this.checkTemplateShapeGuards(policy, reasons);
    this.checkConcurrencyGuards(policy, reasons);
    this.checkTriggerBudgetGuards(policy, pendingTriggerCount, reasons);
    this.checkSameTickDedupeGuards(policy, reasons);
    this.checkPositiveSuppressionGuards(policy, reasons);
    this.checkNegativeEscalationGuards(policy, reasons);
    this.checkPhaseGuards(policy, reasons);
    this.checkRecoverySurfaceGuards(policy, reasons);

    return {
      reasons: Object.freeze(reasons),
      wouldCreate: reasons.length === 0,
    };
  }

  private checkTemplateShapeGuards(policy: QueuePolicyContext, reasons: string[]): void {
    if (policy.template.maxConcurrent < 0 || policy.template.maxConcurrent > HARD_MAX_TEMPLATE_CONCURRENCY_GUARD) {
      reasons.push('maxConcurrent_out_of_bounds');
    }

    if (policy.template.maxTriggersPerRun < 0 || policy.template.maxTriggersPerRun > HARD_MAX_TRIGGERS_PER_RUN_GUARD) {
      reasons.push('maxTriggersPerRun_out_of_bounds');
    }

    if (policy.template.baseOffsets.length === 0) {
      reasons.push('template_has_no_offsets');
    }

    if (policy.template.baseOffsets.length > HARD_MAX_LINKS_PER_CHAIN) {
      reasons.push('template_has_too_many_links');
    }

    if (policy.template.baseOffsets.length !== policy.template.effects.length) {
      reasons.push('template_offset_effect_length_mismatch');
    }

    if (!policy.normalizedTrigger) {
      reasons.push('empty_trigger');
    }
  }

  private checkConcurrencyGuards(policy: QueuePolicyContext, reasons: string[]): void {
    const totalActiveIncludingPending = policy.activeOfTemplate + policy.pendingOfTemplate;

    if (totalActiveIncludingPending >= policy.template.maxConcurrent) {
      reasons.push('template_concurrency_exceeded');
    }

    if (
      !policy.template.positive &&
      policy.snapshot.cascade.activeChains.some(
        (chain) =>
          chain.status === 'ACTIVE' &&
          chain.templateId === policy.template.templateId &&
          chain.trigger === policy.normalizedTrigger,
      )
    ) {
      reasons.push('same_trigger_template_already_active');
    }
  }

  private checkTriggerBudgetGuards(
    policy: QueuePolicyContext,
    pendingTriggerCount: number,
    reasons: string[],
  ): void {
    const triggerCount = policy.triggerCount + pendingTriggerCount;

    if (triggerCount >= policy.template.maxTriggersPerRun) {
      reasons.push('trigger_budget_exhausted');
    }

    if (!policy.template.positive && triggerCount > 0 && policy.triggerFamily === 'pressure' && policy.snapshot.pressure.tier === 'T0') {
      reasons.push('calm_pressure_trigger_rejected');
    }
  }

  private checkSameTickDedupeGuards(policy: QueuePolicyContext, reasons: string[]): void {
    const dedupeSignature = this.composeDedupeSignature(policy);
    const duplicateInPending = policy.pendingChains.some((chain) => this.composeDedupeSignatureFromChain(chain, policy.snapshot) === dedupeSignature);

    if (duplicateInPending) {
      reasons.push('pending_duplicate_signature');
    }

    const duplicateThisTick = policy.snapshot.cascade.activeChains.some((chain) => {
      if (chain.templateId !== policy.template.templateId) {
        return false;
      }

      if (chain.status !== 'ACTIVE') {
        return false;
      }

      return chain.trigger === policy.normalizedTrigger && chain.createdAtTick === policy.snapshot.tick;
    });

    if (duplicateThisTick) {
      reasons.push('same_tick_duplicate');
    }
  }

  private checkPositiveSuppressionGuards(policy: QueuePolicyContext, reasons: string[]): void {
    if (!policy.template.positive) {
      return;
    }

    if (
      policy.snapshot.cascade.positiveTrackers.includes(policy.template.templateId) &&
      policy.triggerFamily === 'positive'
    ) {
      reasons.push('positive_tracker_already_recorded');
    }

    if (policy.snapshot.pressure.tier === 'T4' && policy.snapshot.shield.weakestLayerRatio < 0.1) {
      reasons.push('positive_suppressed_due_to_catastrophic_state');
    }
  }

  private checkNegativeEscalationGuards(policy: QueuePolicyContext, reasons: string[]): void {
    if (policy.template.positive) {
      return;
    }

    if (
      policy.template.templateId === 'NETWORK_LOCKDOWN' &&
      policy.snapshot.shield.weakestLayerId !== 'L4' &&
      policy.triggerFacet !== 'L4'
    ) {
      reasons.push('network_lockdown_requires_l4_bias');
    }

    if (
      policy.template.templateId === 'INCOME_SHOCK' &&
      policy.snapshot.economy.incomePerTick > policy.snapshot.economy.expensesPerTick * 2 &&
      policy.snapshot.economy.cash > 5000 &&
      policy.triggerFamily !== 'pressure'
    ) {
      reasons.push('income_shock_rejected_for_excess_resilience');
    }
  }

  private checkPhaseGuards(policy: QueuePolicyContext, reasons: string[]): void {
    if (
      policy.snapshot.phase === 'FOUNDATION' &&
      policy.template.severity === 'CRITICAL' &&
      !policy.template.positive &&
      policy.snapshot.tick < 2 &&
      policy.triggerFacet !== 'L4'
    ) {
      reasons.push('early_foundation_critical_guard');
    }

    if (
      policy.snapshot.phase === 'SOVEREIGNTY' &&
      policy.template.positive &&
      policy.snapshot.outcome !== null
    ) {
      reasons.push('positive_rejected_after_outcome');
    }
  }

  private checkRecoverySurfaceGuards(policy: QueuePolicyContext, reasons: string[]): void {
    const hasCardTagRecovery = policy.template.recovery.some((entry) => entry.kind === 'CARD_TAG_ANY' || entry.kind === 'LAST_PLAYED_TAG_ANY');

    if (!policy.template.positive && policy.template.recovery.length > 0 && !hasCardTagRecovery && policy.template.recoveryTags.length === 0) {
      reasons.push('recovery_surface_too_thin');
    }
  }

  private composeDedupeSignature(policy: QueuePolicyContext): string {
    return [
      policy.template.dedupeKey,
      policy.template.templateId,
      policy.normalizedTrigger,
      policy.snapshot.mode,
      policy.snapshot.phase,
      policy.snapshot.tick,
    ].join('|');
  }

  private composeDedupeSignatureFromChain(
    chain: CascadeChainInstance,
    snapshot: RunStateSnapshot,
  ): string {
    return [
      chain.templateId,
      chain.templateId,
      chain.trigger,
      snapshot.mode,
      snapshot.phase,
      snapshot.tick,
    ].join('|');
  }

  // ---------------------------------------------------------------------------
  // Scalar Resolution
  // ---------------------------------------------------------------------------

  private resolveCreationScalars(policy: QueuePolicyContext): CreationScalarBundle {
    const pressureScalar = this.resolvePressureScalar(policy);
    const repeatScalar = this.resolveRepeatScalar(policy);
    const severityScalar = this.resolveSeverityScalar(policy);
    const phaseScalar = this.resolvePhaseScalar(policy);
    const modeScalar = this.resolveModeScalar(policy);
    const heatScalar = this.resolveHeatScalar(policy);
    const tensionScalar = this.resolveTensionScalar(policy);
    const shieldScalar = this.resolveShieldScalar(policy);
    const economyScalar = this.resolveEconomyScalar(policy);
    const telemetryScalar = this.resolveTelemetryScalar(policy);
    const triggerScalar = this.resolveTriggerScalar(policy);
    const positiveNegativeScalar = this.resolvePositiveNegativeScalar(policy);
    const chainDensityScalar = this.resolveChainDensityScalar(policy);

    const combined = [
      pressureScalar,
      repeatScalar,
      severityScalar,
      phaseScalar,
      modeScalar,
      heatScalar,
      tensionScalar,
      shieldScalar,
      economyScalar,
      telemetryScalar,
      triggerScalar,
      positiveNegativeScalar,
      chainDensityScalar,
    ].reduce((acc, value) => acc * value, 1);

    const combinedScalar = this.clampCombinedScalar(policy, combined);

    return {
      pressureScalar,
      repeatScalar,
      severityScalar,
      phaseScalar,
      modeScalar,
      heatScalar,
      tensionScalar,
      shieldScalar,
      economyScalar,
      telemetryScalar,
      triggerScalar,
      positiveNegativeScalar,
      chainDensityScalar,
      combinedScalar,
    };
  }

  private resolvePressureScalar(policy: QueuePolicyContext): number {
    return (
      policy.template.pressureScalar?.[policy.snapshot.pressure.tier] ??
      PRESSURE_SCALAR_FALLBACK[policy.snapshot.pressure.tier]
    );
  }

  private resolveRepeatScalar(policy: QueuePolicyContext): number {
    if (policy.template.positive) {
      return Math.min(
        POSITIVE_NEGATIVE_REPEAT_FALLOFF.positiveMax,
        1 + policy.triggerCount * POSITIVE_NEGATIVE_REPEAT_FALLOFF.positiveRepeatSlope,
      );
    }

    return Math.min(
      POSITIVE_NEGATIVE_REPEAT_FALLOFF.negativeMax,
      1 + policy.triggerCount * POSITIVE_NEGATIVE_REPEAT_FALLOFF.negativeRepeatSlope,
    );
  }

  private resolveSeverityScalar(policy: QueuePolicyContext): number {
    return SEVERITY_SCALAR[policy.template.severity];
  }

  private resolvePhaseScalar(policy: QueuePolicyContext): number {
    return PHASE_CREATION_SCALAR[policy.snapshot.phase];
  }

  private resolveModeScalar(policy: QueuePolicyContext): number {
    if (policy.template.positive) {
      return MODE_POSITIVE_SCALAR[policy.snapshot.mode];
    }

    return MODE_CREATION_SCALAR[policy.snapshot.mode];
  }

  private resolveHeatScalar(policy: QueuePolicyContext): number {
    return pickScalarFromMaxInclusiveTable(
      policy.snapshot.economy.haterHeat,
      HEAT_SCALAR_BREAKPOINTS,
    );
  }

  private resolveTensionScalar(policy: QueuePolicyContext): number {
    return pickScalarFromMaxInclusiveTable(policy.snapshot.tension.score, TENSION_SCALAR_BREAKPOINTS);
  }

  private resolveShieldScalar(policy: QueuePolicyContext): number {
    const scalarByWeakest = pickScalarFromMaxInclusiveTable(
      policy.weakestLayerRatio,
      SHIELD_DISTRESS_BREAKPOINTS,
    );

    const scalarByAverage = pickScalarFromMaxInclusiveTable(
      policy.allShieldRatioAverage,
      SHIELD_DISTRESS_BREAKPOINTS,
    );

    if (policy.template.positive) {
      return clampNumber((scalarByWeakest + scalarByAverage) / 2, 0.92, 1.18);
    }

    return clampNumber((scalarByWeakest * 0.65) + (scalarByAverage * 0.35), 0.9, 1.3);
  }

  private resolveEconomyScalar(policy: QueuePolicyContext): number {
    const netWorthScalar = pickScalarFromMaxInclusiveTable(
      policy.snapshot.economy.netWorth,
      ECONOMY_NET_WORTH_BREAKPOINTS,
    );

    const cashScalar = pickScalarFromMaxInclusiveTable(
      policy.snapshot.economy.cash,
      ECONOMY_CASH_BREAKPOINTS,
    );

    const debtWeight = policy.snapshot.economy.debt > 0
      ? clampNumber(1 + (policy.snapshot.economy.debt / Math.max(1000, Math.abs(policy.snapshot.economy.netWorth) + 1000)) * 0.25, 1, 1.22)
      : 1;

    const raw = ((netWorthScalar * 0.45) + (cashScalar * 0.45) + (debtWeight * 0.10));

    if (policy.template.positive) {
      return clampNumber(2 - raw, 0.86, 1.12);
    }

    return clampNumber(raw, 0.92, 1.3);
  }

  private resolveTelemetryScalar(policy: QueuePolicyContext): number {
    const eventScalar = pickScalarFromMaxInclusiveTable(
      policy.snapshot.telemetry.emittedEventCount,
      TELEMETRY_EVENT_SCALAR_BREAKPOINTS,
    );

    const warningScalar = pickScalarFromMaxInclusiveTable(
      policy.snapshot.telemetry.warnings.length,
      WARNING_SCALAR_BREAKPOINTS,
    );

    if (policy.template.positive) {
      return clampNumber(2 - (((eventScalar * 0.7) + (warningScalar * 0.3))), 0.9, 1.08);
    }

    return clampNumber((eventScalar * 0.7) + (warningScalar * 0.3), 0.95, 1.16);
  }

  private resolveTriggerScalar(policy: QueuePolicyContext): number {
    const familyScalar = policy.template.positive
      ? (POSITIVE_TRIGGER_FAMILY_SCALARS[policy.triggerFamily] ?? 1)
      : (TRIGGER_FAMILY_SCALARS[policy.triggerFamily] ?? 1);

    const facetScalar = policy.triggerFacet
      ? (TRIGGER_FACET_SCALARS[policy.triggerFacet] ?? 1)
      : 1;

    return clampNumber((familyScalar * 0.75) + (facetScalar * 0.25), 0.9, 1.18);
  }

  private resolvePositiveNegativeScalar(policy: QueuePolicyContext): number {
    if (policy.template.positive) {
      const severePressurePenalty = policy.snapshot.pressure.tier === 'T4' ? 0.93 : 1;
      const densityBrake = policy.pendingChains.length >= 2 ? 0.97 : 1;
      return clampNumber(severePressurePenalty * densityBrake, 0.88, 1.04);
    }

    const criticalPressureBonus = policy.snapshot.pressure.tier === 'T4' ? 1.06 : 1;
    const l4Bonus = policy.weakestLayerId === 'L4' ? 1.03 : 1;
    return clampNumber(criticalPressureBonus * l4Bonus, 1, 1.12);
  }

  private resolveChainDensityScalar(policy: QueuePolicyContext): number {
    const density = policy.snapshot.cascade.activeChains.filter((chain) => chain.status === 'ACTIVE').length +
      policy.pendingChains.filter((chain) => chain.status === 'ACTIVE').length;

    const scalar = pickScalarFromMaxInclusiveTable(density, DENSITY_SCALAR_BREAKPOINTS);

    if (policy.template.positive) {
      return clampNumber(2 - scalar, 0.9, 1.02);
    }

    return clampNumber(scalar, 1, 1.12);
  }

  private clampCombinedScalar(policy: QueuePolicyContext, scalar: number): number {
    if (policy.template.positive) {
      return clampNumber(scalar, 0.84, POSITIVE_SCALAR_CEILING);
    }

    return clampNumber(scalar, NEGATIVE_SCALAR_FLOOR, SEVERITY_MAX_SCALAR[policy.template.severity]);
  }

  // ---------------------------------------------------------------------------
  // Timing / Scheduling
  // ---------------------------------------------------------------------------

  private resolveTimingAcceleration(
    policy: QueuePolicyContext,
    scalars: CreationScalarBundle,
  ): TimingAccelerationBundle {
    const templateModeAcceleration = this.resolveTemplateModeAcceleration(policy);
    const bleedAcceleration = this.resolveBleedAcceleration(policy);
    const ghostAcceleration = this.resolveGhostAcceleration(policy);
    const pressureAcceleration = this.resolvePressureAcceleration(policy);
    const phaseAcceleration = this.resolvePhaseAcceleration(policy);
    const heatAcceleration = this.resolveHeatAcceleration(policy);
    const eventCongestionAcceleration = this.resolveEventCongestionAcceleration(policy);
    const positiveBrake = this.resolvePositiveBrake(policy, scalars);

    const totalAcceleration = clampInteger(
      templateModeAcceleration +
        bleedAcceleration +
        ghostAcceleration +
        pressureAcceleration +
        phaseAcceleration +
        heatAcceleration +
        eventCongestionAcceleration -
        positiveBrake,
      0,
      HARD_MAX_ACCELERATION,
    );

    return {
      templateModeAcceleration,
      bleedAcceleration,
      ghostAcceleration,
      pressureAcceleration,
      phaseAcceleration,
      heatAcceleration,
      eventCongestionAcceleration,
      positiveBrake,
      totalAcceleration,
    };
  }

  private resolveTemplateModeAcceleration(policy: QueuePolicyContext): number {
    return clampInteger(
      policy.template.modeOffsetModifier?.[policy.snapshot.mode] ?? 0,
      -2,
      3,
    );
  }

  private resolveBleedAcceleration(policy: QueuePolicyContext): number {
    if (policy.snapshot.modeState.bleedMode && !policy.template.positive) {
      return 1;
    }

    return 0;
  }

  private resolveGhostAcceleration(policy: QueuePolicyContext): number {
    if (policy.snapshot.mode === 'ghost' && !policy.template.positive) {
      return 1;
    }

    return 0;
  }

  private resolvePressureAcceleration(policy: QueuePolicyContext): number {
    if (policy.template.positive) {
      if (policy.snapshot.pressure.tier === 'T3' && policy.snapshot.shield.weakestLayerRatio >= 0.2) {
        return 1;
      }
      return 0;
    }

    return PRESSURE_ACCELERATION[policy.snapshot.pressure.tier];
  }

  private resolvePhaseAcceleration(policy: QueuePolicyContext): number {
    if (policy.template.positive) {
      return policy.snapshot.phase === 'SOVEREIGNTY' ? 1 : 0;
    }

    return PHASE_ACCELERATION[policy.snapshot.phase];
  }

  private resolveHeatAcceleration(policy: QueuePolicyContext): number {
    if (policy.template.positive) {
      return 0;
    }

    return pickAccelerationFromMinInclusiveTable(
      policy.snapshot.economy.haterHeat,
      HEAT_ACCELERATION_BREAKPOINTS,
    );
  }

  private resolveEventCongestionAcceleration(policy: QueuePolicyContext): number {
    if (policy.template.positive) {
      return 0;
    }

    return pickAccelerationFromMinInclusiveTable(
      policy.snapshot.telemetry.emittedEventCount,
      TELEMETRY_EVENT_ACCELERATION_BREAKPOINTS,
    );
  }

  private resolvePositiveBrake(
    policy: QueuePolicyContext,
    scalars: CreationScalarBundle,
  ): number {
    if (!policy.template.positive) {
      return 0;
    }

    const activeDensity = policy.snapshot.cascade.activeChains.filter((chain) => chain.status === 'ACTIVE').length;
    const densityBrake = pickBrakeFromMinInclusiveTable(activeDensity, POSITIVE_BRAKE_BREAKPOINTS);
    const scalarBrake = scalars.combinedScalar > 1.15 ? 1 : 0;

    return densityBrake + scalarBrake;
  }

  /**
   * Full link planning surface — builds `ScheduledLinkPlan[]` with all
   * scheduling metadata (offsets, accelerations, indices). This is the
   * authoritative internal representation consumed by `diagnose()`,
   * `breakdownLinkEffects()`, and `planLinks()`.
   */
  private planLinksDetailed(context: OffsetPlanningContext): readonly ScheduledLinkPlan[] {
    const normalizedOffsets = this.normalizeBaseOffsets(context.policy.template.baseOffsets);
    const acceleratedOffsets = this.applyAccelerationToOffsets(normalizedOffsets, context);
    const monotonicOffsets = this.applyMonotonicSpacing(acceleratedOffsets, context.policy.template.severity);
    const staggeredOffsets = this.applyDeterministicStagger(monotonicOffsets, context);
    const smoothedOffsets = this.applyPositiveSmoothing(staggeredOffsets, context);
    const scheduledTicks = this.materializeScheduledTicks(smoothedOffsets, context);
    const effects = this.planEffects(context, scheduledTicks.length);

    return Object.freeze(
      scheduledTicks.map((scheduledTick, index): ScheduledLinkPlan => {
        const effect = effects[index] ?? {};
        const baseOffset = normalizedOffsets[index] ?? index;
        const acceleratedOffset = acceleratedOffsets[index] ?? baseOffset;
        const normalizedOffset = smoothedOffsets[index] ?? acceleratedOffset;

        return {
          linkIndex: index,
          linkId: this.composeLinkId(context.policy, index),
          baseOffset,
          acceleratedOffset,
          normalizedOffset,
          scheduledTick,
          summary: this.composeLinkSummary(context.policy, index, scheduledTick, effect),
          effect,
        };
      }),
    );
  }

  private planLinks(context: OffsetPlanningContext): readonly CascadeLink[] {
    return Object.freeze(
      this.planLinksDetailed(context).map((plan) => ({
        linkId: plan.linkId,
        scheduledTick: plan.scheduledTick,
        effect: plan.effect,
        summary: plan.summary,
      })),
    );
  }

  private normalizeBaseOffsets(baseOffsets: readonly number[]): readonly number[] {
    const normalized: number[] = [];

    for (let index = 0; index < baseOffsets.length; index += 1) {
      const raw = baseOffsets[index];
      const value = Number.isFinite(raw) ? Math.max(HARD_MIN_OFFSET, Math.trunc(raw)) : index;
      normalized.push(value);
    }

    return Object.freeze(normalized);
  }

  private applyAccelerationToOffsets(
    offsets: readonly number[],
    context: OffsetPlanningContext,
  ): readonly number[] {
    const accelerated: number[] = [];
    const totalAcceleration = context.acceleration.totalAcceleration;

    for (let index = 0; index < offsets.length; index += 1) {
      const offset = offsets[index] ?? index;
      const perLinkAcceleration = this.resolvePerLinkAcceleration(index, context);
      const adjusted = Math.max(HARD_MIN_OFFSET, offset - totalAcceleration - perLinkAcceleration);
      accelerated.push(adjusted);
    }

    return Object.freeze(accelerated);
  }

  private resolvePerLinkAcceleration(
    linkIndex: number,
    context: OffsetPlanningContext,
  ): number {
    const { policy, scalars } = context;

    if (policy.template.positive) {
      if (linkIndex === 0 && policy.snapshot.phase === 'SOVEREIGNTY') {
        return 1;
      }
      return 0;
    }

    let acceleration = 0;

    if (linkIndex === 0 && policy.snapshot.pressure.tier === 'T4') {
      acceleration += 1;
    }

    if (linkIndex > 0 && scalars.combinedScalar >= 1.45) {
      acceleration += 1;
    }

    if (policy.triggerFacet === 'L4' && linkIndex < 2) {
      acceleration += 1;
    }

    return clampInteger(acceleration, 0, 2);
  }

  private applyMonotonicSpacing(
    offsets: readonly number[],
    severity: CascadeSeverity,
  ): readonly number[] {
    const spaced: number[] = [];
    const minimumSpacing = SEVERITY_MIN_SPACING[severity];

    for (let index = 0; index < offsets.length; index += 1) {
      const proposed = offsets[index] ?? index;

      if (index === 0) {
        spaced.push(Math.max(HARD_MIN_OFFSET, proposed));
        continue;
      }

      const previous = spaced[index - 1] ?? HARD_MIN_OFFSET;
      spaced.push(Math.max(proposed, previous + minimumSpacing));
    }

    return Object.freeze(spaced);
  }

  private applyDeterministicStagger(
    offsets: readonly number[],
    context: OffsetPlanningContext,
  ): readonly number[] {
    const staggerSeed = this.computeDeterministicStaggerSeed(context.policy);
    const staggered: number[] = [];

    for (let index = 0; index < offsets.length; index += 1) {
      const base = offsets[index] ?? index;
      const stagger = this.resolveStaggerAmount(staggerSeed, index, context);
      const adjusted = Math.max(HARD_MIN_OFFSET, base + stagger);
      staggered.push(adjusted);
    }

    return Object.freeze(staggered);
  }

  private computeDeterministicStaggerSeed(policy: QueuePolicyContext): number {
    const source = `${policy.template.templateId}|${policy.normalizedTrigger}|${policy.snapshot.seed}|${policy.snapshot.tick}|${policy.instanceOrdinal}`;
    let checksum = 0;

    for (let index = 0; index < source.length; index += 1) {
      checksum = (checksum + source.charCodeAt(index) * (index + 1)) % 100000;
    }

    return checksum;
  }

  private resolveStaggerAmount(
    seed: number,
    linkIndex: number,
    context: OffsetPlanningContext,
  ): number {
    if (context.policy.template.positive) {
      return 0;
    }

    const raw = (seed + (linkIndex + 1) * 17 + context.policy.snapshot.tick * 3) % 3;

    if (context.policy.template.severity === 'CRITICAL') {
      return raw === 2 ? 0 : 0;
    }

    return raw === 0 ? 0 : 0;
  }

  private applyPositiveSmoothing(
    offsets: readonly number[],
    context: OffsetPlanningContext,
  ): readonly number[] {
    if (!context.policy.template.positive) {
      return offsets;
    }

    const smoothed: number[] = [];

    for (let index = 0; index < offsets.length; index += 1) {
      const current = offsets[index] ?? index;

      if (index === 0) {
        smoothed.push(current);
        continue;
      }

      const previous = smoothed[index - 1] ?? 0;
      const minimumGap = context.scalars.combinedScalar >= 1.08 ? 1 : 2;
      smoothed.push(Math.max(current, previous + minimumGap));
    }

    return Object.freeze(smoothed);
  }

  private materializeScheduledTicks(
    offsets: readonly number[],
    context: OffsetPlanningContext,
  ): readonly number[] {
    const scheduled: number[] = [];

    for (let index = 0; index < offsets.length; index += 1) {
      const offset = offsets[index] ?? index;
      scheduled.push(context.policy.snapshot.tick + offset);
    }

    return Object.freeze(scheduled);
  }

  // ---------------------------------------------------------------------------
  // Effect Planning
  // ---------------------------------------------------------------------------

  private planEffects(
    context: OffsetPlanningContext,
    linkCount: number,
  ): readonly EffectPayload[] {
    const planned: EffectPayload[] = [];

    for (let index = 0; index < linkCount; index += 1) {
      const baseEffect = context.policy.template.effects[index] ?? {};
      const linkScalar = this.resolveLinkScalar(context, index);
      const effect = this.scaleEffect(baseEffect, linkScalar, context.policy.template.positive);
      const annotatedEffect = this.applyContextSensitiveEffectAdjustments(effect, context, index);
      planned.push(annotatedEffect);
    }

    return Object.freeze(planned);
  }

  private resolveLinkScalar(
    context: OffsetPlanningContext,
    linkIndex: number,
  ): number {
    const base = context.scalars.combinedScalar;
    const progressionScalar = this.resolveProgressionScalar(context, linkIndex);
    const tailScalar = this.resolveTailScalar(context, linkIndex);
    const volatilityScalar = this.resolveVolatilityScalar(context, linkIndex);

    const combined = base * progressionScalar * tailScalar * volatilityScalar;

    return this.clampLinkScalar(context.policy, combined);
  }

  private resolveProgressionScalar(
    context: OffsetPlanningContext,
    linkIndex: number,
  ): number {
    const totalLinks = context.policy.template.effects.length;

    if (totalLinks <= 1) {
      return 1;
    }

    const ratio = linkIndex / Math.max(1, totalLinks - 1);

    if (context.policy.template.positive) {
      return clampNumber(0.96 + ratio * 0.18, 0.96, 1.14);
    }

    switch (context.policy.template.severity) {
      case 'LOW':
        return clampNumber(0.98 + ratio * 0.12, 0.98, 1.1);
      case 'MEDIUM':
        return clampNumber(1 + ratio * 0.16, 1, 1.16);
      case 'HIGH':
        return clampNumber(1.02 + ratio * 0.22, 1.02, 1.24);
      case 'CRITICAL':
        return clampNumber(1.04 + ratio * 0.3, 1.04, 1.34);
      default:
        return 1;
    }
  }

  private resolveTailScalar(
    context: OffsetPlanningContext,
    linkIndex: number,
  ): number {
    const lastIndex = context.policy.template.effects.length - 1;

    if (linkIndex !== lastIndex) {
      return 1;
    }

    if (context.policy.template.positive) {
      return 1.05;
    }

    if (context.policy.template.severity === 'CRITICAL') {
      return 1.12;
    }

    if (context.policy.template.severity === 'HIGH') {
      return 1.08;
    }

    return 1.04;
  }

  private resolveVolatilityScalar(
    context: OffsetPlanningContext,
    linkIndex: number,
  ): number {
    const triggerFamily = context.policy.triggerFamily;

    if (triggerFamily === 'economy') {
      return linkIndex === 0 ? 1.04 : 1.01;
    }

    if (triggerFamily === 'pressure') {
      return context.policy.snapshot.pressure.tier === 'T4' ? 1.06 : 1.02;
    }

    if (triggerFamily === 'positive') {
      return context.policy.template.positive ? 1.03 : 1;
    }

    return 1;
  }

  private clampLinkScalar(policy: QueuePolicyContext, scalar: number): number {
    if (policy.template.positive) {
      return clampNumber(scalar, 0.82, POSITIVE_SCALAR_CEILING);
    }

    return clampNumber(scalar, NEGATIVE_SCALAR_FLOOR, SEVERITY_MAX_SCALAR[policy.template.severity]);
  }

  private scaleEffect(
    effect: EffectPayload,
    factor: number,
    positive: boolean,
  ): EffectPayload {
    const mutable: MutableEffectPayload = {
      cashDelta: undefined,
      debtDelta: undefined,
      incomeDelta: undefined,
      expenseDelta: undefined,
      shieldDelta: undefined,
      heatDelta: undefined,
      trustDelta: undefined,
      treasuryDelta: undefined,
      battleBudgetDelta: undefined,
      holdChargeDelta: undefined,
      counterIntelDelta: undefined,
      timeDeltaMs: undefined,
      divergenceDelta: undefined,
      cascadeTag: effect.cascadeTag ?? null,
      injectCards: effect.injectCards ? [...effect.injectCards] : undefined,
      exhaustCards: effect.exhaustCards ? [...effect.exhaustCards] : undefined,
      grantBadges: effect.grantBadges ? [...effect.grantBadges] : undefined,
      namedActionId: effect.namedActionId ?? null,
    };

    for (const field of NUMERIC_EFFECT_FIELDS) {
      const value = effect[field];

      if (value === undefined) {
        continue;
      }

      mutable[field] = this.scaleNumericValue(value, factor, positive);
    }

    return this.cleanupEffectPayload(mutable);
  }

  private scaleNumericValue(
    value: number,
    factor: number,
    positive: boolean,
  ): number {
    if (value === 0 || factor === 0) {
      return 0;
    }

    const scaled = value * factor;
    const rounded = value > 0 ? Math.floor(scaled) : Math.ceil(scaled);

    if (rounded !== 0) {
      return rounded;
    }

    if (positive && value < 0) {
      return -EFFECT_MIN_MAGNITUDE_WHEN_NONZERO;
    }

    if (!positive && value > 0) {
      return EFFECT_MIN_MAGNITUDE_WHEN_NONZERO;
    }

    return value > 0 ? EFFECT_MIN_MAGNITUDE_WHEN_NONZERO : -EFFECT_MIN_MAGNITUDE_WHEN_NONZERO;
  }

  private applyContextSensitiveEffectAdjustments(
    effect: EffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): EffectPayload {
    const mutable: MutableEffectPayload = {
      ...effect,
      injectCards: effect.injectCards ? [...effect.injectCards] : undefined,
      exhaustCards: effect.exhaustCards ? [...effect.exhaustCards] : undefined,
      grantBadges: effect.grantBadges ? [...effect.grantBadges] : undefined,
      namedActionId: effect.namedActionId ?? null,
      cascadeTag: effect.cascadeTag ?? null,
    };

    this.applyPressureSensitiveAdjustments(mutable, context, linkIndex);
    this.applyModeSensitiveAdjustments(mutable, context, linkIndex);
    this.applyShieldSensitiveAdjustments(mutable, context, linkIndex);
    this.applyEconomySensitiveAdjustments(mutable, context, linkIndex);
    this.applyPositiveTrackAdjustments(mutable, context, linkIndex);
    this.applyRecoverySurfaceEchoes(mutable, context, linkIndex);

    return this.cleanupEffectPayload(mutable);
  }

  private applyPressureSensitiveAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    const tier = context.policy.snapshot.pressure.tier;

    if (context.policy.template.positive) {
      if (tier === 'T4' && linkIndex === 0) {
        effect.shieldDelta = this.addOptional(effect.shieldDelta, 1);
      }

      if (tier === 'T3' || tier === 'T4') {
        effect.heatDelta = this.addOptional(effect.heatDelta, -1);
      }

      return;
    }

    if (tier === 'T4') {
      effect.heatDelta = this.addOptional(effect.heatDelta, 1);
    }

    if (tier === 'T4' && linkIndex === 0 && context.policy.template.severity === 'CRITICAL') {
      effect.timeDeltaMs = this.addOptional(effect.timeDeltaMs, -250);
    }

    if (tier === 'T3' || tier === 'T4') {
      effect.divergenceDelta = this.addOptional(effect.divergenceDelta, 1);
    }
  }

  private applyModeSensitiveAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    switch (context.policy.snapshot.mode) {
      case 'solo':
        this.applySoloAdjustments(effect, context, linkIndex);
        break;
      case 'pvp':
        this.applyPvpAdjustments(effect, context, linkIndex);
        break;
      case 'coop':
        this.applyCoopAdjustments(effect, context, linkIndex);
        break;
      case 'ghost':
        this.applyGhostAdjustments(effect, context, linkIndex);
        break;
      default:
        break;
    }
  }

  private applySoloAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    if (context.policy.template.positive) {
      if (linkIndex === 0 && context.policy.snapshot.modeState.holdEnabled) {
        effect.holdChargeDelta = this.addOptional(effect.holdChargeDelta, 1);
      }
      return;
    }

    if (context.policy.snapshot.modeState.holdEnabled && linkIndex === 0) {
      effect.timeDeltaMs = this.addOptional(effect.timeDeltaMs, -100);
    }
  }

  private applyPvpAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    if (context.policy.template.positive) {
      effect.battleBudgetDelta = this.addOptional(effect.battleBudgetDelta, linkIndex === 0 ? 1 : 0);
      return;
    }

    effect.battleBudgetDelta = this.addOptional(effect.battleBudgetDelta, linkIndex === 0 ? -1 : 0);

    if (context.policy.triggerFamily === 'economy') {
      effect.counterIntelDelta = this.addOptional(effect.counterIntelDelta, -1);
    }
  }

  private applyCoopAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    if (context.policy.template.positive) {
      if (context.policy.snapshot.modeState.sharedTreasury) {
        effect.treasuryDelta = this.addOptional(effect.treasuryDelta, linkIndex === 0 ? 1 : 0);
      }

      if (Object.keys(context.policy.snapshot.modeState.trustScores).length > 0) {
        effect.trustDelta = this.addOptional(effect.trustDelta, 1);
      }

      return;
    }

    if (Object.keys(context.policy.snapshot.modeState.trustScores).length > 0) {
      effect.trustDelta = this.addOptional(effect.trustDelta, -1);
    }
  }

  private applyGhostAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    if (context.policy.template.positive) {
      effect.divergenceDelta = this.addOptional(effect.divergenceDelta, -1);
      return;
    }

    effect.divergenceDelta = this.addOptional(effect.divergenceDelta, 1);

    if (context.policy.snapshot.modeState.legendMarkersEnabled && linkIndex === 0) {
      effect.timeDeltaMs = this.addOptional(effect.timeDeltaMs, -120);
    }
  }

  private applyShieldSensitiveAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    const weakest = context.policy.snapshot.shield.weakestLayerId;
    const weakestRatio = context.policy.weakestLayerRatio;

    if (context.policy.template.positive) {
      if (weakestRatio <= 0.25) {
        effect.shieldDelta = this.addOptional(effect.shieldDelta, 1);
      }

      if (weakest === 'L4' && linkIndex === 0) {
        effect.trustDelta = this.addOptional(effect.trustDelta, 1);
      }

      return;
    }

    if (weakestRatio <= 0.20) {
      effect.heatDelta = this.addOptional(effect.heatDelta, 1);
    }

    if (weakest === 'L4' && linkIndex === 0) {
      effect.shieldDelta = this.addOptional(effect.shieldDelta, -1);
    }
  }

  private applyEconomySensitiveAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    const economy = context.policy.snapshot.economy;

    if (context.policy.template.positive) {
      if (economy.cash < 500 && linkIndex === 0) {
        effect.cashDelta = this.addOptional(effect.cashDelta, 50);
      }

      if (economy.debt > 0 && linkIndex === context.policy.template.effects.length - 1) {
        effect.debtDelta = this.addOptional(effect.debtDelta, -1);
      }

      return;
    }

    if (economy.cash < 250 && linkIndex === 0) {
      effect.cashDelta = this.addOptional(effect.cashDelta, -50);
    }

    if (economy.debt > 0) {
      effect.debtDelta = this.addOptional(effect.debtDelta, 1);
    }
  }

  private applyPositiveTrackAdjustments(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    _linkIndex: number,
  ): void {
    if (!context.policy.template.positive) {
      return;
    }

    if (!context.policy.snapshot.cascade.positiveTrackers.includes(context.policy.template.templateId)) {
      return;
    }

    effect.heatDelta = this.addOptional(effect.heatDelta, -1);
  }

  private applyRecoverySurfaceEchoes(
    effect: MutableEffectPayload,
    context: OffsetPlanningContext,
    linkIndex: number,
  ): void {
    const cardTagConditions = context.policy.template.recovery.filter(
      (entry): entry is Extract<RecoveryCondition, { readonly kind: 'CARD_TAG_ANY' }> =>
        entry.kind === 'CARD_TAG_ANY',
    );

    if (cardTagConditions.length === 0) {
      return;
    }

    if (context.policy.template.positive) {
      return;
    }

    const recoveryTagCount = cardTagConditions.reduce(
      (sum, entry) => sum + entry.tags.length,
      0,
    );

    if (recoveryTagCount >= 3 && linkIndex === 0) {
      effect.namedActionId = effect.namedActionId ?? 'cascade-recovery-window';
    }
  }

  private addOptional(current: number | undefined, delta: number): number {
    return (current ?? 0) + delta;
  }

  private cleanupEffectPayload(effect: MutableEffectPayload): EffectPayload {
    const cleaned: MutableEffectPayload = {
      cashDelta: effect.cashDelta,
      debtDelta: effect.debtDelta,
      incomeDelta: effect.incomeDelta,
      expenseDelta: effect.expenseDelta,
      shieldDelta: effect.shieldDelta,
      heatDelta: effect.heatDelta,
      trustDelta: effect.trustDelta,
      treasuryDelta: effect.treasuryDelta,
      battleBudgetDelta: effect.battleBudgetDelta,
      holdChargeDelta: effect.holdChargeDelta,
      counterIntelDelta: effect.counterIntelDelta,
      timeDeltaMs: effect.timeDeltaMs,
      divergenceDelta: effect.divergenceDelta,
      cascadeTag: effect.cascadeTag ?? null,
      injectCards: effect.injectCards && effect.injectCards.length > 0 ? [...effect.injectCards] : undefined,
      exhaustCards: effect.exhaustCards && effect.exhaustCards.length > 0 ? [...effect.exhaustCards] : undefined,
      grantBadges: effect.grantBadges && effect.grantBadges.length > 0 ? [...effect.grantBadges] : undefined,
      namedActionId: effect.namedActionId ?? null,
    };

    for (const field of NUMERIC_EFFECT_FIELDS) {
      if (cleaned[field] === 0) {
        cleaned[field] = undefined;
      }
    }

    if (typeof cleaned.namedActionId === 'string' && cleaned.namedActionId.trim().length === 0) {
      cleaned.namedActionId = null;
    }

    return cleaned;
  }

  // ---------------------------------------------------------------------------
  // Recovery Surface Planning
  // ---------------------------------------------------------------------------

  private resolveRecoveryTags(template: CascadeTemplate): readonly string[] {
    const derivedFromConditions = template.recovery.flatMap((condition) => this.extractTagsFromRecoveryCondition(condition));

    return dedupeStrings([
      ...template.recoveryTags,
      ...derivedFromConditions,
      template.positive ? 'positive' : 'negative',
      template.severity.toLowerCase(),
    ]);
  }

  private extractTagsFromRecoveryCondition(
    condition: RecoveryCondition,
  ): readonly string[] {
    switch (condition.kind) {
      case 'CARD_TAG_ANY':
        return [...condition.tags];
      case 'LAST_PLAYED_TAG_ANY':
        return [...condition.tags];
      case 'CASH_MIN':
        return ['cash_gate'];
      case 'WEAKEST_SHIELD_RATIO_MIN':
        return ['shield_repair'];
      case 'ALL_SHIELDS_RATIO_MIN':
        return ['all_shields'];
      case 'TRUST_ANY_MIN':
        return ['trust'];
      case 'HEAT_MAX':
        return ['heat_control'];
      case 'PRESSURE_NOT_ABOVE':
        return ['pressure_control'];
      default:
        return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Deterministic ID / Summary Composition
  // ---------------------------------------------------------------------------

  private composeChainId(policy: QueuePolicyContext): string {
    return createDeterministicId(
      'cascade',
      policy.snapshot.seed,
      policy.snapshot.runId,
      policy.template.templateId,
      policy.normalizedTrigger,
      policy.snapshot.mode,
      policy.snapshot.phase,
      policy.snapshot.tick,
      policy.instanceOrdinal,
      policy.triggerCount,
    );
  }

  private composeLinkId(
    policy: QueuePolicyContext,
    linkIndex: number,
  ): string {
    return createDeterministicId(
      'cascade-link',
      policy.snapshot.seed,
      policy.snapshot.runId,
      policy.template.templateId,
      policy.normalizedTrigger,
      policy.snapshot.tick,
      policy.instanceOrdinal,
      linkIndex,
    );
  }

  private composeLinkSummary(
    policy: QueuePolicyContext,
    linkIndex: number,
    scheduledTick: number,
    effect: EffectPayload,
  ): string {
    const fragments = [
      policy.template.templateId,
      `step=${linkIndex + 1}`,
      `tick=${scheduledTick}`,
      `mode=${policy.snapshot.mode}`,
      `phase=${policy.snapshot.phase}`,
      `trigger=${policy.triggerFamily}${policy.triggerFacet ? `:${policy.triggerFacet}` : ''}`,
      `tag=${effect.cascadeTag ?? 'none'}`,
    ];

    return fragments.join('::');
  }

  // ---------------------------------------------------------------------------
  // Public Analytics, Diagnostics & ML Surfaces
  // ---------------------------------------------------------------------------

  /**
   * Returns a rich creation diagnostics report for a potential cascade chain.
   *
   * This is the external-facing version of the internal policy check, exposing
   * scalar bundles, acceleration bundles, and per-link schedules for tooling,
   * replay playback, ML pressure models, and proof narration.
   *
   * Does NOT create a chain. Safe to call speculatively without side effects.
   */
  public diagnose(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): RichCreationDiagnostics {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);
    const policyCheck = this.evaluateCreationPolicy(policy, 0);
    const scalars = this.resolveCreationScalars(policy);
    const acceleration = this.resolveTimingAcceleration(policy, scalars);
    const offsetContext: OffsetPlanningContext = { policy, scalars, acceleration };
    const plannedLinks = policyCheck.wouldCreate ? this.planLinksDetailed(offsetContext) : [];

    const warnings: string[] = [];

    if (scalars.combinedScalar > 1.7) {
      warnings.push('combined_scalar_critically_high');
    }

    if (acceleration.totalAcceleration >= HARD_MAX_ACCELERATION) {
      warnings.push('acceleration_at_hard_maximum');
    }

    if (plannedLinks.length > 8) {
      warnings.push('chain_density_high_link_count');
    }

    if (!policyCheck.wouldCreate && policyCheck.reasons.length === 0) {
      warnings.push('policy_denied_with_no_reason_recorded');
    }

    return {
      reasons: policyCheck.reasons,
      warnings: Object.freeze(warnings),
      telemetryTags: Object.freeze([...(template.telemetryTags ?? [])]),
      scalarBundle: scalars,
      accelerationBundle: acceleration,
      plannedLinks: Object.freeze(plannedLinks),
    };
  }

  /**
   * Resolves a typed queue decision result for a potential chain creation.
   *
   * Maps internal gate reason strings to a canonical `QueueDecision` enum and
   * a structured `QueueDecisionResult` for downstream consumers:
   * - UI overlays and cascade event streams
   * - Chat-layer narration of rejections
   * - Proof generation and audit trails
   * - ML reward shaping for decision acceptance/rejection
   */
  public getQueueDecision(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
    pendingTriggerCount = 0,
  ): QueueDecisionResult {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);
    const check = this.evaluateCreationPolicy(policy, pendingTriggerCount);
    const decision: QueueDecision = check.wouldCreate ? 'ALLOW' : 'DENY';
    const reasonCode = this.classifyQueueReasonCode(check.reasons);

    return {
      decision,
      allowed: check.wouldCreate,
      reasonCode,
      reasons: check.reasons,
    };
  }

  /**
   * Classifies the primary failure reason code from a list of gate failure
   * strings. Ordered from most-specific to least-specific so the dominant
   * failure mode is always surfaced as the `reasonCode`.
   */
  private classifyQueueReasonCode(
    reasons: readonly string[],
  ): QueueDecisionResult['reasonCode'] {
    if (reasons.length === 0) {
      return 'OK';
    }

    for (const reason of reasons) {
      if (
        reason === 'template_concurrency_exceeded' ||
        reason === 'same_trigger_template_already_active'
      ) {
        return 'MAX_CONCURRENT';
      }
      if (reason === 'trigger_budget_exhausted') {
        return 'MAX_TRIGGER_LIMIT';
      }
      if (reason === 'pending_duplicate_signature' || reason === 'same_tick_duplicate') {
        return 'DUPLICATE_SEMANTIC_TRIGGER';
      }
      if (reason === 'positive_tracker_already_recorded') {
        return 'POSITIVE_ALREADY_UNLOCKED';
      }
      if (
        reason === 'early_foundation_critical_guard' ||
        reason === 'positive_rejected_after_outcome'
      ) {
        return 'PHASE_GATED';
      }
      if (
        reason.includes('mode') ||
        reason === 'network_lockdown_requires_l4_bias' ||
        reason === 'calm_pressure_trigger_rejected'
      ) {
        return 'MODE_GATED';
      }
      if (
        reason === 'template_offset_effect_length_mismatch' ||
        reason === 'template_has_no_offsets' ||
        reason === 'template_has_too_many_links' ||
        reason === 'maxConcurrent_out_of_bounds' ||
        reason === 'maxTriggersPerRun_out_of_bounds' ||
        reason === 'empty_trigger'
      ) {
        return 'MANIFEST_INVALID';
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Returns a per-link effect breakdown for a potential cascade chain creation.
   *
   * Each entry in the returned array maps to a single scheduled link and
   * includes the field-keyed numeric impact, non-numeric effect payloads, and
   * any cascade/named action tags.
   *
   * Returns an empty array when the chain would be rejected by queue policy.
   *
   * Used by:
   * - Diagnostics dashboards
   * - Chat narration of cascade impact
   * - Replay tooling and proof generation
   * - ML reward decomposition
   */
  public breakdownLinkEffects(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): readonly QueueLinkEffectBreakdown[] {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);
    const check = this.evaluateCreationPolicy(policy, 0);

    if (!check.wouldCreate) {
      return Object.freeze([]);
    }

    const scalars = this.resolveCreationScalars(policy);
    const acceleration = this.resolveTimingAcceleration(policy, scalars);
    const offsetContext: OffsetPlanningContext = { policy, scalars, acceleration };
    const planned = this.planLinksDetailed(offsetContext);

    return Object.freeze(
      planned.map((plan): QueueLinkEffectBreakdown => {
        const fieldImpacts = {} as Record<NumericEffectField, number | undefined>;
        for (const field of NUMERIC_EFFECT_FIELDS) {
          const val = plan.effect[field];
          fieldImpacts[field] = val !== undefined && val !== 0 ? val : undefined;
        }

        return {
          linkIndex: plan.linkIndex,
          fieldImpacts: Object.freeze(fieldImpacts) as Readonly<
            Record<NumericEffectField, number | undefined>
          >,
          cascadeTag: plan.effect.cascadeTag ?? null,
          injectCards: Object.freeze([...(plan.effect.injectCards ?? [])]),
          exhaustCards: Object.freeze([...(plan.effect.exhaustCards ?? [])]),
          grantBadges: Object.freeze([...(plan.effect.grantBadges ?? [])]),
          namedActionId: plan.effect.namedActionId ?? null,
        };
      }),
    );
  }

  /**
   * Projects the stable queue-visible policy shape for a given creation request.
   *
   * Returns a serializable, replay-safe snapshot of the scheduling context
   * at the point of evaluation. This is consumed by replay tooling and
   * chat-layer rendering to describe the effective scheduling context without
   * re-running full scalar resolution.
   */
  public composePolicyShape(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): QueuePolicyContextShape {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);

    return {
      snapshotSeed: snapshot.seed,
      snapshotTick: snapshot.tick,
      mode: snapshot.mode,
      pressureTier: snapshot.pressure.tier,
      templateId: template.templateId,
      normalizedTrigger: policy.normalizedTrigger,
      triggerFamily: policy.triggerFamily,
      triggerFacet: policy.triggerFacet,
      instanceOrdinal: policy.instanceOrdinal,
      activeOfTemplate: policy.activeOfTemplate,
      pendingOfTemplate: policy.pendingOfTemplate,
      triggerCount: policy.triggerCount,
    };
  }

  /**
   * Computes an aggregate numeric effect total across all planned links for a
   * potential chain. Returns a field-keyed map of total deltas summed across
   * all scheduled links.
   *
   * Positive values indicate a net beneficial impact on that field.
   * Negative values indicate net depletion.
   *
   * Returns null when the chain is rejected by policy (no links would be planned).
   *
   * Used by:
   * - Pre-flight impact assessments in difficulty scaling
   * - ML reward shaping
   * - Cascade weight scoring in CascadeChainRegistry
   */
  public computeChainEffectTotals(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): Readonly<Record<NumericEffectField, number>> | null {
    const breakdown = this.breakdownLinkEffects(snapshot, template, trigger, pendingChains);

    if (breakdown.length === 0) {
      return null;
    }

    const totals = {} as Record<NumericEffectField, number>;
    for (const field of NUMERIC_EFFECT_FIELDS) {
      totals[field] = 0;
    }

    for (const link of breakdown) {
      for (const field of NUMERIC_EFFECT_FIELDS) {
        const val = link.fieldImpacts[field];
        if (val !== undefined) {
          totals[field] += val;
        }
      }
    }

    return Object.freeze(totals);
  }

  /**
   * Returns the scalar footprint for a given snapshot+template combination as
   * a fixed-length 14-element feature vector for ML pressure models.
   *
   * Dimension layout:
   *   [0]  pressureScalar
   *   [1]  repeatScalar
   *   [2]  severityScalar
   *   [3]  phaseScalar
   *   [4]  modeScalar
   *   [5]  heatScalar
   *   [6]  tensionScalar
   *   [7]  shieldScalar
   *   [8]  economyScalar
   *   [9]  telemetryScalar
   *   [10] triggerScalar
   *   [11] positiveNegativeScalar
   *   [12] chainDensityScalar
   *   [13] combinedScalar
   *
   * Suitable for use as input to pressure-adaptive scheduling ML models.
   * All values are bounded scalars in the range [0.82, 2.1].
   */
  public computeScalarFeatureVector(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): readonly number[] {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);
    const scalars = this.resolveCreationScalars(policy);

    return Object.freeze([
      scalars.pressureScalar,
      scalars.repeatScalar,
      scalars.severityScalar,
      scalars.phaseScalar,
      scalars.modeScalar,
      scalars.heatScalar,
      scalars.tensionScalar,
      scalars.shieldScalar,
      scalars.economyScalar,
      scalars.telemetryScalar,
      scalars.triggerScalar,
      scalars.positiveNegativeScalar,
      scalars.chainDensityScalar,
      scalars.combinedScalar,
    ]);
  }

  /**
   * Returns the timing acceleration footprint for a given snapshot+template
   * combination as a fixed-length 9-element feature vector.
   *
   * Dimension layout:
   *   [0] templateModeAcceleration
   *   [1] bleedAcceleration
   *   [2] ghostAcceleration
   *   [3] pressureAcceleration
   *   [4] phaseAcceleration
   *   [5] heatAcceleration
   *   [6] eventCongestionAcceleration
   *   [7] positiveBrake
   *   [8] totalAcceleration
   *
   * Suitable for use in queue scheduling and pacing ML models that predict
   * cascade timing compression under pressure escalation.
   */
  public computeAccelerationFeatureVector(
    snapshot: RunStateSnapshot,
    template: CascadeTemplate,
    trigger: string,
    pendingChains: readonly CascadeChainInstance[] = [],
  ): readonly number[] {
    const policy = this.buildPolicyContext(snapshot, template, trigger, pendingChains);
    const scalars = this.resolveCreationScalars(policy);
    const acceleration = this.resolveTimingAcceleration(policy, scalars);

    return Object.freeze([
      acceleration.templateModeAcceleration,
      acceleration.bleedAcceleration,
      acceleration.ghostAcceleration,
      acceleration.pressureAcceleration,
      acceleration.phaseAcceleration,
      acceleration.heatAcceleration,
      acceleration.eventCongestionAcceleration,
      acceleration.positiveBrake,
      acceleration.totalAcceleration,
    ]);
  }
}
