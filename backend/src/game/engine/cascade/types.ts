/*
 * POINT ZERO ONE — BACKEND CASCADE TYPES
 * /backend/src/game/engine/cascade/types.ts
 *
 * Doctrine:
 * - backend owns authoritative cascade truth
 * - cascade chains must be deterministic, replay-safe, and mode-aware
 * - recovery logic must be explicit, inspectable, and testable
 * - positive cascades are earned state, not cosmetic bonuses
 * - additive extension is preferred over contract breakage
 * - this file preserves all currently consumed exports while expanding the
 *   authored, diagnostic, validation, telemetry, and planning surfaces
 */

import type { EffectPayload, ModeCode, PressureTier } from '../core/GamePrimitives';

// -----------------------------------------------------------------------------
// Canonical Template Identity
// -----------------------------------------------------------------------------

export type CascadeTemplateId =
  | 'LIQUIDITY_SPIRAL'
  | 'CREDIT_FREEZE'
  | 'INCOME_SHOCK'
  | 'NETWORK_LOCKDOWN'
  | 'COMEBACK_SURGE'
  | 'MOMENTUM_ENGINE';

export const CASCADE_TEMPLATE_IDS: readonly CascadeTemplateId[] = Object.freeze([
  'LIQUIDITY_SPIRAL',
  'CREDIT_FREEZE',
  'INCOME_SHOCK',
  'NETWORK_LOCKDOWN',
  'COMEBACK_SURGE',
  'MOMENTUM_ENGINE',
] as const);

export type PositiveCascadeTemplateId = Extract<
  CascadeTemplateId,
  'COMEBACK_SURGE' | 'MOMENTUM_ENGINE'
>;

export type NegativeCascadeTemplateId = Exclude<
  CascadeTemplateId,
  PositiveCascadeTemplateId
>;

export const POSITIVE_CASCADE_TEMPLATE_IDS: readonly PositiveCascadeTemplateId[] =
  Object.freeze(['COMEBACK_SURGE', 'MOMENTUM_ENGINE'] as const);

export const NEGATIVE_CASCADE_TEMPLATE_IDS: readonly NegativeCascadeTemplateId[] =
  Object.freeze([
    'LIQUIDITY_SPIRAL',
    'CREDIT_FREEZE',
    'INCOME_SHOCK',
    'NETWORK_LOCKDOWN',
  ] as const);

export type CascadePolarity = 'POSITIVE' | 'NEGATIVE';

export const CASCADE_TEMPLATE_POLARITY_BY_ID: Readonly<Record<CascadeTemplateId, CascadePolarity>> =
  Object.freeze({
    LIQUIDITY_SPIRAL: 'NEGATIVE',
    CREDIT_FREEZE: 'NEGATIVE',
    INCOME_SHOCK: 'NEGATIVE',
    NETWORK_LOCKDOWN: 'NEGATIVE',
    COMEBACK_SURGE: 'POSITIVE',
    MOMENTUM_ENGINE: 'POSITIVE',
  });

// -----------------------------------------------------------------------------
// Severity
// -----------------------------------------------------------------------------

export type CascadeSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const CASCADE_SEVERITIES: readonly CascadeSeverity[] = Object.freeze([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const);

export const CASCADE_SEVERITY_RANK: Readonly<Record<CascadeSeverity, number>> =
  Object.freeze({
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
  });

export const CASCADE_SEVERITY_DEFAULT_SCALAR: Readonly<Record<CascadeSeverity, number>> =
  Object.freeze({
    LOW: 1.0,
    MEDIUM: 1.12,
    HIGH: 1.28,
    CRITICAL: 1.5,
  });

export const CASCADE_SEVERITY_DEFAULT_MIN_SPACING_TICKS: Readonly<
  Record<CascadeSeverity, number>
> = Object.freeze({
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
});

export const CASCADE_SEVERITY_DEFAULT_MAX_SCALAR: Readonly<Record<CascadeSeverity, number>> =
  Object.freeze({
    LOW: 1.2,
    MEDIUM: 1.35,
    HIGH: 1.55,
    CRITICAL: 1.75,
  });

// -----------------------------------------------------------------------------
// Shared String Tokens
// -----------------------------------------------------------------------------

export type CascadeSupportedPhase = 'FOUNDATION' | 'ESCALATION' | 'SOVEREIGNTY';

export const CASCADE_SUPPORTED_PHASES: readonly CascadeSupportedPhase[] = Object.freeze([
  'FOUNDATION',
  'ESCALATION',
  'SOVEREIGNTY',
] as const);

export type CascadeTriggerFamily =
  | 'SHIELD_BREACH'
  | 'PRESSURE_ESCALATION'
  | 'HEAT_SPIKE'
  | 'CARD_PLAY'
  | 'MODE_EVENT'
  | 'RECOVERY'
  | 'LEGEND'
  | 'SYSTEM'
  | 'MANUAL'
  | 'UNKNOWN';

export const CASCADE_TRIGGER_FAMILIES: readonly CascadeTriggerFamily[] = Object.freeze([
  'SHIELD_BREACH',
  'PRESSURE_ESCALATION',
  'HEAT_SPIKE',
  'CARD_PLAY',
  'MODE_EVENT',
  'RECOVERY',
  'LEGEND',
  'SYSTEM',
  'MANUAL',
  'UNKNOWN',
] as const);

export type CascadeTriggerFacet =
  | 'L1'
  | 'L2'
  | 'L3'
  | 'L4'
  | 'BOT'
  | 'OPPONENT'
  | 'TEAM'
  | 'SYSTEM'
  | 'HEAT'
  | 'CASH'
  | 'INCOME'
  | 'TRUST'
  | 'PHASE'
  | 'NONE'
  | 'UNKNOWN';

export const CASCADE_TRIGGER_FACETS: readonly CascadeTriggerFacet[] = Object.freeze([
  'L1',
  'L2',
  'L3',
  'L4',
  'BOT',
  'OPPONENT',
  'TEAM',
  'SYSTEM',
  'HEAT',
  'CASH',
  'INCOME',
  'TRUST',
  'PHASE',
  'NONE',
  'UNKNOWN',
] as const);

export type CascadeTelemetryTag =
  | 'NEGATIVE'
  | 'POSITIVE'
  | 'RECOVERY'
  | 'BREACH_LINKED'
  | 'MODE_GATED'
  | 'PRESSURE_SCALED'
  | 'HEAT_SENSITIVE'
  | 'TRUST_SENSITIVE'
  | 'GHOST_CONTEXT'
  | 'ONE_SHOT'
  | 'DENSE';

export const CASCADE_TELEMETRY_TAGS: readonly CascadeTelemetryTag[] = Object.freeze([
  'NEGATIVE',
  'POSITIVE',
  'RECOVERY',
  'BREACH_LINKED',
  'MODE_GATED',
  'PRESSURE_SCALED',
  'HEAT_SENSITIVE',
  'TRUST_SENSITIVE',
  'GHOST_CONTEXT',
  'ONE_SHOT',
  'DENSE',
] as const);

// -----------------------------------------------------------------------------
// Recovery Conditions — Canonical Authored Union
// -----------------------------------------------------------------------------

export type RecoveryCondition =
  | { readonly kind: 'CARD_TAG_ANY'; readonly tags: readonly string[] }
  | { readonly kind: 'LAST_PLAYED_TAG_ANY'; readonly tags: readonly string[] }
  | { readonly kind: 'CASH_MIN'; readonly amount: number }
  | { readonly kind: 'WEAKEST_SHIELD_RATIO_MIN'; readonly ratio: number }
  | { readonly kind: 'ALL_SHIELDS_RATIO_MIN'; readonly ratio: number }
  | { readonly kind: 'TRUST_ANY_MIN'; readonly score: number }
  | { readonly kind: 'HEAT_MAX'; readonly amount: number }
  | { readonly kind: 'PRESSURE_NOT_ABOVE'; readonly tier: PressureTier };

export type RecoveryConditionKind = RecoveryCondition['kind'];

export const RECOVERY_CONDITION_KINDS: readonly RecoveryConditionKind[] = Object.freeze([
  'CARD_TAG_ANY',
  'LAST_PLAYED_TAG_ANY',
  'CASH_MIN',
  'WEAKEST_SHIELD_RATIO_MIN',
  'ALL_SHIELDS_RATIO_MIN',
  'TRUST_ANY_MIN',
  'HEAT_MAX',
  'PRESSURE_NOT_ABOVE',
] as const);

export type RecoveryConditionComparator =
  | 'ANY_IN_SET'
  | 'NUMERIC_AT_LEAST'
  | 'NUMERIC_AT_MOST'
  | 'TIER_AT_MOST';

export const RECOVERY_CONDITION_COMPARATOR_BY_KIND: Readonly<
  Record<RecoveryConditionKind, RecoveryConditionComparator>
> = Object.freeze({
  CARD_TAG_ANY: 'ANY_IN_SET',
  LAST_PLAYED_TAG_ANY: 'ANY_IN_SET',
  CASH_MIN: 'NUMERIC_AT_LEAST',
  WEAKEST_SHIELD_RATIO_MIN: 'NUMERIC_AT_LEAST',
  ALL_SHIELDS_RATIO_MIN: 'NUMERIC_AT_LEAST',
  TRUST_ANY_MIN: 'NUMERIC_AT_LEAST',
  HEAT_MAX: 'NUMERIC_AT_MOST',
  PRESSURE_NOT_ABOVE: 'TIER_AT_MOST',
});

export type RecoveryConditionStatus =
  | 'MATCHED'
  | 'UNMATCHED'
  | 'NOT_APPLICABLE'
  | 'EMPTY_INPUT'
  | 'INVALID';

export const RECOVERY_CONDITION_STATUSES: readonly RecoveryConditionStatus[] =
  Object.freeze([
    'MATCHED',
    'UNMATCHED',
    'NOT_APPLICABLE',
    'EMPTY_INPUT',
    'INVALID',
  ] as const);

export interface RecoveryConditionDescriptorBase {
  readonly kind: RecoveryConditionKind;
  readonly comparator: RecoveryConditionComparator;
  readonly summary: string;
}

export interface RecoveryCardTagAnyDescriptor extends RecoveryConditionDescriptorBase {
  readonly kind: 'CARD_TAG_ANY';
  readonly comparator: 'ANY_IN_SET';
  readonly requiresTags: readonly string[];
}

export interface RecoveryLastPlayedTagAnyDescriptor
  extends RecoveryConditionDescriptorBase {
  readonly kind: 'LAST_PLAYED_TAG_ANY';
  readonly comparator: 'ANY_IN_SET';
  readonly requiresTags: readonly string[];
}

export interface RecoveryCashMinDescriptor extends RecoveryConditionDescriptorBase {
  readonly kind: 'CASH_MIN';
  readonly comparator: 'NUMERIC_AT_LEAST';
  readonly requiredAmount: number;
}

export interface RecoveryWeakestShieldRatioMinDescriptor
  extends RecoveryConditionDescriptorBase {
  readonly kind: 'WEAKEST_SHIELD_RATIO_MIN';
  readonly comparator: 'NUMERIC_AT_LEAST';
  readonly requiredRatio: number;
}

export interface RecoveryAllShieldsRatioMinDescriptor
  extends RecoveryConditionDescriptorBase {
  readonly kind: 'ALL_SHIELDS_RATIO_MIN';
  readonly comparator: 'NUMERIC_AT_LEAST';
  readonly requiredRatio: number;
}

export interface RecoveryTrustAnyMinDescriptor extends RecoveryConditionDescriptorBase {
  readonly kind: 'TRUST_ANY_MIN';
  readonly comparator: 'NUMERIC_AT_LEAST';
  readonly requiredScore: number;
}

export interface RecoveryHeatMaxDescriptor extends RecoveryConditionDescriptorBase {
  readonly kind: 'HEAT_MAX';
  readonly comparator: 'NUMERIC_AT_MOST';
  readonly maxHeat: number;
}

export interface RecoveryPressureNotAboveDescriptor
  extends RecoveryConditionDescriptorBase {
  readonly kind: 'PRESSURE_NOT_ABOVE';
  readonly comparator: 'TIER_AT_MOST';
  readonly maxTier: PressureTier;
}

export type RecoveryConditionDescriptor =
  | RecoveryCardTagAnyDescriptor
  | RecoveryLastPlayedTagAnyDescriptor
  | RecoveryCashMinDescriptor
  | RecoveryWeakestShieldRatioMinDescriptor
  | RecoveryAllShieldsRatioMinDescriptor
  | RecoveryTrustAnyMinDescriptor
  | RecoveryHeatMaxDescriptor
  | RecoveryPressureNotAboveDescriptor;

export interface RecoveryConditionEvaluation {
  readonly condition: RecoveryCondition;
  readonly status: RecoveryConditionStatus;
  readonly matched: boolean;
  readonly summary: string;
  readonly currentValue: string | number | boolean | null;
  readonly requiredValue: string | number | boolean | null;
  readonly evidence: readonly string[];
  readonly normalizedEvidence: readonly string[];
  readonly scoreContribution: number;
}

export interface RecoveryConditionEvaluationBundle {
  readonly allMatched: boolean;
  readonly anyMatched: boolean;
  readonly matchedCount: number;
  readonly totalCount: number;
  readonly evaluations: readonly RecoveryConditionEvaluation[];
}

export interface LegacyRecoveryMatchResult {
  readonly matched: boolean;
  readonly matchedTags: readonly string[];
  readonly normalizedBag: readonly string[];
  readonly normalizedRequested: readonly string[];
  readonly sources: readonly string[];
}

export interface RecoveryDecisionExplanation {
  readonly recovered: boolean;
  readonly structuredRecoveryAttempted: boolean;
  readonly structuredRecoverySatisfied: boolean;
  readonly legacyRecoveryAttempted: boolean;
  readonly legacyRecoverySatisfied: boolean;
  readonly structured: RecoveryConditionEvaluationBundle;
  readonly legacy: LegacyRecoveryMatchResult;
  readonly notes: readonly string[];
}

// -----------------------------------------------------------------------------
// Template Authoring Contract
// -----------------------------------------------------------------------------

export interface CascadeTemplate {
  readonly templateId: CascadeTemplateId;
  readonly label: string;
  readonly positive: boolean;
  readonly severity: CascadeSeverity;

  /**
   * Used to dedupe semantically identical triggers across repeated event bursts.
   */
  readonly dedupeKey: string;

  /**
   * Max simultaneously-active instances of this template.
   */
  readonly maxConcurrent: number;

  /**
   * Max times this template may be started from the same trigger family in a run.
   */
  readonly maxTriggersPerRun: number;

  /**
   * Relative schedule offsets from the activation tick.
   * Must match the length/order of `effects`.
   */
  readonly baseOffsets: readonly number[];

  /**
   * Per-link effects, already aligned to `baseOffsets`.
   */
  readonly effects: readonly EffectPayload[];

  /**
   * Legacy compatibility surface retained because chain instances in
   * GamePrimitives currently store `recoveryTags`.
   */
  readonly recoveryTags: readonly string[];

  /**
   * Structured authoritative recovery logic.
   */
  readonly recovery: readonly RecoveryCondition[];

  /**
   * Positive values accelerate the chain in a mode.
   */
  readonly modeOffsetModifier?: Partial<Record<ModeCode, number>>;

  /**
   * Scales numeric effects by pressure tier.
   */
  readonly pressureScalar?: Partial<Record<PressureTier, number>>;

  readonly notes?: readonly string[];

  // ---------------------------------------------------------------------------
  // Additive authored fields below are OPTIONAL and preserve existing manifests.
  // ---------------------------------------------------------------------------

  /**
   * Human-readable short label for creator tools or diagnostics.
   */
  readonly shortLabel?: string;

  /**
   * Optional polarity declaration used by validators to cross-check `positive`.
   */
  readonly authoredPolarity?: CascadePolarity;

  /**
   * Optional supported trigger families to document how the template may start.
   */
  readonly triggerFamilies?: readonly CascadeTriggerFamily[];

  /**
   * Optional supported trigger facets for richer queue routing diagnostics.
   */
  readonly triggerFacets?: readonly CascadeTriggerFacet[];

  /**
   * Optional semantic group for mutual exclusion or UI grouping.
   */
  readonly exclusivityGroup?: string | null;

  /**
   * Optional author hint for how much spacing should exist between reactivations.
   */
  readonly minTickSpacing?: number;

  /**
   * Optional phase scalar overrides.
   */
  readonly phaseScalar?: Partial<Record<CascadeSupportedPhase, number>>;

  /**
   * Optional severity scalar override, useful when a nominal severity should hit
   * slightly softer or harder than the domain default.
   */
  readonly severityScalarOverride?: number;

  /**
   * Optional cap on the final scalar after all multipliers resolve.
   */
  readonly maxCombinedScalar?: number;

  /**
   * Optional floor on the final scalar after all multipliers resolve.
   */
  readonly minCombinedScalar?: number;

  /**
   * Optional additive throttle when the queue is congested.
   */
  readonly congestionBrakeTicks?: number;

  /**
   * Optional additive acceleration when pressure is above a threshold.
   */
  readonly criticalPressureAccelerationTicks?: number;

  /**
   * Optional one-shot marker. Particularly useful for positive cascades.
   */
  readonly oneShot?: boolean;

  /**
   * Optional signal that the template expects to appear in replay, audit, or
   * proof-facing outputs.
   */
  readonly proofBearing?: boolean;

  /**
   * Optional tag bundle for telemetry grouping.
   */
  readonly telemetryTags?: readonly CascadeTelemetryTag[];

  /**
   * Optional author explanation preserved for tools, audits, or future docs.
   */
  readonly explanation?: string;

  /**
   * Optional rationale for recovery design.
   */
  readonly recoveryRationale?: string;

  /**
   * Optional rationale for why the template is positive or negative.
   */
  readonly polarityRationale?: string;
}

export type CascadeTemplateManifest = Readonly<Record<CascadeTemplateId, CascadeTemplate>>;

export interface CascadeTemplateManifestEntry {
  readonly template: CascadeTemplate;
  readonly polarity: CascadePolarity;
  readonly severityRank: number;
  readonly recoveryConditionKinds: readonly RecoveryConditionKind[];
  readonly inferredRecoveryTags: readonly string[];
}

export type CascadeTemplateManifestIndex = Readonly<
  Record<CascadeTemplateId, CascadeTemplateManifestEntry>
>;

export interface CascadeTemplateManifestSummary {
  readonly totalTemplates: number;
  readonly positiveTemplates: number;
  readonly negativeTemplates: number;
  readonly severityCounts: Readonly<Record<CascadeSeverity, number>>;
  readonly templateIds: readonly CascadeTemplateId[];
}

// -----------------------------------------------------------------------------
// Queue Planning Types
// -----------------------------------------------------------------------------

export type NumericEffectField =
  | 'cashDelta'
  | 'debtDelta'
  | 'incomeDelta'
  | 'expenseDelta'
  | 'shieldDelta'
  | 'heatDelta'
  | 'trustDelta'
  | 'treasuryDelta'
  | 'battleBudgetDelta'
  | 'holdChargeDelta'
  | 'counterIntelDelta'
  | 'timeDeltaMs'
  | 'divergenceDelta';

export const NUMERIC_EFFECT_FIELDS: readonly NumericEffectField[] = Object.freeze([
  'cashDelta',
  'debtDelta',
  'incomeDelta',
  'expenseDelta',
  'shieldDelta',
  'heatDelta',
  'trustDelta',
  'treasuryDelta',
  'battleBudgetDelta',
  'holdChargeDelta',
  'counterIntelDelta',
  'timeDeltaMs',
  'divergenceDelta',
] as const);

export type MutableEffectPayload = {
  -readonly [K in keyof EffectPayload]: EffectPayload[K];
};

export interface QueuePolicyContextShape {
  readonly snapshotSeed: string;
  readonly snapshotTick: number;
  readonly mode: ModeCode;
  readonly pressureTier: PressureTier;
  readonly templateId: CascadeTemplateId;
  readonly normalizedTrigger: string;
  readonly triggerFamily: string;
  readonly triggerFacet: string | null;
  readonly instanceOrdinal: number;
  readonly activeOfTemplate: number;
  readonly pendingOfTemplate: number;
  readonly triggerCount: number;
}

export interface CreationScalarBundle {
  readonly pressureScalar: number;
  readonly repeatScalar: number;
  readonly severityScalar: number;
  readonly phaseScalar: number;
  readonly modeScalar: number;
  readonly heatScalar: number;
  readonly tensionScalar: number;
  readonly shieldScalar: number;
  readonly economyScalar: number;
  readonly telemetryScalar: number;
  readonly triggerScalar: number;
  readonly positiveNegativeScalar: number;
  readonly chainDensityScalar: number;
  readonly combinedScalar: number;
}

export interface TimingAccelerationBundle {
  readonly templateModeAcceleration: number;
  readonly bleedAcceleration: number;
  readonly ghostAcceleration: number;
  readonly pressureAcceleration: number;
  readonly phaseAcceleration: number;
  readonly heatAcceleration: number;
  readonly eventCongestionAcceleration: number;
  readonly positiveBrake: number;
  readonly totalAcceleration: number;
}

export interface ScheduledLinkPlan {
  readonly linkIndex: number;
  readonly linkId: string;
  readonly baseOffset: number;
  readonly acceleratedOffset: number;
  readonly normalizedOffset: number;
  readonly scheduledTick: number;
  readonly summary: string;
  readonly effect: EffectPayload;
}

export interface CreationDiagnostics {
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly telemetryTags: readonly string[];
  readonly scalarBundle: CreationScalarBundle;
  readonly accelerationBundle: TimingAccelerationBundle;
  readonly plannedLinks: readonly ScheduledLinkPlan[];
}

export type QueueDecision = 'ALLOW' | 'DENY';

export interface QueueDecisionResult {
  readonly decision: QueueDecision;
  readonly allowed: boolean;
  readonly reasonCode:
    | 'OK'
    | 'MAX_CONCURRENT'
    | 'MAX_TRIGGER_LIMIT'
    | 'DUPLICATE_SEMANTIC_TRIGGER'
    | 'POSITIVE_ALREADY_UNLOCKED'
    | 'PHASE_GATED'
    | 'MODE_GATED'
    | 'MANIFEST_INVALID'
    | 'UNKNOWN';
  readonly reasons: readonly string[];
}

export interface QueueLinkEffectBreakdown {
  readonly linkIndex: number;
  readonly fieldImpacts: Readonly<Record<NumericEffectField, number | undefined>>;
  readonly cascadeTag: string | null;
  readonly injectCards: readonly string[];
  readonly exhaustCards: readonly string[];
  readonly grantBadges: readonly string[];
  readonly namedActionId: string | null;
}

// -----------------------------------------------------------------------------
// Positive Cascade Inference Types
// -----------------------------------------------------------------------------

export interface PositiveCascadeNumericBand {
  readonly min: number;
  readonly max: number;
}

export interface MomentumThresholdProfile {
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

export interface ComebackThresholdProfile {
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

export interface PositiveCascadeMetrics {
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
}

export type PositiveCascadeEvaluationState =
  | 'ELIGIBLE'
  | 'INELIGIBLE'
  | 'ALREADY_ACTIVE'
  | 'ALREADY_UNLOCKED'
  | 'NOT_APPLICABLE';

export const POSITIVE_CASCADE_EVALUATION_STATES: readonly PositiveCascadeEvaluationState[] =
  Object.freeze([
    'ELIGIBLE',
    'INELIGIBLE',
    'ALREADY_ACTIVE',
    'ALREADY_UNLOCKED',
    'NOT_APPLICABLE',
  ] as const);

export interface TemplateEvaluation {
  readonly templateId: PositiveCascadeTemplateId;
  readonly state: PositiveCascadeEvaluationState;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly metrics: PositiveCascadeMetrics;
}

export interface PositiveCascadeInferenceExplanation {
  readonly inferredTemplateIds: readonly PositiveCascadeTemplateId[];
  readonly evaluations: readonly TemplateEvaluation[];
  readonly notes: readonly string[];
}

// -----------------------------------------------------------------------------
// Validation Types
// -----------------------------------------------------------------------------

export type CascadeTemplateValidationIssueCode =
  | 'UNKNOWN_TEMPLATE_ID'
  | 'POLARITY_MISMATCH'
  | 'EMPTY_LABEL'
  | 'EMPTY_DEDUPE_KEY'
  | 'NON_POSITIVE_MAX_CONCURRENT'
  | 'NON_POSITIVE_MAX_TRIGGERS_PER_RUN'
  | 'OFFSET_EFFECT_LENGTH_MISMATCH'
  | 'EMPTY_LINK_SET'
  | 'NEGATIVE_OFFSET'
  | 'UNSORTED_OFFSETS'
  | 'EMPTY_RECOVERY_TAG'
  | 'INVALID_RECOVERY_CONDITION'
  | 'INVALID_MODE_OFFSET_MODIFIER'
  | 'INVALID_PRESSURE_SCALAR'
  | 'INVALID_PHASE_SCALAR'
  | 'INVALID_COMBINED_SCALAR_RANGE'
  | 'INVALID_MIN_TICK_SPACING'
  | 'DUPLICATE_TEMPLATE_ID'
  | 'EXCLUSIVITY_GROUP_EMPTY'
  | 'DUPLICATE_RECOVERY_TAG'
  | 'UNKNOWN';

export const CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES: readonly CascadeTemplateValidationIssueCode[] =
  Object.freeze([
    'UNKNOWN_TEMPLATE_ID',
    'POLARITY_MISMATCH',
    'EMPTY_LABEL',
    'EMPTY_DEDUPE_KEY',
    'NON_POSITIVE_MAX_CONCURRENT',
    'NON_POSITIVE_MAX_TRIGGERS_PER_RUN',
    'OFFSET_EFFECT_LENGTH_MISMATCH',
    'EMPTY_LINK_SET',
    'NEGATIVE_OFFSET',
    'UNSORTED_OFFSETS',
    'EMPTY_RECOVERY_TAG',
    'INVALID_RECOVERY_CONDITION',
    'INVALID_MODE_OFFSET_MODIFIER',
    'INVALID_PRESSURE_SCALAR',
    'INVALID_PHASE_SCALAR',
    'INVALID_COMBINED_SCALAR_RANGE',
    'INVALID_MIN_TICK_SPACING',
    'DUPLICATE_TEMPLATE_ID',
    'EXCLUSIVITY_GROUP_EMPTY',
    'DUPLICATE_RECOVERY_TAG',
    'UNKNOWN',
  ] as const);

export type CascadeTemplateValidationSeverity = 'ERROR' | 'WARNING';

export interface CascadeTemplateValidationIssue {
  readonly code: CascadeTemplateValidationIssueCode;
  readonly severity: CascadeTemplateValidationSeverity;
  readonly message: string;
  readonly templateId: CascadeTemplateId | string;
  readonly field: string | null;
  readonly notes: readonly string[];
}

export interface CascadeTemplateValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CascadeTemplateValidationIssue[];
  readonly errors: readonly CascadeTemplateValidationIssue[];
  readonly warnings: readonly CascadeTemplateValidationIssue[];
}

export interface CascadeManifestValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CascadeTemplateValidationIssue[];
  readonly byTemplateId: Readonly<Record<string, readonly CascadeTemplateValidationIssue[]>>;
  readonly summary: CascadeTemplateManifestSummary;
}

// -----------------------------------------------------------------------------
// Domain Events
// -----------------------------------------------------------------------------

export type CascadeDomainEventName =
  | 'cascade.chain.created'
  | 'cascade.chain.progressed'
  | 'cascade.chain.broken'
  | 'cascade.chain.completed'
  | 'cascade.chain.denied'
  | 'cascade.positive.inferred'
  | 'cascade.recovery.evaluated'
  | 'cascade.template.validated';

export interface CascadeDomainEventMap {
  'cascade.chain.created': {
    readonly chainId: string;
    readonly templateId: CascadeTemplateId;
    readonly positive: boolean;
    readonly severity: CascadeSeverity;
    readonly trigger: string;
    readonly tick: number;
  };
  'cascade.chain.progressed': {
    readonly chainId: string;
    readonly templateId: CascadeTemplateId;
    readonly linkId: string;
    readonly linkIndex: number;
    readonly tick: number;
  };
  'cascade.chain.broken': {
    readonly chainId: string;
    readonly templateId: CascadeTemplateId;
    readonly recovered: boolean;
    readonly tick: number;
    readonly notes: readonly string[];
  };
  'cascade.chain.completed': {
    readonly chainId: string;
    readonly templateId: CascadeTemplateId;
    readonly positive: boolean;
    readonly tick: number;
  };
  'cascade.chain.denied': {
    readonly templateId: CascadeTemplateId;
    readonly reasonCode: QueueDecisionResult['reasonCode'];
    readonly reasons: readonly string[];
    readonly tick: number;
  };
  'cascade.positive.inferred': {
    readonly templateIds: readonly PositiveCascadeTemplateId[];
    readonly tick: number;
    readonly notes: readonly string[];
  };
  'cascade.recovery.evaluated': {
    readonly chainId: string;
    readonly templateId: CascadeTemplateId;
    readonly recovered: boolean;
    readonly structuredMatched: boolean;
    readonly legacyMatched: boolean;
  };
  'cascade.template.validated': {
    readonly templateId: string;
    readonly valid: boolean;
    readonly issueCount: number;
  };
}

export interface CascadeDomainEvent<
  T extends CascadeDomainEventName = CascadeDomainEventName,
> {
  readonly type: T;
  readonly payload: T extends keyof CascadeDomainEventMap
    ? CascadeDomainEventMap[T]
    : never;
}

// -----------------------------------------------------------------------------
// Authoring / Factory Helpers
// -----------------------------------------------------------------------------

export interface CascadeTemplateFactoryOptions {
  readonly validate?: boolean;
  readonly freeze?: boolean;
}

export interface CascadeTemplateFactoryResult<T extends CascadeTemplate = CascadeTemplate> {
  readonly template: T;
  readonly validation: CascadeTemplateValidationResult;
}

// -----------------------------------------------------------------------------
// Runtime Helper Functions
// -----------------------------------------------------------------------------

export function isCascadeTemplateId(value: string): value is CascadeTemplateId {
  return (CASCADE_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function isPositiveCascadeTemplateId(
  value: string,
): value is PositiveCascadeTemplateId {
  return (POSITIVE_CASCADE_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function isNegativeCascadeTemplateId(
  value: string,
): value is NegativeCascadeTemplateId {
  return (NEGATIVE_CASCADE_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function getCascadeTemplatePolarity(
  templateId: CascadeTemplateId,
): CascadePolarity {
  return CASCADE_TEMPLATE_POLARITY_BY_ID[templateId];
}

export function isCascadeSeverity(value: string): value is CascadeSeverity {
  return (CASCADE_SEVERITIES as readonly string[]).includes(value);
}

export function getCascadeSeverityRank(severity: CascadeSeverity): number {
  return CASCADE_SEVERITY_RANK[severity];
}

export function compareCascadeSeverity(
  left: CascadeSeverity,
  right: CascadeSeverity,
): number {
  return getCascadeSeverityRank(left) - getCascadeSeverityRank(right);
}

export function isRecoveryConditionKind(
  value: string,
): value is RecoveryConditionKind {
  return (RECOVERY_CONDITION_KINDS as readonly string[]).includes(value);
}

export function isCardTagAnyRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'CARD_TAG_ANY' }> {
  return condition.kind === 'CARD_TAG_ANY';
}

export function isLastPlayedTagAnyRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'LAST_PLAYED_TAG_ANY' }> {
  return condition.kind === 'LAST_PLAYED_TAG_ANY';
}

export function isCashMinRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'CASH_MIN' }> {
  return condition.kind === 'CASH_MIN';
}

export function isWeakestShieldRatioMinRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'WEAKEST_SHIELD_RATIO_MIN' }> {
  return condition.kind === 'WEAKEST_SHIELD_RATIO_MIN';
}

export function isAllShieldsRatioMinRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'ALL_SHIELDS_RATIO_MIN' }> {
  return condition.kind === 'ALL_SHIELDS_RATIO_MIN';
}

export function isTrustAnyMinRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'TRUST_ANY_MIN' }> {
  return condition.kind === 'TRUST_ANY_MIN';
}

export function isHeatMaxRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'HEAT_MAX' }> {
  return condition.kind === 'HEAT_MAX';
}

export function isPressureNotAboveRecoveryCondition(
  condition: RecoveryCondition,
): condition is Extract<RecoveryCondition, { readonly kind: 'PRESSURE_NOT_ABOVE' }> {
  return condition.kind === 'PRESSURE_NOT_ABOVE';
}

export function normalizeCascadeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function normalizeCascadeTokenBag(values: readonly string[]): readonly string[] {
  const deduped = new Set<string>();

  for (const value of values) {
    const normalized = normalizeCascadeToken(value);
    if (normalized.length > 0) {
      deduped.add(normalized);
    }
  }

  return Object.freeze([...deduped]);
}

export function createRecoveryConditionDescriptor(
  condition: RecoveryCondition,
): RecoveryConditionDescriptor {
  switch (condition.kind) {
    case 'CARD_TAG_ANY':
      return {
        kind: 'CARD_TAG_ANY',
        comparator: 'ANY_IN_SET',
        summary: `Any card tag matches: ${condition.tags.join(', ')}`,
        requiresTags: [...condition.tags],
      };
    case 'LAST_PLAYED_TAG_ANY':
      return {
        kind: 'LAST_PLAYED_TAG_ANY',
        comparator: 'ANY_IN_SET',
        summary: `Any last-played tag matches: ${condition.tags.join(', ')}`,
        requiresTags: [...condition.tags],
      };
    case 'CASH_MIN':
      return {
        kind: 'CASH_MIN',
        comparator: 'NUMERIC_AT_LEAST',
        summary: `Cash must be at least ${condition.amount}`,
        requiredAmount: condition.amount,
      };
    case 'WEAKEST_SHIELD_RATIO_MIN':
      return {
        kind: 'WEAKEST_SHIELD_RATIO_MIN',
        comparator: 'NUMERIC_AT_LEAST',
        summary: `Weakest shield ratio must be at least ${condition.ratio}`,
        requiredRatio: condition.ratio,
      };
    case 'ALL_SHIELDS_RATIO_MIN':
      return {
        kind: 'ALL_SHIELDS_RATIO_MIN',
        comparator: 'NUMERIC_AT_LEAST',
        summary: `All shields ratio must be at least ${condition.ratio}`,
        requiredRatio: condition.ratio,
      };
    case 'TRUST_ANY_MIN':
      return {
        kind: 'TRUST_ANY_MIN',
        comparator: 'NUMERIC_AT_LEAST',
        summary: `Any trust score must be at least ${condition.score}`,
        requiredScore: condition.score,
      };
    case 'HEAT_MAX':
      return {
        kind: 'HEAT_MAX',
        comparator: 'NUMERIC_AT_MOST',
        summary: `Heat must not exceed ${condition.amount}`,
        maxHeat: condition.amount,
      };
    case 'PRESSURE_NOT_ABOVE':
      return {
        kind: 'PRESSURE_NOT_ABOVE',
        comparator: 'TIER_AT_MOST',
        summary: `Pressure tier must not exceed ${condition.tier}`,
        maxTier: condition.tier,
      };
    default: {
      const exhaustiveCheck: never = condition;
      return exhaustiveCheck;
    }
  }
}

export function describeRecoveryCondition(condition: RecoveryCondition): string {
  return createRecoveryConditionDescriptor(condition).summary;
}

export function collectRecoveryConditionKinds(
  conditions: readonly RecoveryCondition[],
): readonly RecoveryConditionKind[] {
  const kinds = new Set<RecoveryConditionKind>();

  for (const condition of conditions) {
    kinds.add(condition.kind);
  }

  return Object.freeze([...kinds]);
}

export function deriveRecoveryTagsFromConditions(
  conditions: readonly RecoveryCondition[],
): readonly string[] {
  const tags: string[] = [];

  for (const condition of conditions) {
    switch (condition.kind) {
      case 'CARD_TAG_ANY':
      case 'LAST_PLAYED_TAG_ANY': {
        tags.push(...condition.tags);
        break;
      }
      default:
        break;
    }
  }

  return normalizeCascadeTokenBag(tags);
}

export function hasStructuredRecovery(
  template: Pick<CascadeTemplate, 'recovery'>,
): boolean {
  return template.recovery.length > 0;
}

export function usesLegacyRecoveryTags(
  template: Pick<CascadeTemplate, 'recoveryTags'>,
): boolean {
  return template.recoveryTags.length > 0;
}

export function resolveTemplateRecoveryTagSurface(
  template: Pick<CascadeTemplate, 'recovery' | 'recoveryTags'>,
): readonly string[] {
  return normalizeCascadeTokenBag([
    ...template.recoveryTags,
    ...deriveRecoveryTagsFromConditions(template.recovery),
  ]);
}

export function getPressureScalarForTemplate(
  template: Pick<CascadeTemplate, 'pressureScalar' | 'severity' | 'severityScalarOverride'>,
  tier: PressureTier,
): number {
  const authored = template.pressureScalar?.[tier];
  const severityDefault = template.severityScalarOverride ??
    CASCADE_SEVERITY_DEFAULT_SCALAR[template.severity];

  return authored ?? severityDefault;
}

export function getModeOffsetModifierForTemplate(
  template: Pick<CascadeTemplate, 'modeOffsetModifier'>,
  mode: ModeCode,
): number {
  return template.modeOffsetModifier?.[mode] ?? 0;
}

export function getPhaseScalarForTemplate(
  template: Pick<CascadeTemplate, 'phaseScalar'>,
  phase: CascadeSupportedPhase,
): number {
  return template.phaseScalar?.[phase] ?? 1;
}

export function isTemplateOneShot(
  template: Pick<CascadeTemplate, 'oneShot' | 'positive'>,
): boolean {
  return template.oneShot ?? template.positive;
}

export function computeTemplateLinkCount(
  template: Pick<CascadeTemplate, 'baseOffsets'>,
): number {
  return template.baseOffsets.length;
}

export function buildTemplateManifestSummary(
  templates: readonly CascadeTemplate[],
): CascadeTemplateManifestSummary {
  const severityCounts: Record<CascadeSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  let positiveTemplates = 0;
  let negativeTemplates = 0;

  for (const template of templates) {
    severityCounts[template.severity] += 1;
    if (template.positive) {
      positiveTemplates += 1;
    } else {
      negativeTemplates += 1;
    }
  }

  return {
    totalTemplates: templates.length,
    positiveTemplates,
    negativeTemplates,
    severityCounts,
    templateIds: Object.freeze(templates.map((template) => template.templateId)),
  };
}

export function buildCascadeTemplateManifestIndex(
  templates: readonly CascadeTemplate[],
): CascadeTemplateManifestIndex {
  const entries: Partial<Record<CascadeTemplateId, CascadeTemplateManifestEntry>> = {};

  for (const template of templates) {
    entries[template.templateId] = {
      template,
      polarity: template.positive ? 'POSITIVE' : 'NEGATIVE',
      severityRank: getCascadeSeverityRank(template.severity),
      recoveryConditionKinds: collectRecoveryConditionKinds(template.recovery),
      inferredRecoveryTags: resolveTemplateRecoveryTagSurface(template),
    };
  }

  return Object.freeze(entries as CascadeTemplateManifestIndex);
}

export function buildCascadeTemplateManifest(
  templates: readonly CascadeTemplate[],
): CascadeTemplateManifest {
  const manifest: Partial<Record<CascadeTemplateId, CascadeTemplate>> = {};

  for (const template of templates) {
    manifest[template.templateId] = template;
  }

  return Object.freeze(manifest as CascadeTemplateManifest);
}

export function defineCascadeTemplate<T extends CascadeTemplate>(template: T): T {
  return template;
}

export function defineCascadeTemplateManifest<const T extends readonly CascadeTemplate[]>(
  templates: T,
): T {
  return templates;
}

export function validateRecoveryCondition(
  condition: RecoveryCondition,
): readonly CascadeTemplateValidationIssue[] {
  const issues: CascadeTemplateValidationIssue[] = [];

  switch (condition.kind) {
    case 'CARD_TAG_ANY':
    case 'LAST_PLAYED_TAG_ANY': {
      if (condition.tags.length === 0) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: `${condition.kind} must include at least one tag.`,
          templateId: 'UNKNOWN',
          field: 'recovery',
          notes: Object.freeze(['Structured tag recovery cannot be empty.']),
        });
      }
      break;
    }
    case 'CASH_MIN':
      if (!Number.isFinite(condition.amount) || condition.amount < 0) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: 'CASH_MIN.amount must be a finite non-negative number.',
          templateId: 'UNKNOWN',
          field: 'recovery',
          notes: Object.freeze(['Cash recovery thresholds cannot be negative.']),
        });
      }
      break;
    case 'WEAKEST_SHIELD_RATIO_MIN':
    case 'ALL_SHIELDS_RATIO_MIN':
      if (!Number.isFinite(condition.ratio) || condition.ratio < 0 || condition.ratio > 1) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: `${condition.kind}.ratio must be within 0..1.`,
          templateId: 'UNKNOWN',
          field: 'recovery',
          notes: Object.freeze(['Shield ratios are normalized percentages.']),
        });
      }
      break;
    case 'TRUST_ANY_MIN':
      if (!Number.isFinite(condition.score) || condition.score < 0) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: 'TRUST_ANY_MIN.score must be a finite non-negative number.',
          templateId: 'UNKNOWN',
          field: 'recovery',
          notes: Object.freeze(['Trust floors cannot be negative.']),
        });
      }
      break;
    case 'HEAT_MAX':
      if (!Number.isFinite(condition.amount) || condition.amount < 0) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: 'HEAT_MAX.amount must be a finite non-negative number.',
          templateId: 'UNKNOWN',
          field: 'recovery',
          notes: Object.freeze(['Heat caps cannot be negative.']),
        });
      }
      break;
    case 'PRESSURE_NOT_ABOVE':
      if (!(condition.tier in { T0: true, T1: true, T2: true, T3: true, T4: true })) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: 'PRESSURE_NOT_ABOVE.tier must be one of T0..T4.',
          templateId: 'UNKNOWN',
          field: 'recovery',
          notes: Object.freeze(['Pressure tiers remain backend-owned cadence values.']),
        });
      }
      break;
    default: {
      const exhaustiveCheck: never = condition;
      return exhaustiveCheck;
    }
  }

  return Object.freeze(issues);
}

export function validateCascadeTemplateDefinition(
  template: CascadeTemplate,
): CascadeTemplateValidationResult {
  const issues: CascadeTemplateValidationIssue[] = [];

  if (!isCascadeTemplateId(template.templateId)) {
    issues.push({
      code: 'UNKNOWN_TEMPLATE_ID',
      severity: 'ERROR',
      message: `Unknown cascade template id: ${template.templateId}`,
      templateId: template.templateId,
      field: 'templateId',
      notes: Object.freeze(['Template IDs must remain in the canonical enum.']),
    });
  }

  if (template.label.trim().length === 0) {
    issues.push({
      code: 'EMPTY_LABEL',
      severity: 'ERROR',
      message: 'Cascade template label must not be empty.',
      templateId: template.templateId,
      field: 'label',
      notes: Object.freeze(['Labels are used in diagnostics and replay surfaces.']),
    });
  }

  if (template.dedupeKey.trim().length === 0) {
    issues.push({
      code: 'EMPTY_DEDUPE_KEY',
      severity: 'ERROR',
      message: 'Cascade template dedupeKey must not be empty.',
      templateId: template.templateId,
      field: 'dedupeKey',
      notes: Object.freeze(['Dedupe keys protect against repeated event bursts.']),
    });
  }

  if (!Number.isInteger(template.maxConcurrent) || template.maxConcurrent <= 0) {
    issues.push({
      code: 'NON_POSITIVE_MAX_CONCURRENT',
      severity: 'ERROR',
      message: 'maxConcurrent must be a positive integer.',
      templateId: template.templateId,
      field: 'maxConcurrent',
      notes: Object.freeze(['Queue policy requires a positive concurrency bound.']),
    });
  }

  if (
    !Number.isInteger(template.maxTriggersPerRun) ||
    template.maxTriggersPerRun <= 0
  ) {
    issues.push({
      code: 'NON_POSITIVE_MAX_TRIGGERS_PER_RUN',
      severity: 'ERROR',
      message: 'maxTriggersPerRun must be a positive integer.',
      templateId: template.templateId,
      field: 'maxTriggersPerRun',
      notes: Object.freeze(['Trigger families require explicit run caps.']),
    });
  }

  if (template.baseOffsets.length === 0 || template.effects.length === 0) {
    issues.push({
      code: 'EMPTY_LINK_SET',
      severity: 'ERROR',
      message: 'baseOffsets and effects must both contain at least one entry.',
      templateId: template.templateId,
      field: 'baseOffsets',
      notes: Object.freeze(['Chains with no links are not executable.']),
    });
  }

  if (template.baseOffsets.length !== template.effects.length) {
    issues.push({
      code: 'OFFSET_EFFECT_LENGTH_MISMATCH',
      severity: 'ERROR',
      message: 'baseOffsets and effects must have the same length.',
      templateId: template.templateId,
      field: 'effects',
      notes: Object.freeze(['Each scheduled offset must align to one effect payload.']),
    });
  }

  for (let index = 0; index < template.baseOffsets.length; index += 1) {
    const offset = template.baseOffsets[index];

    if (!Number.isFinite(offset) || offset < 0) {
      issues.push({
        code: 'NEGATIVE_OFFSET',
        severity: 'ERROR',
        message: `baseOffsets[${index}] must be a finite non-negative number.`,
        templateId: template.templateId,
        field: `baseOffsets[${index}]`,
        notes: Object.freeze(['Chain offsets are relative future ticks.']),
      });
    }

    if (index > 0 && offset < template.baseOffsets[index - 1]) {
      issues.push({
        code: 'UNSORTED_OFFSETS',
        severity: 'WARNING',
        message: `baseOffsets[${index}] is earlier than baseOffsets[${index - 1}].`,
        templateId: template.templateId,
        field: `baseOffsets[${index}]`,
        notes: Object.freeze(['Execution remains possible, but authored ordering is unusual.']),
      });
    }
  }

  for (const recoveryTag of template.recoveryTags) {
    if (normalizeCascadeToken(recoveryTag).length === 0) {
      issues.push({
        code: 'EMPTY_RECOVERY_TAG',
        severity: 'WARNING',
        message: 'recoveryTags contains an empty or non-normalizable entry.',
        templateId: template.templateId,
        field: 'recoveryTags',
        notes: Object.freeze(['Legacy recovery tags should remain normalized and useful.']),
      });
    }
  }

  const normalizedRecoveryTags = resolveTemplateRecoveryTagSurface(template);
  if (normalizedRecoveryTags.length < template.recoveryTags.length) {
    issues.push({
      code: 'DUPLICATE_RECOVERY_TAG',
      severity: 'WARNING',
      message: 'Recovery tag surface contains duplicates after normalization.',
      templateId: template.templateId,
      field: 'recoveryTags',
      notes: Object.freeze(['Duplicate tags are harmless but noisy.']),
    });
  }

  for (const recoveryCondition of template.recovery) {
    for (const issue of validateRecoveryCondition(recoveryCondition)) {
      issues.push({
        ...issue,
        templateId: template.templateId,
      });
    }
  }

  if (template.authoredPolarity && template.authoredPolarity !== (template.positive ? 'POSITIVE' : 'NEGATIVE')) {
    issues.push({
      code: 'POLARITY_MISMATCH',
      severity: 'WARNING',
      message: 'authoredPolarity does not match the canonical positive boolean.',
      templateId: template.templateId,
      field: 'authoredPolarity',
      notes: Object.freeze(['`positive` remains the runtime source of truth.']),
    });
  }

  if (template.minTickSpacing !== undefined) {
    if (!Number.isInteger(template.minTickSpacing) || template.minTickSpacing < 0) {
      issues.push({
        code: 'INVALID_MIN_TICK_SPACING',
        severity: 'ERROR',
        message: 'minTickSpacing must be a non-negative integer when provided.',
        templateId: template.templateId,
        field: 'minTickSpacing',
        notes: Object.freeze(['Tick spacing should be deterministic and integral.']),
      });
    }
  }

  if (template.exclusivityGroup !== undefined && template.exclusivityGroup !== null) {
    if (template.exclusivityGroup.trim().length === 0) {
      issues.push({
        code: 'EXCLUSIVITY_GROUP_EMPTY',
        severity: 'WARNING',
        message: 'exclusivityGroup should be omitted instead of empty.',
        templateId: template.templateId,
        field: 'exclusivityGroup',
        notes: Object.freeze(['Empty strings make grouping diagnostics ambiguous.']),
      });
    }
  }

  if (
    template.minCombinedScalar !== undefined &&
    template.maxCombinedScalar !== undefined &&
    template.minCombinedScalar > template.maxCombinedScalar
  ) {
    issues.push({
      code: 'INVALID_COMBINED_SCALAR_RANGE',
      severity: 'ERROR',
      message: 'minCombinedScalar cannot exceed maxCombinedScalar.',
      templateId: template.templateId,
      field: 'minCombinedScalar',
      notes: Object.freeze(['Combined scalar bounds must remain ordered.']),
    });
  }

  const errors = issues.filter((issue) => issue.severity === 'ERROR');
  const warnings = issues.filter((issue) => issue.severity === 'WARNING');

  return Object.freeze({
    valid: errors.length === 0,
    issues: Object.freeze(issues),
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
  });
}

export function validateCascadeTemplateManifest(
  templates: readonly CascadeTemplate[],
): CascadeManifestValidationResult {
  const issues: CascadeTemplateValidationIssue[] = [];
  const byTemplateId: Record<string, CascadeTemplateValidationIssue[]> = {};
  const seen = new Set<string>();

  for (const template of templates) {
    const templateIssues = validateCascadeTemplateDefinition(template).issues;
    byTemplateId[template.templateId] = [...templateIssues];

    if (seen.has(template.templateId)) {
      const duplicateIssue: CascadeTemplateValidationIssue = {
        code: 'DUPLICATE_TEMPLATE_ID',
        severity: 'ERROR',
        message: `Duplicate template id detected: ${template.templateId}`,
        templateId: template.templateId,
        field: 'templateId',
        notes: Object.freeze(['Manifest IDs must be unique.']),
      };
      byTemplateId[template.templateId].push(duplicateIssue);
      issues.push(duplicateIssue);
    }

    seen.add(template.templateId);
    issues.push(...templateIssues);
  }

  const summary = buildTemplateManifestSummary(templates);
  const valid = !issues.some((issue) => issue.severity === 'ERROR');

  return Object.freeze({
    valid,
    issues: Object.freeze(issues),
    byTemplateId: Object.freeze(
      Object.fromEntries(
        Object.entries(byTemplateId).map(([key, value]) => [key, Object.freeze(value)]),
      ),
    ),
    summary,
  });
}

export function createCascadeTemplateFactoryResult<T extends CascadeTemplate>(
  template: T,
): CascadeTemplateFactoryResult<T> {
  return Object.freeze({
    template,
    validation: validateCascadeTemplateDefinition(template),
  });
}

// -----------------------------------------------------------------------------
// Recovery Evaluation Constructors
// -----------------------------------------------------------------------------

export function createMatchedRecoveryConditionEvaluation(
  condition: RecoveryCondition,
  currentValue: string | number | boolean | null,
  requiredValue: string | number | boolean | null,
  evidence: readonly string[] = [],
): RecoveryConditionEvaluation {
  return Object.freeze({
    condition,
    status: 'MATCHED',
    matched: true,
    summary: describeRecoveryCondition(condition),
    currentValue,
    requiredValue,
    evidence: Object.freeze([...evidence]),
    normalizedEvidence: normalizeCascadeTokenBag(evidence),
    scoreContribution: 1,
  });
}

export function createUnmatchedRecoveryConditionEvaluation(
  condition: RecoveryCondition,
  currentValue: string | number | boolean | null,
  requiredValue: string | number | boolean | null,
  evidence: readonly string[] = [],
): RecoveryConditionEvaluation {
  return Object.freeze({
    condition,
    status: 'UNMATCHED',
    matched: false,
    summary: describeRecoveryCondition(condition),
    currentValue,
    requiredValue,
    evidence: Object.freeze([...evidence]),
    normalizedEvidence: normalizeCascadeTokenBag(evidence),
    scoreContribution: 0,
  });
}

export function createRecoveryConditionEvaluationBundle(
  evaluations: readonly RecoveryConditionEvaluation[],
): RecoveryConditionEvaluationBundle {
  const matchedCount = evaluations.filter((evaluation) => evaluation.matched).length;

  return Object.freeze({
    allMatched: evaluations.length > 0 && matchedCount === evaluations.length,
    anyMatched: matchedCount > 0,
    matchedCount,
    totalCount: evaluations.length,
    evaluations: Object.freeze([...evaluations]),
  });
}

export function createLegacyRecoveryMatchResult(params: {
  readonly matched: boolean;
  readonly matchedTags?: readonly string[];
  readonly normalizedBag?: readonly string[];
  readonly normalizedRequested?: readonly string[];
  readonly sources?: readonly string[];
}): LegacyRecoveryMatchResult {
  return Object.freeze({
    matched: params.matched,
    matchedTags: Object.freeze([...(params.matchedTags ?? [])]),
    normalizedBag: Object.freeze([...(params.normalizedBag ?? [])]),
    normalizedRequested: Object.freeze([...(params.normalizedRequested ?? [])]),
    sources: Object.freeze([...(params.sources ?? [])]),
  });
}

export function createRecoveryDecisionExplanation(params: {
  readonly recovered: boolean;
  readonly structuredRecoveryAttempted: boolean;
  readonly structuredRecoverySatisfied: boolean;
  readonly legacyRecoveryAttempted: boolean;
  readonly legacyRecoverySatisfied: boolean;
  readonly structured: RecoveryConditionEvaluationBundle;
  readonly legacy: LegacyRecoveryMatchResult;
  readonly notes?: readonly string[];
}): RecoveryDecisionExplanation {
  return Object.freeze({
    recovered: params.recovered,
    structuredRecoveryAttempted: params.structuredRecoveryAttempted,
    structuredRecoverySatisfied: params.structuredRecoverySatisfied,
    legacyRecoveryAttempted: params.legacyRecoveryAttempted,
    legacyRecoverySatisfied: params.legacyRecoverySatisfied,
    structured: params.structured,
    legacy: params.legacy,
    notes: Object.freeze([...(params.notes ?? [])]),
  });
}

// -----------------------------------------------------------------------------
// Sensible Template Defaults
// -----------------------------------------------------------------------------

export const CASCADE_TEMPLATE_DEFAULTS: Readonly<
  Pick<
    CascadeTemplate,
    | 'maxConcurrent'
    | 'maxTriggersPerRun'
    | 'recoveryTags'
    | 'recovery'
    | 'oneShot'
    | 'proofBearing'
  >
> = Object.freeze({
  maxConcurrent: 1,
  maxTriggersPerRun: 1,
  recoveryTags: Object.freeze([]),
  recovery: Object.freeze([]),
  oneShot: false,
  proofBearing: false,
});

export const CASCADE_DEFAULT_MODE_OFFSET_MODIFIER: Readonly<Record<ModeCode, number>> =
  Object.freeze({
    solo: 0,
    pvp: 0,
    coop: 0,
    ghost: 0,
  });

export const CASCADE_DEFAULT_PRESSURE_SCALAR: Readonly<Record<PressureTier, number>> =
  Object.freeze({
    T0: 1,
    T1: 1.05,
    T2: 1.12,
    T3: 1.22,
    T4: 1.35,
  });

export const CASCADE_DEFAULT_PHASE_SCALAR: Readonly<Record<CascadeSupportedPhase, number>> =
  Object.freeze({
    FOUNDATION: 1,
    ESCALATION: 1.1,
    SOVEREIGNTY: 1.2,
  });

// -----------------------------------------------------------------------------
// Read Models for Tooling / Docs / Replay Surfaces
// -----------------------------------------------------------------------------

export interface CascadeTemplateReadModel {
  readonly templateId: CascadeTemplateId;
  readonly label: string;
  readonly shortLabel: string;
  readonly polarity: CascadePolarity;
  readonly severity: CascadeSeverity;
  readonly dedupeKey: string;
  readonly maxConcurrent: number;
  readonly maxTriggersPerRun: number;
  readonly linkCount: number;
  readonly recoveryConditionKinds: readonly RecoveryConditionKind[];
  readonly recoveryTags: readonly string[];
  readonly triggerFamilies: readonly CascadeTriggerFamily[];
  readonly oneShot: boolean;
  readonly proofBearing: boolean;
  readonly notes: readonly string[];
}

export interface CascadeTemplateReplayDescriptor {
  readonly templateId: CascadeTemplateId;
  readonly label: string;
  readonly severityRank: number;
  readonly lineSummaries: readonly string[];
  readonly explanation: string | null;
  readonly telemetryTags: readonly string[];
}

export function createCascadeTemplateReadModel(
  template: CascadeTemplate,
): CascadeTemplateReadModel {
  return Object.freeze({
    templateId: template.templateId,
    label: template.label,
    shortLabel: template.shortLabel ?? template.label,
    polarity: template.positive ? 'POSITIVE' : 'NEGATIVE',
    severity: template.severity,
    dedupeKey: template.dedupeKey,
    maxConcurrent: template.maxConcurrent,
    maxTriggersPerRun: template.maxTriggersPerRun,
    linkCount: template.baseOffsets.length,
    recoveryConditionKinds: collectRecoveryConditionKinds(template.recovery),
    recoveryTags: resolveTemplateRecoveryTagSurface(template),
    triggerFamilies: Object.freeze([...(template.triggerFamilies ?? [])]),
    oneShot: isTemplateOneShot(template),
    proofBearing: template.proofBearing ?? false,
    notes: Object.freeze([...(template.notes ?? [])]),
  });
}

export function createCascadeTemplateReplayDescriptor(
  template: CascadeTemplate,
): CascadeTemplateReplayDescriptor {
  const lineSummaries = template.baseOffsets.map((offset, index) => {
    const effect = template.effects[index] ?? {};
    return `link=${index + 1}|offset=${offset}|effect_keys=${Object.keys(effect).join(',')}`;
  });

  return Object.freeze({
    templateId: template.templateId,
    label: template.label,
    severityRank: getCascadeSeverityRank(template.severity),
    lineSummaries: Object.freeze(lineSummaries),
    explanation: template.explanation ?? null,
    telemetryTags: Object.freeze([...(template.telemetryTags ?? [])]),
  });
}

// -----------------------------------------------------------------------------
// Sorting Helpers
// -----------------------------------------------------------------------------

export function sortTemplatesBySeverityThenId(
  templates: readonly CascadeTemplate[],
): readonly CascadeTemplate[] {
  return Object.freeze(
    [...templates].sort((left, right) => {
      const severityDelta = compareCascadeSeverity(left.severity, right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.templateId.localeCompare(right.templateId);
    }),
  );
}

export function sortTemplatesByPolarityThenSeverityThenId(
  templates: readonly CascadeTemplate[],
): readonly CascadeTemplate[] {
  return Object.freeze(
    [...templates].sort((left, right) => {
      const leftPolarity = left.positive ? 1 : 0;
      const rightPolarity = right.positive ? 1 : 0;

      if (leftPolarity !== rightPolarity) {
        return leftPolarity - rightPolarity;
      }

      const severityDelta = compareCascadeSeverity(left.severity, right.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return left.templateId.localeCompare(right.templateId);
    }),
  );
}

// -----------------------------------------------------------------------------
// Stable Empty Objects
// -----------------------------------------------------------------------------

export const EMPTY_RECOVERY_EVALUATIONS: readonly RecoveryConditionEvaluation[] =
  Object.freeze([]);

export const EMPTY_TEMPLATE_NOTES: readonly string[] = Object.freeze([]);
export const EMPTY_TRIGGER_FAMILIES: readonly CascadeTriggerFamily[] = Object.freeze([]);
export const EMPTY_TRIGGER_FACETS: readonly CascadeTriggerFacet[] = Object.freeze([]);
export const EMPTY_TELEMETRY_TAGS: readonly CascadeTelemetryTag[] = Object.freeze([]);

// -----------------------------------------------------------------------------
// Contract Notes
// -----------------------------------------------------------------------------

/**
 * This file intentionally preserves the currently consumed authored union for
 * `RecoveryCondition`. Additional authored recovery kinds must only be added in
 * lock-step with the runtime consumers that switch exhaustively over the union.
 */
export const CASCADE_TYPES_CONTRACT_NOTE_RECOVERY_KIND_EXPANSION =
  'RecoveryCondition expansion requires coordinated runtime consumer updates.';

/**
 * This file intentionally preserves the currently consumed required properties on
 * `CascadeTemplate`. Additive fields should remain optional until manifests and
 * runtime authoring pipelines are updated together.
 */
export const CASCADE_TYPES_CONTRACT_NOTE_TEMPLATE_ADDITIVITY =
  'CascadeTemplate preserves existing required fields; additive extensions remain optional.';

/**
 * This file intentionally keeps queue/planning/evaluation exports structural and
 * backend-centric so future refactors can move internal interfaces out of engine
 * implementations without changing the authored template contract again.
 */
export const CASCADE_TYPES_CONTRACT_NOTE_STRUCTURAL_READINESS =
  'Queue planning and evaluation exports are structural mirrors for future extraction.';
