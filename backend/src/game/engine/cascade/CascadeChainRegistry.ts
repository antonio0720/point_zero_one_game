/*
 * POINT ZERO ONE — BACKEND CASCADE CHAIN REGISTRY
 * /backend/src/game/engine/cascade/CascadeChainRegistry.ts
 *
 * Doctrine:
 * - every cascade template is explicit, deterministic, and replay-safe
 * - backend owns cascade semantics, pacing, and recovery truth
 * - registry metadata must be rich enough to support runtime behavior,
 *   ML-driven analytics, and deep diagnostics without forcing the engine
 *   to infer design intent from UI assumptions
 * - additive helper methods are preferred so adjacent runtime modules can
 *   grow into richer orchestration without breaking the existing authority path
 * - templates must stay aligned with shield-layer semantics, mode doctrine,
 *   pressure cadence, and the current backend effect surface
 * - all ML signal generation must be deterministic and replay-safe
 * - analytics surfaces are read-only projections over the frozen catalog
 */

import type {
  ModeCode,
  PressureTier,
  ShieldLayerId,
} from '../core/GamePrimitives';
import type {
  CascadeManifestValidationResult,
  CascadePolarity,
  CascadeSeverity,
  CascadeTemplate,
  CascadeTemplateId,
  CascadeTemplateManifestEntry,
  CascadeTemplateManifestIndex,
  CascadeTemplateManifestSummary,
  CascadeTemplateReadModel,
  CascadeTemplateReplayDescriptor,
  CascadeTemplateValidationIssue,
  CascadeTemplateValidationResult,
  CascadeTriggerFacet,
  CascadeTriggerFamily,
  CascadeSupportedPhase,
  CascadeTelemetryTag,
  RecoveryConditionKind,
} from './types';
import {
  CASCADE_DEFAULT_MODE_OFFSET_MODIFIER,
  CASCADE_DEFAULT_PHASE_SCALAR,
  CASCADE_DEFAULT_PRESSURE_SCALAR,
  CASCADE_DEFAULT_PHASE_SCALAR as PHASE_SCALAR_DEFAULTS,
  CASCADE_SEVERITY_DEFAULT_SCALAR,
  CASCADE_SEVERITY_DEFAULT_MIN_SPACING_TICKS,
  CASCADE_SEVERITY_DEFAULT_MAX_SCALAR,
  CASCADE_SEVERITY_RANK,
  CASCADE_SUPPORTED_PHASES,
  CASCADE_TELEMETRY_TAGS,
  CASCADE_TEMPLATE_DEFAULTS,
  CASCADE_TEMPLATE_IDS,
  CASCADE_TEMPLATE_POLARITY_BY_ID,
  CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES,
  CASCADE_TRIGGER_FACETS,
  CASCADE_TRIGGER_FAMILIES,
  EMPTY_TELEMETRY_TAGS,
  EMPTY_TEMPLATE_NOTES,
  EMPTY_TRIGGER_FACETS,
  EMPTY_TRIGGER_FAMILIES,
  NEGATIVE_CASCADE_TEMPLATE_IDS,
  NUMERIC_EFFECT_FIELDS,
  POSITIVE_CASCADE_EVALUATION_STATES,
  POSITIVE_CASCADE_TEMPLATE_IDS,
  RECOVERY_CONDITION_COMPARATOR_BY_KIND,
  RECOVERY_CONDITION_KINDS,
  RECOVERY_CONDITION_STATUSES,
  collectRecoveryConditionKinds,
  compareCascadeSeverity,
  createCascadeTemplateReadModel,
  createCascadeTemplateReplayDescriptor,
  deriveRecoveryTagsFromConditions,
  getCascadeSeverityRank,
  getCascadeTemplatePolarity,
  isCascadeSeverity,
  isCascadeTemplateId,
  isNegativeCascadeTemplateId,
  isPositiveCascadeTemplateId,
  normalizeCascadeToken,
  normalizeCascadeTokenBag,
  sortTemplatesByPolarityThenSeverityThenId,
  sortTemplatesBySeverityThenId,
} from './types';

// -----------------------------------------------------------------------------
// Catalog Skeleton Types
// -----------------------------------------------------------------------------

type CascadeCatalog = Readonly<Record<CascadeTemplateId, CascadeTemplate>>;
type LayerTemplateMap = Readonly<Record<ShieldLayerId, CascadeTemplateId>>;
type SeverityTemplateMap = Readonly<Record<CascadeSeverity, readonly CascadeTemplateId[]>>;
type PressureTemplateMap = Readonly<Record<PressureTier, readonly CascadeTemplateId[]>>;
type ModeTemplateMap = Readonly<Record<ModeCode, readonly CascadeTemplateId[]>>;
type PhaseTemplateMap = Readonly<Record<CascadeSupportedPhase, readonly CascadeTemplateId[]>>;
type PolaritySplit = Readonly<{
  positive: readonly CascadeTemplateId[];
  negative: readonly CascadeTemplateId[];
}>;

// -----------------------------------------------------------------------------
// Analytics Interfaces
// -----------------------------------------------------------------------------

export interface CascadeTemplateEffectProfile {
  readonly templateId: CascadeTemplateId;
  readonly totalCashImpact: number;
  readonly totalDebtImpact: number;
  readonly totalIncomeImpact: number;
  readonly totalHeatImpact: number;
  readonly totalShieldImpact: number;
  readonly totalTrustImpact: number;
  readonly totalTimeDeltaMs: number;
  readonly totalDivergenceImpact: number;
  readonly linkCount: number;
  readonly hasCardInjections: boolean;
  readonly hasCardExhausts: boolean;
  readonly hasBadgeGrants: boolean;
  readonly uniqueCascadeTags: readonly string[];
  readonly cascadeTagSequence: readonly string[];
  readonly hasNamedActions: boolean;
  readonly netEconomicImpact: number;
  readonly economicSeverityScore: number;
  readonly shieldSeverityScore: number;
  readonly trustSeverityScore: number;
  readonly combinedSeverityScore: number;
}

export interface CascadeTemplateMLSignal {
  readonly templateId: CascadeTemplateId;
  readonly polarityCode: number;
  readonly severityRank: number;
  readonly linkDensity: number;
  readonly pressureAmplificationRange: number;
  readonly modeVariance: number;
  readonly recoveryComplexity: number;
  readonly economicPressureScore: number;
  readonly shieldPressureScore: number;
  readonly trustPressureScore: number;
  readonly timerPressureScore: number;
  readonly totalEffectMagnitude: number;
  readonly hasLayerAffinity: boolean;
  readonly layerAffinityRank: number;
  readonly recoveryTagCount: number;
  readonly recoveryConditionCount: number;
  readonly isOneShot: boolean;
  readonly isProofBearing: boolean;
  readonly phasePresenceVector: readonly number[];
  readonly modeOffsetVector: readonly number[];
  readonly pressureScalarVector: readonly number[];
  readonly featureVector: readonly number[];
}

export interface CascadeModePressureMatrix {
  readonly modes: readonly ModeCode[];
  readonly tiers: readonly PressureTier[];
  readonly cells: ReadonlyArray<{
    readonly mode: ModeCode;
    readonly tier: PressureTier;
    readonly templateIds: readonly CascadeTemplateId[];
    readonly averageScalar: number;
    readonly maxScalar: number;
    readonly minScalar: number;
    readonly negativeCount: number;
    readonly positiveCount: number;
  }>;
}

export interface CascadeLayerAffinityMap {
  readonly L1: CascadeTemplateId;
  readonly L2: CascadeTemplateId;
  readonly L3: CascadeTemplateId;
  readonly L4: CascadeTemplateId;
  readonly positiveTemplates: readonly CascadeTemplateId[];
}

export interface CascadeRegistrySnapshot {
  readonly templates: Readonly<Record<CascadeTemplateId, CascadeTemplate>>;
  readonly byLayer: Readonly<Record<ShieldLayerId, CascadeTemplateId>>;
  readonly bySeverity: Readonly<Record<CascadeSeverity, readonly CascadeTemplateId[]>>;
  readonly pressureAmplified: Readonly<Record<PressureTier, readonly CascadeTemplateId[]>>;
  readonly modeShifted: Readonly<Record<ModeCode, readonly CascadeTemplateId[]>>;
  readonly positiveTemplateIds: readonly CascadeTemplateId[];
  readonly negativeTemplateIds: readonly CascadeTemplateId[];
  readonly totalCount: number;
  readonly positiveCount: number;
  readonly negativeCount: number;
}

export interface CascadeRecoveryTagUniverseReport {
  readonly allTags: readonly string[];
  readonly allCascadeTags: readonly string[];
  readonly recoveryTagsByTemplate: Readonly<Record<CascadeTemplateId, readonly string[]>>;
  readonly cascadeTagsByTemplate: Readonly<Record<CascadeTemplateId, readonly string[]>>;
  readonly recoveryTagFrequency: ReadonlyArray<{ readonly tag: string; readonly count: number }>;
  readonly cascadeTagFrequency: ReadonlyArray<{ readonly tag: string; readonly count: number }>;
}

export interface CascadeTemplateRankingEntry {
  readonly templateId: CascadeTemplateId;
  readonly severityRank: number;
  readonly polarityScore: number;
  readonly economicWeight: number;
  readonly shieldWeight: number;
  readonly overallRank: number;
}

export interface CascadeRegistryDiagnostics {
  readonly catalogValid: boolean;
  readonly templateCount: number;
  readonly issueCount: number;
  readonly issues: readonly string[];
  readonly layerMapComplete: boolean;
  readonly dedupeKeyUnique: boolean;
  readonly allEffectsNonEmpty: boolean;
  readonly allRecoveryConditionsPresent: boolean;
}

// -----------------------------------------------------------------------------
// ML Scoring Constants
// -----------------------------------------------------------------------------

const ML_PRESSURE_SCALAR_WEIGHT = 0.28;
const ML_SEVERITY_WEIGHT = 0.22;
const ML_ECONOMIC_WEIGHT = 0.18;
const ML_SHIELD_WEIGHT = 0.16;
const ML_RECOVERY_COMPLEXITY_WEIGHT = 0.10;
const ML_TIMING_WEIGHT = 0.06;

const SEVERITY_ECONOMIC_BASELINE: Readonly<Record<CascadeSeverity, number>> = Object.freeze({
  LOW: 500,
  MEDIUM: 1200,
  HIGH: 2500,
  CRITICAL: 4500,
});

const PHASE_SCALARS_REFERENCE: Readonly<Record<CascadeSupportedPhase, number>> = CASCADE_DEFAULT_PHASE_SCALAR;

const PRESSURE_SCALARS_REFERENCE: Readonly<Record<PressureTier, number>> = CASCADE_DEFAULT_PRESSURE_SCALAR;

const MODE_OFFSET_REFERENCE: Readonly<Record<ModeCode, number>> = CASCADE_DEFAULT_MODE_OFFSET_MODIFIER;

const VALID_TRIGGER_FAMILIES: readonly CascadeTriggerFamily[] = CASCADE_TRIGGER_FAMILIES;
const VALID_TRIGGER_FACETS: readonly CascadeTriggerFacet[] = CASCADE_TRIGGER_FACETS;
const VALID_TELEMETRY_TAGS: readonly CascadeTelemetryTag[] = CASCADE_TELEMETRY_TAGS;

// Pressure tier ordering used by ML feature vectors
const PRESSURE_TIERS: readonly PressureTier[] = ['T0', 'T1', 'T2', 'T3', 'T4'];
const ALL_MODE_CODES: readonly ModeCode[] = ['solo', 'pvp', 'coop', 'ghost'];
const ALL_SHIELD_LAYERS: readonly ShieldLayerId[] = ['L1', 'L2', 'L3', 'L4'];
const ALL_SEVERITIES: readonly CascadeSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// Recovery condition kinds available in the system
const KNOWN_RECOVERY_KINDS: readonly RecoveryConditionKind[] = RECOVERY_CONDITION_KINDS;

// Validation issue codes for catalog integrity checks
const KNOWN_VALIDATION_CODES = CASCADE_TEMPLATE_VALIDATION_ISSUE_CODES;

// Recovery condition comparators
const RECOVERY_COMPARATORS = RECOVERY_CONDITION_COMPARATOR_BY_KIND;

// Recovery condition status tokens
const RECOVERY_STATUS_TOKENS = RECOVERY_CONDITION_STATUSES;

// Positive cascade evaluation states for analytics
const POSITIVE_EVAL_STATES = POSITIVE_CASCADE_EVALUATION_STATES;

// Supported phases for template phase analytics
const SUPPORTED_PHASES: readonly CascadeSupportedPhase[] = CASCADE_SUPPORTED_PHASES;

// Default template contract values
const TEMPLATE_DEFAULTS = CASCADE_TEMPLATE_DEFAULTS;

// Numeric effect field labels for effect profiling
const EFFECT_FIELD_LABELS = NUMERIC_EFFECT_FIELDS;

// Empty stable references
const _EMPTY_NOTES = EMPTY_TEMPLATE_NOTES;
const _EMPTY_TRIGGER_FAMILIES = EMPTY_TRIGGER_FAMILIES;
const _EMPTY_TRIGGER_FACETS = EMPTY_TRIGGER_FACETS;
const _EMPTY_TELEMETRY_TAGS = EMPTY_TELEMETRY_TAGS;

// Polarity map for fast lookup
const _POLARITY_MAP = CASCADE_TEMPLATE_POLARITY_BY_ID;

// Severity scalars from canonical defaults
const SEVERITY_DEFAULT_SCALARS = CASCADE_SEVERITY_DEFAULT_SCALAR;
const SEVERITY_DEFAULT_SPACING = CASCADE_SEVERITY_DEFAULT_MIN_SPACING_TICKS;
const SEVERITY_DEFAULT_MAX_SCALARS = CASCADE_SEVERITY_DEFAULT_MAX_SCALAR;

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function freezeReadonlyArray<T>(value: readonly T[]): readonly T[] {
  return Object.freeze([...value]);
}

function freezeReadonlyRecord<T extends Record<string, unknown>>(value: T): Readonly<T> {
  return Object.freeze({ ...value });
}

function freezeTemplate<T extends CascadeTemplate>(template: T): T {
  return Object.freeze({
    ...template,
    baseOffsets: freezeReadonlyArray(template.baseOffsets),
    effects: freezeReadonlyArray(
      template.effects.map((effect) =>
        Object.freeze({
          ...effect,
          injectCards: effect.injectCards ? freezeReadonlyArray(effect.injectCards) : undefined,
          exhaustCards: effect.exhaustCards ? freezeReadonlyArray(effect.exhaustCards) : undefined,
          grantBadges: effect.grantBadges ? freezeReadonlyArray(effect.grantBadges) : undefined,
        }),
      ),
    ),
    recoveryTags: freezeReadonlyArray(template.recoveryTags),
    recovery: freezeReadonlyArray(
      template.recovery.map((condition) => {
        if ('tags' in condition) {
          return Object.freeze({
            ...condition,
            tags: freezeReadonlyArray(condition.tags),
          });
        }
        return Object.freeze({ ...condition });
      }),
    ),
    modeOffsetModifier: template.modeOffsetModifier
      ? freezeReadonlyRecord(template.modeOffsetModifier)
      : undefined,
    pressureScalar: template.pressureScalar
      ? freezeReadonlyRecord(template.pressureScalar)
      : undefined,
    notes: template.notes ? freezeReadonlyArray(template.notes) : _EMPTY_NOTES,
    triggerFamilies: template.triggerFamilies
      ? freezeReadonlyArray(template.triggerFamilies)
      : _EMPTY_TRIGGER_FAMILIES,
    triggerFacets: template.triggerFacets
      ? freezeReadonlyArray(template.triggerFacets)
      : _EMPTY_TRIGGER_FACETS,
    telemetryTags: template.telemetryTags
      ? freezeReadonlyArray(template.telemetryTags)
      : _EMPTY_TELEMETRY_TAGS,
  }) as T;
}

function definePressureScalar(
  T0: number,
  T1: number,
  T2: number,
  T3: number,
  T4: number,
): Readonly<Record<PressureTier, number>> {
  return Object.freeze({ T0, T1, T2, T3, T4 });
}

function defineModeOffsets(
  offsets: Partial<Record<ModeCode, number>>,
): Partial<Record<ModeCode, number>> {
  return Object.freeze({ ...offsets });
}

function defineLayerTemplateMap(): LayerTemplateMap {
  return Object.freeze({
    L1: 'LIQUIDITY_SPIRAL',
    L2: 'CREDIT_FREEZE',
    L3: 'INCOME_SHOCK',
    L4: 'NETWORK_LOCKDOWN',
  });
}

function buildSeverityIndex(catalog: CascadeCatalog): SeverityTemplateMap {
  const map: Record<CascadeSeverity, CascadeTemplateId[]> = {
    LOW: [],
    MEDIUM: [],
    HIGH: [],
    CRITICAL: [],
  };

  for (const templateId of CASCADE_TEMPLATE_IDS) {
    map[catalog[templateId].severity].push(templateId);
  }

  return Object.freeze({
    LOW: freezeReadonlyArray(map.LOW),
    MEDIUM: freezeReadonlyArray(map.MEDIUM),
    HIGH: freezeReadonlyArray(map.HIGH),
    CRITICAL: freezeReadonlyArray(map.CRITICAL),
  });
}

function buildPressureIndex(catalog: CascadeCatalog): PressureTemplateMap {
  const map: Record<PressureTier, CascadeTemplateId[]> = {
    T0: [],
    T1: [],
    T2: [],
    T3: [],
    T4: [],
  };

  for (const templateId of CASCADE_TEMPLATE_IDS) {
    const template = catalog[templateId];
    for (const tier of PRESSURE_TIERS) {
      if ((template.pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier]) > 1) {
        map[tier].push(templateId);
      }
    }
  }

  return Object.freeze({
    T0: freezeReadonlyArray(map.T0),
    T1: freezeReadonlyArray(map.T1),
    T2: freezeReadonlyArray(map.T2),
    T3: freezeReadonlyArray(map.T3),
    T4: freezeReadonlyArray(map.T4),
  });
}

function buildModeIndex(catalog: CascadeCatalog): ModeTemplateMap {
  const map: Record<ModeCode, CascadeTemplateId[]> = {
    solo: [],
    pvp: [],
    coop: [],
    ghost: [],
  };

  for (const templateId of CASCADE_TEMPLATE_IDS) {
    const template = catalog[templateId];
    for (const mode of ALL_MODE_CODES) {
      const offset = template.modeOffsetModifier?.[mode] ?? MODE_OFFSET_REFERENCE[mode];
      if (offset !== 0) {
        map[mode].push(templateId);
      }
    }
  }

  return Object.freeze({
    solo: freezeReadonlyArray(map.solo),
    pvp: freezeReadonlyArray(map.pvp),
    coop: freezeReadonlyArray(map.coop),
    ghost: freezeReadonlyArray(map.ghost),
  });
}

function buildPhaseIndex(catalog: CascadeCatalog): PhaseTemplateMap {
  const map: Record<CascadeSupportedPhase, CascadeTemplateId[]> = {
    FOUNDATION: [],
    ESCALATION: [],
    SOVEREIGNTY: [],
  };

  for (const templateId of CASCADE_TEMPLATE_IDS) {
    const template = catalog[templateId];
    for (const phase of SUPPORTED_PHASES) {
      const scalar = template.phaseScalar?.[phase] ?? PHASE_SCALARS_REFERENCE[phase];
      if (scalar > 1) {
        map[phase].push(templateId);
      }
    }
  }

  return Object.freeze({
    FOUNDATION: freezeReadonlyArray(map.FOUNDATION),
    ESCALATION: freezeReadonlyArray(map.ESCALATION),
    SOVEREIGNTY: freezeReadonlyArray(map.SOVEREIGNTY),
  });
}

function buildCatalog(): CascadeCatalog {
  const catalog = {
    LIQUIDITY_SPIRAL: freezeTemplate({
      templateId: 'LIQUIDITY_SPIRAL',
      label: 'Liquidity Spiral',
      positive: false,
      severity: 'HIGH',
      dedupeKey: 'shield:L1',
      maxConcurrent: 2,
      maxTriggersPerRun: 4,
      baseOffsets: [1, 2, 4, 6],
      effects: [
        { cashDelta: -350, heatDelta: 1, cascadeTag: 'liquidity' },
        { cashDelta: -700, heatDelta: 1, shieldDelta: -1, cascadeTag: 'liquidity' },
        { cashDelta: -1150, heatDelta: 2, timeDeltaMs: 200, cascadeTag: 'resilience' },
        {
          cashDelta: -1650,
          heatDelta: 3,
          shieldDelta: -2,
          divergenceDelta: 1,
          cascadeTag: 'liquidity',
        },
      ],
      recoveryTags: ['liquidity', 'resilience', 'aid', 'cash_reserve'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['liquidity', 'resilience', 'aid'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['liquidity', 'cash_reserve'] },
        { kind: 'CASH_MIN', amount: 2500 },
      ],
      modeOffsetModifier: defineModeOffsets({ ghost: 1, solo: 0, pvp: 0, coop: -1 }),
      pressureScalar: definePressureScalar(0.90, 1.00, 1.10, 1.22, 1.36),
      triggerFamilies: ['SHIELD_BREACH', 'PRESSURE_ESCALATION', 'HEAT_SPIKE'],
      triggerFacets: ['L1', 'HEAT', 'CASH'],
      telemetryTags: ['NEGATIVE', 'BREACH_LINKED', 'PRESSURE_SCALED', 'HEAT_SENSITIVE'],
      authoredPolarity: 'NEGATIVE',
      explanation: 'L1-native negative chain converting cash weakness into escalating liquidity compression.',
      recoveryRationale: 'Stabilized by cash-focused cards and liquidity repair actions.',
      polarityRationale: 'Negative chain designed to be survivable early, punitive if unaddressed.',
      oneShot: false,
      proofBearing: true,
      minTickSpacing: 1,
      notes: [
        'L1-native negative chain that converts cash weakness into escalating liquidity compression.',
        'Designed to feel survivable early, then punitive if left unaddressed past the mid-run.',
        'Co-op rescue posture slightly slows the chain because syndicate recovery should matter.',
        'Ghost pressure accelerates the chain to reflect deterministic precision punishment.',
      ],
    }),

    CREDIT_FREEZE: freezeTemplate({
      templateId: 'CREDIT_FREEZE',
      label: 'Credit Freeze',
      positive: false,
      severity: 'HIGH',
      dedupeKey: 'shield:L2',
      maxConcurrent: 2,
      maxTriggersPerRun: 3,
      baseOffsets: [1, 3, 5],
      effects: [
        { shieldDelta: -3, heatDelta: 1, cascadeTag: 'credit' },
        { shieldDelta: -5, heatDelta: 1, timeDeltaMs: 250, cascadeTag: 'compliance' },
        {
          shieldDelta: -6,
          heatDelta: 2,
          trustDelta: -2,
          divergenceDelta: 1,
          cascadeTag: 'evidence',
        },
      ],
      recoveryTags: ['credit', 'compliance', 'evidence', 'counter'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['credit', 'compliance', 'evidence'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['counter', 'evidence'] },
        { kind: 'WEAKEST_SHIELD_RATIO_MIN', ratio: 0.55 },
      ],
      modeOffsetModifier: defineModeOffsets({ pvp: 1, ghost: 0, solo: 0, coop: -1 }),
      pressureScalar: definePressureScalar(0.92, 1.00, 1.12, 1.26, 1.40),
      triggerFamilies: ['SHIELD_BREACH', 'PRESSURE_ESCALATION'],
      triggerFacets: ['L2', 'TRUST'],
      telemetryTags: ['NEGATIVE', 'BREACH_LINKED', 'PRESSURE_SCALED', 'TRUST_SENSITIVE'],
      authoredPolarity: 'NEGATIVE',
      explanation: 'L2-native chain turning shield instability into persistent credit compression.',
      recoveryRationale: 'Counter and compliance cards stabilize the trust/evidence loop.',
      polarityRationale: 'Negative chain emphasizing PvP lock-and-counter identity.',
      oneShot: false,
      proofBearing: true,
      minTickSpacing: 1,
      notes: [
        'L2-native chain that turns shield instability into persistent credit compression.',
        'PvP accelerates because lock-and-counter tempo is one of the mode\'s central identities.',
        'Trust-supported cooperative runs are allowed a modest pacing discount here.',
      ],
    }),

    INCOME_SHOCK: freezeTemplate({
      templateId: 'INCOME_SHOCK',
      label: 'Income Shock',
      positive: false,
      severity: 'CRITICAL',
      dedupeKey: 'shield:L3',
      maxConcurrent: 2,
      maxTriggersPerRun: 3,
      baseOffsets: [1, 2, 4, 6],
      effects: [
        { incomeDelta: -80, cashDelta: -250, cascadeTag: 'income' },
        { incomeDelta: -110, cashDelta: -375, heatDelta: 1, cascadeTag: 'income' },
        { incomeDelta: -145, cashDelta: -550, trustDelta: -1, cascadeTag: 'aid' },
        {
          incomeDelta: -180,
          cashDelta: -800,
          heatDelta: 1,
          divergenceDelta: 2,
          cascadeTag: 'rescue',
        },
      ],
      recoveryTags: ['income', 'aid', 'rescue', 'ipa'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['income', 'aid', 'rescue'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['ipa', 'income'] },
        { kind: 'CASH_MIN', amount: 3000 },
        { kind: 'PRESSURE_NOT_ABOVE', tier: 'T2' },
      ],
      modeOffsetModifier: defineModeOffsets({ solo: 0, pvp: 1, coop: -1, ghost: 1 }),
      pressureScalar: definePressureScalar(0.85, 1.00, 1.15, 1.30, 1.46),
      triggerFamilies: ['SHIELD_BREACH', 'PRESSURE_ESCALATION', 'CARD_PLAY'],
      triggerFacets: ['L3', 'INCOME', 'CASH'],
      telemetryTags: ['NEGATIVE', 'BREACH_LINKED', 'PRESSURE_SCALED', 'HEAT_SENSITIVE', 'TRUST_SENSITIVE'],
      authoredPolarity: 'NEGATIVE',
      explanation: 'L3-native chain attacking cashflow stability rather than only immediate shield integrity.',
      recoveryRationale: 'Income and rescue cards must address the dual income/cash pressure simultaneously.',
      polarityRationale: 'Most economy-punishing negative chain in the current authoritative catalog.',
      oneShot: false,
      proofBearing: true,
      minTickSpacing: 1,
      notes: [
        'L3-native chain that attacks cashflow stability rather than only immediate shield integrity.',
        'This is the most economy-punishing negative chain in the current authoritative catalog.',
        'Co-op gets slight relief because rescue and trust should have a real backend signature.',
        'Ghost and PvP both intensify timing punishment because deterministic execution matters more there.',
      ],
    }),

    NETWORK_LOCKDOWN: freezeTemplate({
      templateId: 'NETWORK_LOCKDOWN',
      label: 'Network Lockdown',
      positive: false,
      severity: 'CRITICAL',
      dedupeKey: 'shield:L4',
      maxConcurrent: 1,
      maxTriggersPerRun: 2,
      baseOffsets: [1, 3, 5],
      effects: [
        { shieldDelta: -4, heatDelta: 2, cascadeTag: 'network' },
        {
          shieldDelta: -6,
          heatDelta: 2,
          cashDelta: -200,
          trustDelta: -2,
          cascadeTag: 'trust',
        },
        {
          shieldDelta: -7,
          heatDelta: 3,
          timeDeltaMs: 350,
          divergenceDelta: 2,
          injectCards: ['NETWORK_AUDIT_ALERT'],
          cascadeTag: 'signal_clear',
        },
      ],
      recoveryTags: ['network', 'trust', 'signal_clear', 'discipline'],
      recovery: [
        { kind: 'CARD_TAG_ANY', tags: ['network', 'trust', 'signal_clear'] },
        { kind: 'LAST_PLAYED_TAG_ANY', tags: ['discipline', 'network'] },
        { kind: 'TRUST_ANY_MIN', score: 80 },
        { kind: 'ALL_SHIELDS_RATIO_MIN', ratio: 0.45 },
      ],
      modeOffsetModifier: defineModeOffsets({ coop: -1, ghost: 1, solo: 0, pvp: 0 }),
      pressureScalar: definePressureScalar(1.00, 1.05, 1.15, 1.32, 1.50),
      triggerFamilies: ['SHIELD_BREACH', 'MODE_EVENT', 'PRESSURE_ESCALATION'],
      triggerFacets: ['L4', 'TRUST', 'SYSTEM'],
      telemetryTags: ['NEGATIVE', 'BREACH_LINKED', 'PRESSURE_SCALED', 'TRUST_SENSITIVE', 'GHOST_CONTEXT', 'DENSE'],
      authoredPolarity: 'NEGATIVE',
      explanation: 'L4-native systemic chain compromising run trust and signal backbone.',
      recoveryRationale: 'Trust architecture and network cards must collectively counter the lockdown.',
      polarityRationale: 'Capped at one instance because repeated L4 pressure should be terrifying but legible.',
      oneShot: false,
      proofBearing: true,
      minTickSpacing: 1,
      notes: [
        'L4-native systemic chain intended to feel like the run\'s trust and signal backbone is compromised.',
        'The chain remains capped at one active instance because repeated L4 pressure should be terrifying but legible.',
        'Co-op trust architecture can blunt this earlier; Ghost runs should feel markedly more predatory.',
      ],
    }),

    COMEBACK_SURGE: freezeTemplate({
      templateId: 'COMEBACK_SURGE',
      label: 'Comeback Surge',
      positive: true,
      severity: 'MEDIUM',
      dedupeKey: 'positive:comeback',
      maxConcurrent: 1,
      maxTriggersPerRun: 1,
      baseOffsets: [0, 1, 2, 3],
      effects: [
        { shieldDelta: 2, cashDelta: 125, heatDelta: -1, cascadeTag: 'recovery' },
        { shieldDelta: 2, cashDelta: 175, heatDelta: -1, cascadeTag: 'recovery' },
        { shieldDelta: 3, cashDelta: 250, trustDelta: 1, cascadeTag: 'resilience' },
        { shieldDelta: 3, cashDelta: 325, divergenceDelta: -1, cascadeTag: 'recovery' },
      ],
      recoveryTags: [],
      recovery: [],
      modeOffsetModifier: defineModeOffsets({ solo: 0, pvp: 0, coop: 0, ghost: 0 }),
      pressureScalar: definePressureScalar(1.00, 1.00, 1.00, 1.10, 1.16),
      triggerFamilies: ['RECOVERY', 'LEGEND'],
      triggerFacets: ['NONE'],
      telemetryTags: ['POSITIVE', 'RECOVERY', 'ONE_SHOT'],
      authoredPolarity: 'POSITIVE',
      explanation: 'One-shot rebound chain unlocked from durable recovery conditions after high-stress periods.',
      recoveryRationale: 'Positive chains do not use recovery interruption by design.',
      polarityRationale: 'Rewards stabilization under pressure rather than early-run comfort.',
      oneShot: true,
      proofBearing: true,
      minTickSpacing: 0,
      notes: [
        'Positive one-shot rebound chain unlocked from durable recovery conditions.',
        'Intended to reward stabilization under pressure rather than early-run comfort.',
        'All mode offsets remain neutral because the unlock gate already handles posture differences.',
      ],
    }),

    MOMENTUM_ENGINE: freezeTemplate({
      templateId: 'MOMENTUM_ENGINE',
      label: 'Momentum Engine',
      positive: true,
      severity: 'LOW',
      dedupeKey: 'positive:momentum',
      maxConcurrent: 1,
      maxTriggersPerRun: 1,
      baseOffsets: [0, 2, 4, 6],
      effects: [
        { incomeDelta: 50, cashDelta: 75, cascadeTag: 'momentum' },
        { incomeDelta: 65, cashDelta: 125, heatDelta: -1, cascadeTag: 'momentum' },
        { incomeDelta: 80, cashDelta: 175, trustDelta: 1, cascadeTag: 'momentum' },
        { incomeDelta: 95, cashDelta: 225, divergenceDelta: -1, cascadeTag: 'compound' },
      ],
      recoveryTags: [],
      recovery: [],
      modeOffsetModifier: defineModeOffsets({ solo: 0, pvp: 0, coop: 0, ghost: 0 }),
      pressureScalar: definePressureScalar(1.00, 1.00, 1.00, 1.00, 1.00),
      triggerFamilies: ['RECOVERY', 'CARD_PLAY'],
      triggerFacets: ['NONE'],
      telemetryTags: ['POSITIVE', 'ONE_SHOT'],
      authoredPolarity: 'POSITIVE',
      explanation: 'Positive flywheel chain converting clean fundamentals into backend-owned acceleration.',
      recoveryRationale: 'Positive chains do not use recovery interruption by design.',
      polarityRationale: 'Deliberately mild per tick so the chain feels earned rather than random.',
      oneShot: true,
      proofBearing: false,
      minTickSpacing: 0,
      notes: [
        'Positive flywheel chain that converts clean fundamentals into a backend-owned acceleration pattern.',
        'Deliberately mild on each individual tick so the chain feels earned rather than random.',
      ],
    }),
  } satisfies Record<CascadeTemplateId, CascadeTemplate>;

  return Object.freeze(catalog);
}

// -----------------------------------------------------------------------------
// CascadeChainRegistry
// -----------------------------------------------------------------------------

export class CascadeChainRegistry {
  private readonly templates: CascadeCatalog;
  private readonly layerTemplateMap: LayerTemplateMap;
  private readonly severityIndex: SeverityTemplateMap;
  private readonly pressureAmplifiedIndex: PressureTemplateMap;
  private readonly modeShiftedIndex: ModeTemplateMap;
  private readonly phasePresenceIndex: PhaseTemplateMap;
  private readonly polaritySplit: PolaritySplit;

  // Cached analytics (built lazily)
  private _effectProfileCache: Map<CascadeTemplateId, CascadeTemplateEffectProfile> | null = null;
  private _mlSignalCache: Map<CascadeTemplateId, CascadeTemplateMLSignal> | null = null;
  private _readModelCache: Map<CascadeTemplateId, CascadeTemplateReadModel> | null = null;
  private _replayDescriptorCache: Map<CascadeTemplateId, CascadeTemplateReplayDescriptor> | null = null;
  private _manifestIndexCache: CascadeTemplateManifestIndex | null = null;

  public constructor() {
    this.templates = buildCatalog();
    this.layerTemplateMap = defineLayerTemplateMap();
    this.severityIndex = buildSeverityIndex(this.templates);
    this.pressureAmplifiedIndex = buildPressureIndex(this.templates);
    this.modeShiftedIndex = buildModeIndex(this.templates);
    this.phasePresenceIndex = buildPhaseIndex(this.templates);
    this.polaritySplit = Object.freeze({
      positive: POSITIVE_CASCADE_TEMPLATE_IDS,
      negative: NEGATIVE_CASCADE_TEMPLATE_IDS,
    });

    this.validateCatalog();
  }

  // ---------------------------------------------------------------------------
  // Core Lookup
  // ---------------------------------------------------------------------------

  public get(templateId: CascadeTemplateId | string): CascadeTemplate {
    const template = this.templates[templateId as CascadeTemplateId];
    if (!template) {
      throw new Error(`Unknown cascade template: ${templateId}`);
    }
    return template;
  }

  public tryGet(templateId: CascadeTemplateId | string): CascadeTemplate | null {
    return this.templates[templateId as CascadeTemplateId] ?? null;
  }

  public has(templateId: CascadeTemplateId | string): boolean {
    return this.tryGet(templateId) !== null;
  }

  public forLayer(layerId: ShieldLayerId): CascadeTemplateId {
    const templateId = this.layerTemplateMap[layerId];
    if (!templateId) {
      throw new Error(`Unsupported shield layer for cascade mapping: ${String(layerId)}`);
    }
    return templateId;
  }

  // ---------------------------------------------------------------------------
  // Identity / Polarity Queries
  // ---------------------------------------------------------------------------

  public isLayerBoundTemplate(templateId: CascadeTemplateId | string): boolean {
    if (!this.has(templateId)) {
      return false;
    }
    return (NEGATIVE_CASCADE_TEMPLATE_IDS as readonly CascadeTemplateId[]).includes(
      templateId as CascadeTemplateId,
    );
  }

  public isPositiveTemplate(templateId: CascadeTemplateId | string): boolean {
    const template = this.tryGet(templateId);
    return template?.positive ?? false;
  }

  public isNegativeTemplate(templateId: CascadeTemplateId | string): boolean {
    const template = this.tryGet(templateId);
    return template ? !template.positive : false;
  }

  public getPolarity(templateId: CascadeTemplateId | string): CascadePolarity | null {
    if (!isCascadeTemplateId(templateId)) {
      return null;
    }
    return getCascadeTemplatePolarity(templateId);
  }

  public isPolarityMatchedBy(
    templateId: CascadeTemplateId | string,
    polarity: CascadePolarity,
  ): boolean {
    const p = this.getPolarity(templateId);
    return p === polarity;
  }

  // ---------------------------------------------------------------------------
  // Listing
  // ---------------------------------------------------------------------------

  public listTemplateIds(): readonly CascadeTemplateId[] {
    return CASCADE_TEMPLATE_IDS;
  }

  public listPositiveTemplateIds(): readonly CascadeTemplateId[] {
    return this.polaritySplit.positive;
  }

  public listNegativeTemplateIds(): readonly CascadeTemplateId[] {
    return this.polaritySplit.negative;
  }

  public listBySeverity(severity: CascadeSeverity): readonly CascadeTemplateId[] {
    return this.severityIndex[severity];
  }

  public listPressureAmplifiedAtTier(tier: PressureTier): readonly CascadeTemplateId[] {
    return this.pressureAmplifiedIndex[tier];
  }

  public listModeShiftedTemplates(mode: ModeCode): readonly CascadeTemplateId[] {
    return this.modeShiftedIndex[mode];
  }

  public listPhasePresent(phase: CascadeSupportedPhase): readonly CascadeTemplateId[] {
    return this.phasePresenceIndex[phase];
  }

  public listTemplates(): readonly CascadeTemplate[] {
    return CASCADE_TEMPLATE_IDS.map((templateId) => this.templates[templateId]);
  }

  public listTemplatesSortedBySeverity(): readonly CascadeTemplate[] {
    return sortTemplatesBySeverityThenId(this.listTemplates());
  }

  public listTemplatesSortedByPolarityThenSeverity(): readonly CascadeTemplate[] {
    return sortTemplatesByPolarityThenSeverityThenId(this.listTemplates());
  }

  public listTemplatesForModeAndPressure(
    mode: ModeCode,
    tier: PressureTier,
  ): readonly CascadeTemplateId[] {
    const modeShifted = new Set(this.modeShiftedIndex[mode]);
    const pressureAmplified = new Set(this.pressureAmplifiedIndex[tier]);
    const ordered: CascadeTemplateId[] = [];

    for (const templateId of CASCADE_TEMPLATE_IDS) {
      if (modeShifted.has(templateId) || pressureAmplified.has(templateId)) {
        ordered.push(templateId);
      }
    }

    return freezeReadonlyArray(ordered);
  }

  public listOneShot(): readonly CascadeTemplateId[] {
    return CASCADE_TEMPLATE_IDS.filter(
      (id) => this.templates[id].oneShot === true,
    );
  }

  public listProofBearing(): readonly CascadeTemplateId[] {
    return CASCADE_TEMPLATE_IDS.filter(
      (id) => this.templates[id].proofBearing === true,
    );
  }

  // ---------------------------------------------------------------------------
  // Scalar Queries
  // ---------------------------------------------------------------------------

  public getModeOffset(templateId: CascadeTemplateId | string, mode: ModeCode): number {
    return this.get(templateId).modeOffsetModifier?.[mode] ?? MODE_OFFSET_REFERENCE[mode];
  }

  public getPressureScalar(templateId: CascadeTemplateId | string, tier: PressureTier): number {
    return this.get(templateId).pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier];
  }

  public getPhaseScalar(templateId: CascadeTemplateId | string, phase: CascadeSupportedPhase): number {
    return this.get(templateId).phaseScalar?.[phase] ?? PHASE_SCALARS_REFERENCE[phase];
  }

  public getSeverityDefaultScalar(severity: CascadeSeverity): number {
    return SEVERITY_DEFAULT_SCALARS[severity];
  }

  public getSeverityDefaultMaxScalar(severity: CascadeSeverity): number {
    return SEVERITY_DEFAULT_MAX_SCALARS[severity];
  }

  public getSeverityDefaultMinSpacing(severity: CascadeSeverity): number {
    return SEVERITY_DEFAULT_SPACING[severity];
  }

  public getDedupeKey(templateId: CascadeTemplateId | string): string {
    return this.get(templateId).dedupeKey;
  }

  public getStrongestPressureTier(templateId: CascadeTemplateId | string): PressureTier {
    const template = this.get(templateId);
    let bestTier: PressureTier = 'T0';
    let bestScalar = template.pressureScalar?.T0 ?? PRESSURE_SCALARS_REFERENCE.T0;

    for (const tier of PRESSURE_TIERS) {
      const scalar = template.pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier];
      if (scalar > bestScalar) {
        bestScalar = scalar;
        bestTier = tier;
      }
    }

    return bestTier;
  }

  public getMostAcceleratedMode(templateId: CascadeTemplateId | string): ModeCode | null {
    const template = this.get(templateId);
    let bestMode: ModeCode | null = null;
    let bestDelta = 0;

    for (const mode of ALL_MODE_CODES) {
      const delta = template.modeOffsetModifier?.[mode] ?? MODE_OFFSET_REFERENCE[mode];
      if (delta > bestDelta) {
        bestDelta = delta;
        bestMode = mode;
      }
    }

    return bestMode;
  }

  // ---------------------------------------------------------------------------
  // Catalog Catalog Projections
  // ---------------------------------------------------------------------------

  public getPositiveCatalog(): Readonly<Record<CascadeTemplateId, CascadeTemplate>> {
    const catalog = {} as Record<CascadeTemplateId, CascadeTemplate>;
    for (const templateId of POSITIVE_CASCADE_TEMPLATE_IDS) {
      catalog[templateId] = this.templates[templateId];
    }
    return Object.freeze(catalog);
  }

  public getNegativeCatalog(): Readonly<Record<CascadeTemplateId, CascadeTemplate>> {
    const catalog = {} as Record<CascadeTemplateId, CascadeTemplate>;
    for (const templateId of NEGATIVE_CASCADE_TEMPLATE_IDS) {
      catalog[templateId] = this.templates[templateId];
    }
    return Object.freeze(catalog);
  }

  public getCatalogSnapshot(): CascadeRegistrySnapshot {
    return Object.freeze({
      templates: this.templates,
      byLayer: this.layerTemplateMap,
      bySeverity: this.severityIndex,
      pressureAmplified: this.pressureAmplifiedIndex,
      modeShifted: this.modeShiftedIndex,
      positiveTemplateIds: this.polaritySplit.positive,
      negativeTemplateIds: this.polaritySplit.negative,
      totalCount: CASCADE_TEMPLATE_IDS.length,
      positiveCount: POSITIVE_CASCADE_TEMPLATE_IDS.length,
      negativeCount: NEGATIVE_CASCADE_TEMPLATE_IDS.length,
    });
  }

  public getManifestSummary(): CascadeTemplateManifestSummary {
    const severityCounts: Record<CascadeSeverity, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const templateId of CASCADE_TEMPLATE_IDS) {
      severityCounts[this.templates[templateId].severity] += 1;
    }

    return Object.freeze({
      totalTemplates: CASCADE_TEMPLATE_IDS.length,
      positiveTemplates: POSITIVE_CASCADE_TEMPLATE_IDS.length,
      negativeTemplates: NEGATIVE_CASCADE_TEMPLATE_IDS.length,
      severityCounts: Object.freeze(severityCounts),
      templateIds: CASCADE_TEMPLATE_IDS,
    });
  }

  // ---------------------------------------------------------------------------
  // Read Model / Replay Surfaces
  // ---------------------------------------------------------------------------

  public getReadModel(templateId: CascadeTemplateId | string): CascadeTemplateReadModel {
    const tId = templateId as CascadeTemplateId;
    if (!this._readModelCache) {
      this._readModelCache = new Map();
    }

    const cached = this._readModelCache.get(tId);
    if (cached) {
      return cached;
    }

    const template = this.get(tId);
    const model = createCascadeTemplateReadModel(template);
    this._readModelCache.set(tId, model);
    return model;
  }

  public getAllReadModels(): readonly CascadeTemplateReadModel[] {
    return CASCADE_TEMPLATE_IDS.map((id) => this.getReadModel(id));
  }

  public getReplayDescriptor(templateId: CascadeTemplateId | string): CascadeTemplateReplayDescriptor {
    const tId = templateId as CascadeTemplateId;
    if (!this._replayDescriptorCache) {
      this._replayDescriptorCache = new Map();
    }

    const cached = this._replayDescriptorCache.get(tId);
    if (cached) {
      return cached;
    }

    const template = this.get(tId);
    const descriptor = createCascadeTemplateReplayDescriptor(template);
    this._replayDescriptorCache.set(tId, descriptor);
    return descriptor;
  }

  public getAllReplayDescriptors(): readonly CascadeTemplateReplayDescriptor[] {
    return CASCADE_TEMPLATE_IDS.map((id) => this.getReplayDescriptor(id));
  }

  // ---------------------------------------------------------------------------
  // Manifest Index (for validation tooling and external consumers)
  // ---------------------------------------------------------------------------

  public getManifestIndex(): CascadeTemplateManifestIndex {
    if (this._manifestIndexCache) {
      return this._manifestIndexCache;
    }

    const index = {} as Record<CascadeTemplateId, CascadeTemplateManifestEntry>;

    for (const templateId of CASCADE_TEMPLATE_IDS) {
      const template = this.templates[templateId];
      const polarity = getCascadeTemplatePolarity(templateId);
      const severityRank = getCascadeSeverityRank(template.severity);
      const recoveryConditionKinds = collectRecoveryConditionKinds(template.recovery);
      const inferredRecoveryTags = deriveRecoveryTagsFromConditions(template.recovery);

      index[templateId] = Object.freeze({
        template,
        polarity,
        severityRank,
        recoveryConditionKinds,
        inferredRecoveryTags,
      });
    }

    this._manifestIndexCache = Object.freeze(index) as CascadeTemplateManifestIndex;
    return this._manifestIndexCache;
  }

  // ---------------------------------------------------------------------------
  // Tag Universe Queries
  // ---------------------------------------------------------------------------

  public getRecoveryTagUniverse(): readonly string[] {
    const tags = new Set<string>();

    for (const template of this.listTemplates()) {
      for (const tag of template.recoveryTags) {
        tags.add(normalizeCascadeToken(tag));
      }
      for (const condition of template.recovery) {
        if ('tags' in condition) {
          for (const tag of condition.tags) {
            tags.add(normalizeCascadeToken(tag));
          }
        }
      }
    }

    return freezeReadonlyArray([...tags].sort());
  }

  public getCascadeTagUniverse(): readonly string[] {
    const tags = new Set<string>();

    for (const template of this.listTemplates()) {
      for (const effect of template.effects) {
        if (effect.cascadeTag) {
          tags.add(normalizeCascadeToken(effect.cascadeTag));
        }
      }
    }

    return freezeReadonlyArray([...tags].sort());
  }

  public getRecoveryTagUniverseReport(): CascadeRecoveryTagUniverseReport {
    const recoveryTagsByTemplate = {} as Record<CascadeTemplateId, readonly string[]>;
    const cascadeTagsByTemplate = {} as Record<CascadeTemplateId, readonly string[]>;
    const recoveryTagFreqMap = new Map<string, number>();
    const cascadeTagFreqMap = new Map<string, number>();

    for (const templateId of CASCADE_TEMPLATE_IDS) {
      const template = this.templates[templateId];
      const rTags = normalizeCascadeTokenBag([
        ...template.recoveryTags,
        ...deriveRecoveryTagsFromConditions(template.recovery),
      ]);
      const cTags = normalizeCascadeTokenBag(
        template.effects
          .map((e) => e.cascadeTag)
          .filter((t): t is string => typeof t === 'string'),
      );

      recoveryTagsByTemplate[templateId] = rTags;
      cascadeTagsByTemplate[templateId] = cTags;

      for (const tag of rTags) {
        recoveryTagFreqMap.set(tag, (recoveryTagFreqMap.get(tag) ?? 0) + 1);
      }
      for (const tag of cTags) {
        cascadeTagFreqMap.set(tag, (cascadeTagFreqMap.get(tag) ?? 0) + 1);
      }
    }

    const toFreqArray = (
      m: Map<string, number>,
    ): ReadonlyArray<{ readonly tag: string; readonly count: number }> =>
      Object.freeze(
        [...m.entries()]
          .map(([tag, count]) => Object.freeze({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      );

    return Object.freeze({
      allTags: this.getRecoveryTagUniverse(),
      allCascadeTags: this.getCascadeTagUniverse(),
      recoveryTagsByTemplate: Object.freeze(recoveryTagsByTemplate),
      cascadeTagsByTemplate: Object.freeze(cascadeTagsByTemplate),
      recoveryTagFrequency: toFreqArray(recoveryTagFreqMap),
      cascadeTagFrequency: toFreqArray(cascadeTagFreqMap),
    });
  }

  public findTemplatesByRecoveryTag(tag: string): readonly CascadeTemplateId[] {
    const normalized = normalizeCascadeToken(tag);
    return CASCADE_TEMPLATE_IDS.filter((id) => {
      const template = this.templates[id];
      const recoveryTags = normalizeCascadeTokenBag(template.recoveryTags);
      const derivedTags = normalizeCascadeTokenBag(
        deriveRecoveryTagsFromConditions(template.recovery),
      );
      return recoveryTags.includes(normalized) || derivedTags.includes(normalized);
    });
  }

  public findTemplatesByRecoveryKind(kind: RecoveryConditionKind): readonly CascadeTemplateId[] {
    if (!KNOWN_RECOVERY_KINDS.includes(kind)) {
      return Object.freeze([]);
    }
    return CASCADE_TEMPLATE_IDS.filter((id) =>
      this.templates[id].recovery.some((c) => c.kind === kind),
    );
  }

  public findTemplatesByCascadeTag(tag: string): readonly CascadeTemplateId[] {
    const normalized = normalizeCascadeToken(tag);
    return CASCADE_TEMPLATE_IDS.filter((id) =>
      this.templates[id].effects.some(
        (e) => e.cascadeTag && normalizeCascadeToken(e.cascadeTag) === normalized,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Effect Profiling (used by ML signal generation)
  // ---------------------------------------------------------------------------

  public computeEffectProfile(
    templateId: CascadeTemplateId | string,
  ): CascadeTemplateEffectProfile {
    const tId = templateId as CascadeTemplateId;

    if (!this._effectProfileCache) {
      this._effectProfileCache = new Map();
    }

    const cached = this._effectProfileCache.get(tId);
    if (cached) {
      return cached;
    }

    const template = this.get(tId);
    let totalCash = 0;
    let totalDebt = 0;
    let totalIncome = 0;
    let totalHeat = 0;
    let totalShield = 0;
    let totalTrust = 0;
    let totalTime = 0;
    let totalDivergence = 0;
    let hasCardInjections = false;
    let hasCardExhausts = false;
    let hasBadgeGrants = false;
    let hasNamedActions = false;

    const cascadeTagSet = new Set<string>();
    const cascadeTagSeq: string[] = [];

    for (const effect of template.effects) {
      totalCash += effect.cashDelta ?? 0;
      totalDebt += effect.debtDelta ?? 0;
      totalIncome += effect.incomeDelta ?? 0;
      totalHeat += effect.heatDelta ?? 0;
      totalShield += effect.shieldDelta ?? 0;
      totalTrust += effect.trustDelta ?? 0;
      totalTime += effect.timeDeltaMs ?? 0;
      totalDivergence += effect.divergenceDelta ?? 0;

      if (effect.injectCards && effect.injectCards.length > 0) {
        hasCardInjections = true;
      }
      if (effect.exhaustCards && effect.exhaustCards.length > 0) {
        hasCardExhausts = true;
      }
      if (effect.grantBadges && effect.grantBadges.length > 0) {
        hasBadgeGrants = true;
      }
      if (effect.namedActionId) {
        hasNamedActions = true;
      }
      if (effect.cascadeTag) {
        cascadeTagSet.add(normalizeCascadeToken(effect.cascadeTag));
        cascadeTagSeq.push(normalizeCascadeToken(effect.cascadeTag));
      }
    }

    const netEconomicImpact = totalCash + totalIncome * 4 - totalDebt;
    const economicSeverityScore = this.computeEconomicSeverityScore(
      totalCash,
      totalIncome,
      totalDebt,
      template.severity,
    );
    const shieldSeverityScore = this.computeShieldSeverityScore(totalShield, template.severity);
    const trustSeverityScore = this.computeTrustSeverityScore(totalTrust, template.severity);
    const combinedSeverityScore = this.weightedSeverityScore(
      economicSeverityScore,
      shieldSeverityScore,
      trustSeverityScore,
      totalHeat,
      totalDivergence,
    );

    const profile: CascadeTemplateEffectProfile = Object.freeze({
      templateId: tId,
      totalCashImpact: totalCash,
      totalDebtImpact: totalDebt,
      totalIncomeImpact: totalIncome,
      totalHeatImpact: totalHeat,
      totalShieldImpact: totalShield,
      totalTrustImpact: totalTrust,
      totalTimeDeltaMs: totalTime,
      totalDivergenceImpact: totalDivergence,
      linkCount: template.effects.length,
      hasCardInjections,
      hasCardExhausts,
      hasBadgeGrants,
      uniqueCascadeTags: Object.freeze([...cascadeTagSet].sort()),
      cascadeTagSequence: Object.freeze(cascadeTagSeq),
      hasNamedActions,
      netEconomicImpact,
      economicSeverityScore,
      shieldSeverityScore,
      trustSeverityScore,
      combinedSeverityScore,
    });

    this._effectProfileCache.set(tId, profile);
    return profile;
  }

  public getAllEffectProfiles(): readonly CascadeTemplateEffectProfile[] {
    return CASCADE_TEMPLATE_IDS.map((id) => this.computeEffectProfile(id));
  }

  // ---------------------------------------------------------------------------
  // ML Signal Generation
  // ---------------------------------------------------------------------------

  /**
   * Generates a deterministic ML feature signal for a template.
   * Used by the CascadeEngine to feed into pressure-adaptive scheduling
   * and by external ML/DL consumers for cascade pattern analysis.
   *
   * Feature vector layout:
   *   [0]  polarity (0=negative, 1=positive)
   *   [1]  severity rank (0–3)
   *   [2]  link density (0–1 normalized)
   *   [3]  pressure amplification range
   *   [4]  mode variance
   *   [5]  recovery complexity
   *   [6]  economic pressure score
   *   [7]  shield pressure score
   *   [8]  trust pressure score
   *   [9]  timer pressure score
   *   [10] total effect magnitude
   *   [11] has layer affinity (0/1)
   *   [12] layer affinity rank (0–3)
   *   [13] recovery tag count (normalized)
   *   [14] recovery condition count (normalized)
   *   [15] is one-shot (0/1)
   *   [16] is proof-bearing (0/1)
   *   [17–19] phase presence vector (FOUNDATION, ESCALATION, SOVEREIGNTY)
   *   [20–23] mode offset vector (solo, pvp, coop, ghost)
   *   [24–28] pressure scalar vector (T0–T4)
   */
  public computeMLSignal(templateId: CascadeTemplateId | string): CascadeTemplateMLSignal {
    const tId = templateId as CascadeTemplateId;

    if (!this._mlSignalCache) {
      this._mlSignalCache = new Map();
    }

    const cached = this._mlSignalCache.get(tId);
    if (cached) {
      return cached;
    }

    const template = this.get(tId);
    const profile = this.computeEffectProfile(tId);
    const layerAffinity = this.resolveLayerAffinity(tId);

    const polarityCode = template.positive ? 1 : 0;
    const severityRank = getCascadeSeverityRank(template.severity) / 3;
    const linkDensity = Math.min(1, template.effects.length / 6);

    const pressureRange = this.computePressureAmplificationRange(template);
    const modeVariance = this.computeModeVariance(template);
    const recoveryComplexity = this.computeRecoveryComplexity(template);

    const economicPressureScore = this.normalizeSeverityScore(profile.economicSeverityScore);
    const shieldPressureScore = this.normalizeSeverityScore(profile.shieldSeverityScore);
    const trustPressureScore = this.normalizeSeverityScore(profile.trustSeverityScore);
    const timerPressureScore = Math.min(1, Math.abs(profile.totalTimeDeltaMs) / 1000);
    const totalMagnitude = this.normalizeSeverityScore(profile.combinedSeverityScore);

    const hasLayerAffinityFlag = layerAffinity !== null ? 1 : 0;
    const layerAffinityRank = this.resolveLayerAffinityRank(layerAffinity);

    const recoveryTagCount = Math.min(1, template.recoveryTags.length / 6);
    const recoveryConditionCount = Math.min(1, template.recovery.length / 5);

    const isOneShotFlag = template.oneShot === true ? 1 : 0;
    const isProofBearingFlag = template.proofBearing === true ? 1 : 0;

    const phasePresenceVector: number[] = SUPPORTED_PHASES.map(
      (phase) => (template.phaseScalar?.[phase] ?? PHASE_SCALARS_REFERENCE[phase]) - 1,
    );

    const modeOffsetVector: number[] = ALL_MODE_CODES.map(
      (mode) => (template.modeOffsetModifier?.[mode] ?? MODE_OFFSET_REFERENCE[mode]) / 3,
    );

    const pressureScalarVector: number[] = PRESSURE_TIERS.map(
      (tier) => (template.pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier]) - 1,
    );

    const featureVector: number[] = [
      polarityCode,
      severityRank,
      linkDensity,
      pressureRange,
      modeVariance,
      recoveryComplexity,
      economicPressureScore,
      shieldPressureScore,
      trustPressureScore,
      timerPressureScore,
      totalMagnitude,
      hasLayerAffinityFlag,
      layerAffinityRank / 3,
      recoveryTagCount,
      recoveryConditionCount,
      isOneShotFlag,
      isProofBearingFlag,
      ...phasePresenceVector,
      ...modeOffsetVector,
      ...pressureScalarVector,
    ];

    const signal: CascadeTemplateMLSignal = Object.freeze({
      templateId: tId,
      polarityCode,
      severityRank,
      linkDensity,
      pressureAmplificationRange: pressureRange,
      modeVariance,
      recoveryComplexity,
      economicPressureScore,
      shieldPressureScore,
      trustPressureScore,
      timerPressureScore,
      totalEffectMagnitude: totalMagnitude,
      hasLayerAffinity: layerAffinity !== null,
      layerAffinityRank,
      recoveryTagCount: template.recoveryTags.length,
      recoveryConditionCount: template.recovery.length,
      isOneShot: template.oneShot === true,
      isProofBearing: template.proofBearing === true,
      phasePresenceVector: Object.freeze(phasePresenceVector),
      modeOffsetVector: Object.freeze(modeOffsetVector),
      pressureScalarVector: Object.freeze(pressureScalarVector),
      featureVector: Object.freeze(featureVector),
    });

    this._mlSignalCache.set(tId, signal);
    return signal;
  }

  public getAllMLSignals(): readonly CascadeTemplateMLSignal[] {
    return CASCADE_TEMPLATE_IDS.map((id) => this.computeMLSignal(id));
  }

  /**
   * Returns a ranked list of templates by overall ML pressure score,
   * which the engine uses for priority-ordering in dense cascade ticks.
   */
  public getRankedTemplatesByMLPressure(): readonly CascadeTemplateRankingEntry[] {
    const entries: CascadeTemplateRankingEntry[] = CASCADE_TEMPLATE_IDS.map((id) => {
      const signal = this.computeMLSignal(id);
      const template = this.templates[id];
      const profile = this.computeEffectProfile(id);

      const economicWeight = template.positive
        ? -profile.netEconomicImpact / Math.max(1, SEVERITY_ECONOMIC_BASELINE[template.severity])
        : Math.abs(profile.netEconomicImpact) / Math.max(1, SEVERITY_ECONOMIC_BASELINE[template.severity]);

      const shieldWeight = template.positive
        ? -profile.totalShieldImpact / 20
        : Math.abs(profile.totalShieldImpact) / 20;

      const severityWeight = getCascadeSeverityRank(template.severity);
      const polarityScore = template.positive ? 1 : -1;

      const overallRank = (
        severityWeight * ML_SEVERITY_WEIGHT +
        signal.economicPressureScore * ML_ECONOMIC_WEIGHT +
        signal.shieldPressureScore * ML_SHIELD_WEIGHT +
        signal.pressureAmplificationRange * ML_PRESSURE_SCALAR_WEIGHT +
        signal.recoveryComplexity * ML_RECOVERY_COMPLEXITY_WEIGHT +
        signal.timerPressureScore * ML_TIMING_WEIGHT
      );

      return Object.freeze({
        templateId: id,
        severityRank: getCascadeSeverityRank(template.severity),
        polarityScore,
        economicWeight,
        shieldWeight,
        overallRank,
      });
    });

    return Object.freeze(
      entries.sort((a, b) => b.overallRank - a.overallRank),
    );
  }

  // ---------------------------------------------------------------------------
  // Mode / Pressure Matrix Analysis
  // ---------------------------------------------------------------------------

  public getModePressureMatrix(): CascadeModePressureMatrix {
    const cells: Array<CascadeModePressureMatrix['cells'][number]> = [];

    for (const mode of ALL_MODE_CODES) {
      for (const tier of PRESSURE_TIERS) {
        const matchingTemplates = CASCADE_TEMPLATE_IDS.filter((id) => {
          const template = this.templates[id];
          const modeOffset = template.modeOffsetModifier?.[mode] ?? MODE_OFFSET_REFERENCE[mode];
          const pressureScalar = template.pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier];
          return modeOffset !== 0 || pressureScalar > 1;
        });

        const scalars = matchingTemplates.map(
          (id) => this.templates[id].pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier],
        );

        const avgScalar = scalars.length > 0
          ? scalars.reduce((a, b) => a + b, 0) / scalars.length
          : PRESSURE_SCALARS_REFERENCE[tier];

        const maxScalar = scalars.length > 0 ? Math.max(...scalars) : PRESSURE_SCALARS_REFERENCE[tier];
        const minScalar = scalars.length > 0 ? Math.min(...scalars) : PRESSURE_SCALARS_REFERENCE[tier];

        const negCount = matchingTemplates.filter((id) => !this.templates[id].positive).length;
        const posCount = matchingTemplates.filter((id) => this.templates[id].positive).length;

        cells.push(Object.freeze({
          mode,
          tier,
          templateIds: Object.freeze(matchingTemplates),
          averageScalar: Math.round(avgScalar * 10000) / 10000,
          maxScalar: Math.round(maxScalar * 10000) / 10000,
          minScalar: Math.round(minScalar * 10000) / 10000,
          negativeCount: negCount,
          positiveCount: posCount,
        }));
      }
    }

    return Object.freeze({
      modes: Object.freeze([...ALL_MODE_CODES]),
      tiers: Object.freeze([...PRESSURE_TIERS]),
      cells: Object.freeze(cells),
    });
  }

  public getLayerAffinityMap(): CascadeLayerAffinityMap {
    return Object.freeze({
      L1: this.layerTemplateMap.L1,
      L2: this.layerTemplateMap.L2,
      L3: this.layerTemplateMap.L3,
      L4: this.layerTemplateMap.L4,
      positiveTemplates: this.polaritySplit.positive,
    });
  }

  // ---------------------------------------------------------------------------
  // Severity-Based Analytics
  // ---------------------------------------------------------------------------

  public getTemplateSeverityRank(templateId: CascadeTemplateId | string): number {
    return getCascadeSeverityRank(this.get(templateId).severity);
  }

  public compareSeverity(
    templateIdA: CascadeTemplateId | string,
    templateIdB: CascadeTemplateId | string,
  ): number {
    return compareCascadeSeverity(
      this.get(templateIdA).severity,
      this.get(templateIdB).severity,
    );
  }

  public isAtLeastSeverity(
    templateId: CascadeTemplateId | string,
    minSeverity: CascadeSeverity,
  ): boolean {
    if (!isCascadeSeverity(minSeverity)) {
      return false;
    }
    return getCascadeSeverityRank(this.get(templateId).severity) >= getCascadeSeverityRank(minSeverity);
  }

  // ---------------------------------------------------------------------------
  // Describe / Diagnostic Surface
  // ---------------------------------------------------------------------------

  public describe(templateId: CascadeTemplateId | string): Readonly<{
    templateId: CascadeTemplateId;
    label: string;
    positive: boolean;
    polarity: CascadePolarity;
    severity: CascadeSeverity;
    layerAffinity: ShieldLayerId | null;
    maxConcurrent: number;
    maxTriggersPerRun: number;
    recoveryKinds: readonly string[];
    pressureAmplifiedTiers: readonly PressureTier[];
    modeShiftedModes: readonly ModeCode[];
    oneShot: boolean;
    proofBearing: boolean;
    linkCount: number;
    recoveryConditionCount: number;
    recoveryTagCount: number;
    isPositiveTemplateId: boolean;
    isNegativeTemplateId: boolean;
    isLayerBound: boolean;
  }> {
    const template = this.get(templateId);
    const layerAffinity = this.resolveLayerAffinity(template.templateId);
    const polarity = getCascadeTemplatePolarity(template.templateId);

    return Object.freeze({
      templateId: template.templateId,
      label: template.label,
      positive: template.positive,
      polarity,
      severity: template.severity,
      layerAffinity,
      maxConcurrent: template.maxConcurrent,
      maxTriggersPerRun: template.maxTriggersPerRun,
      recoveryKinds: freezeReadonlyArray(template.recovery.map((condition) => condition.kind)),
      pressureAmplifiedTiers: freezeReadonlyArray(
        PRESSURE_TIERS.filter(
          (tier) => (template.pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier]) > 1,
        ),
      ),
      modeShiftedModes: freezeReadonlyArray(
        ALL_MODE_CODES.filter(
          (mode) => (template.modeOffsetModifier?.[mode] ?? MODE_OFFSET_REFERENCE[mode]) !== 0,
        ),
      ),
      oneShot: template.oneShot === true,
      proofBearing: template.proofBearing === true,
      linkCount: template.effects.length,
      recoveryConditionCount: template.recovery.length,
      recoveryTagCount: template.recoveryTags.length,
      isPositiveTemplateId: isPositiveCascadeTemplateId(template.templateId),
      isNegativeTemplateId: isNegativeCascadeTemplateId(template.templateId),
      isLayerBound: this.isLayerBoundTemplate(template.templateId),
    });
  }

  public getDiagnostics(): CascadeRegistryDiagnostics {
    const issues: string[] = [];
    let catalogValid = true;
    let layerMapComplete = true;
    let dedupeKeyUnique = true;
    let allEffectsNonEmpty = true;
    let allRecoveryConditionsPresent = true;

    const seenDedupeKeys = new Set<string>();
    for (const id of CASCADE_TEMPLATE_IDS) {
      const t = this.templates[id];
      if (seenDedupeKeys.has(t.dedupeKey)) {
        dedupeKeyUnique = false;
        catalogValid = false;
        issues.push(`Duplicate dedupe key: ${t.dedupeKey} (template ${id})`);
      }
      seenDedupeKeys.add(t.dedupeKey);

      if (t.effects.every((e) => this.isEffectEmpty(e))) {
        allEffectsNonEmpty = false;
        catalogValid = false;
        issues.push(`Template ${id} has all-empty effects`);
      }

      if (!t.positive && t.recovery.length === 0 && t.recoveryTags.length === 0) {
        allRecoveryConditionsPresent = false;
        catalogValid = false;
        issues.push(`Negative template ${id} has no recovery conditions`);
      }
    }

    for (const layerId of ALL_SHIELD_LAYERS) {
      if (!this.layerTemplateMap[layerId]) {
        layerMapComplete = false;
        catalogValid = false;
        issues.push(`Layer map missing: ${layerId}`);
      }
    }

    return Object.freeze({
      catalogValid,
      templateCount: CASCADE_TEMPLATE_IDS.length,
      issueCount: issues.length,
      issues: Object.freeze(issues),
      layerMapComplete,
      dedupeKeyUnique,
      allEffectsNonEmpty,
      allRecoveryConditionsPresent,
    });
  }

  /**
   * Produces a lightweight catalog validation result.
   * Uses all validation types from types.ts.
   */
  public validateManifest(): CascadeManifestValidationResult {
    const issuesByTemplate = {} as Record<string, CascadeTemplateValidationIssue[]>;
    const allIssues: CascadeTemplateValidationIssue[] = [];
    const validationResults: CascadeTemplateValidationResult[] = [];

    for (const templateId of CASCADE_TEMPLATE_IDS) {
      const result = this.validateTemplate(templateId);
      validationResults.push(result);
      issuesByTemplate[templateId] = [...result.issues];
      allIssues.push(...result.issues);
    }

    // Cross-template dedupe key check
    const dedupeKeys = new Map<string, CascadeTemplateId>();
    for (const templateId of CASCADE_TEMPLATE_IDS) {
      const key = this.templates[templateId].dedupeKey;
      const existing = dedupeKeys.get(key);
      if (existing) {
        const crossIssue: CascadeTemplateValidationIssue = {
          code: 'DUPLICATE_TEMPLATE_ID',
          severity: 'ERROR',
          message: `Dedupe key '${key}' shared between ${existing} and ${templateId}.`,
          templateId,
          field: 'dedupeKey',
          notes: Object.freeze([]),
        };
        allIssues.push(crossIssue);
        if (!issuesByTemplate[templateId]) {
          issuesByTemplate[templateId] = [];
        }
        issuesByTemplate[templateId]?.push(crossIssue);
      } else {
        dedupeKeys.set(key, templateId);
      }
    }

    const valid = allIssues.every((issue) => issue.severity !== 'ERROR');
    const summary = this.getManifestSummary();

    return Object.freeze({
      valid,
      issues: Object.freeze(allIssues),
      byTemplateId: Object.freeze(
        Object.fromEntries(
          Object.entries(issuesByTemplate).map(([k, v]) => [k, Object.freeze(v)]),
        ),
      ) as Readonly<Record<string, readonly CascadeTemplateValidationIssue[]>>,
      summary,
    });
  }

  public validateTemplate(templateId: CascadeTemplateId | string): CascadeTemplateValidationResult {
    const issues: CascadeTemplateValidationIssue[] = [];

    if (!this.has(templateId)) {
      issues.push({
        code: 'UNKNOWN_TEMPLATE_ID',
        severity: 'ERROR',
        message: `Template '${templateId}' is not registered in the catalog.`,
        templateId,
        field: 'templateId',
        notes: Object.freeze([]),
      });
      return Object.freeze({
        valid: false,
        issues: Object.freeze(issues),
        errors: Object.freeze(issues.filter((i) => i.severity === 'ERROR')),
        warnings: Object.freeze(issues.filter((i) => i.severity === 'WARNING')),
      });
    }

    const template = this.get(templateId);

    // Polarity consistency
    if (isCascadeTemplateId(templateId)) {
      const expectedPolarity = _POLARITY_MAP[templateId];
      const authoredPolarity = template.authoredPolarity;
      if (authoredPolarity && authoredPolarity !== expectedPolarity) {
        issues.push({
          code: 'POLARITY_MISMATCH',
          severity: 'ERROR',
          message: `Template ${templateId}: authoredPolarity='${authoredPolarity}' disagrees with catalog polarity '${expectedPolarity}'.`,
          templateId,
          field: 'authoredPolarity',
          notes: Object.freeze([]),
        });
      }
    }

    // Label
    if (!template.label.trim()) {
      issues.push({
        code: 'EMPTY_LABEL',
        severity: 'ERROR',
        message: `Template ${templateId} is missing a non-empty label.`,
        templateId,
        field: 'label',
        notes: Object.freeze([]),
      });
    }

    // Dedupe key
    if (!template.dedupeKey.trim()) {
      issues.push({
        code: 'EMPTY_DEDUPE_KEY',
        severity: 'ERROR',
        message: `Template ${templateId} is missing a dedupe key.`,
        templateId,
        field: 'dedupeKey',
        notes: Object.freeze([]),
      });
    }

    // Concurrency
    if (template.maxConcurrent <= 0) {
      issues.push({
        code: 'NON_POSITIVE_MAX_CONCURRENT',
        severity: 'ERROR',
        message: `Template ${templateId} must have maxConcurrent > 0.`,
        templateId,
        field: 'maxConcurrent',
        notes: Object.freeze([]),
      });
    }

    if (template.maxTriggersPerRun <= 0) {
      issues.push({
        code: 'NON_POSITIVE_MAX_TRIGGERS_PER_RUN',
        severity: 'ERROR',
        message: `Template ${templateId} must have maxTriggersPerRun > 0.`,
        templateId,
        field: 'maxTriggersPerRun',
        notes: Object.freeze([]),
      });
    }

    // ─── Default deviation advisories (TEMPLATE_DEFAULTS) ────────────────────
    // Templates with maxConcurrent or maxTriggersPerRun far above canonical
    // defaults can overwhelm the cascade scheduler, especially in co-op and pvp
    // modes where multiple chains compete for the same scheduling budget.
    // Defaults: maxConcurrent=${TEMPLATE_DEFAULTS.maxConcurrent}, maxTriggersPerRun=${TEMPLATE_DEFAULTS.maxTriggersPerRun}.
    if (template.maxConcurrent > TEMPLATE_DEFAULTS.maxConcurrent * 4) {
      issues.push({
        code: 'UNKNOWN',
        severity: 'WARNING',
        message: `Template ${templateId}: maxConcurrent=${template.maxConcurrent} is ${template.maxConcurrent}x the default (${TEMPLATE_DEFAULTS.maxConcurrent}).`,
        templateId,
        field: 'maxConcurrent',
        notes: Object.freeze([
          'High concurrency limits increase scheduler pressure in multi-player runs.',
          `Default maxConcurrent is ${TEMPLATE_DEFAULTS.maxConcurrent}; values above 4 should be intentional.`,
        ]),
      });
    }

    if (template.maxTriggersPerRun > TEMPLATE_DEFAULTS.maxTriggersPerRun * 4) {
      issues.push({
        code: 'UNKNOWN',
        severity: 'WARNING',
        message: `Template ${templateId}: maxTriggersPerRun=${template.maxTriggersPerRun} is ${template.maxTriggersPerRun}x the default (${TEMPLATE_DEFAULTS.maxTriggersPerRun}).`,
        templateId,
        field: 'maxTriggersPerRun',
        notes: Object.freeze([
          'High trigger budgets reduce chain predictability across run sessions.',
          `Default maxTriggersPerRun is ${TEMPLATE_DEFAULTS.maxTriggersPerRun}; values above 4 should be intentional.`,
        ]),
      });
    }

    // Link set
    if (template.baseOffsets.length === 0) {
      issues.push({
        code: 'EMPTY_LINK_SET',
        severity: 'ERROR',
        message: `Template ${templateId} must define at least one scheduled offset.`,
        templateId,
        field: 'baseOffsets',
        notes: Object.freeze([]),
      });
    }

    // Offset / effect alignment
    if (template.baseOffsets.length !== template.effects.length) {
      issues.push({
        code: 'OFFSET_EFFECT_LENGTH_MISMATCH',
        severity: 'ERROR',
        message: `Template ${templateId} has ${template.baseOffsets.length} offsets but ${template.effects.length} effects.`,
        templateId,
        field: 'baseOffsets',
        notes: Object.freeze([]),
      });
    }

    // Negative offsets
    for (let i = 0; i < template.baseOffsets.length; i += 1) {
      const offset = template.baseOffsets[i];
      if (offset === undefined || offset < 0 || !Number.isInteger(offset)) {
        issues.push({
          code: 'NEGATIVE_OFFSET',
          severity: 'ERROR',
          message: `Template ${templateId} has invalid offset at index ${i}: ${String(offset)}.`,
          templateId,
          field: 'baseOffsets',
          notes: Object.freeze([]),
        });
      }
    }

    // Monotonic offsets
    for (let i = 1; i < template.baseOffsets.length; i += 1) {
      if ((template.baseOffsets[i] ?? 0) < (template.baseOffsets[i - 1] ?? 0)) {
        issues.push({
          code: 'UNSORTED_OFFSETS',
          severity: 'ERROR',
          message: `Template ${templateId} offsets must be non-decreasing.`,
          templateId,
          field: 'baseOffsets',
          notes: Object.freeze([]),
        });
        break;
      }
    }

    // Mode offset keys
    if (template.modeOffsetModifier) {
      for (const mode of Object.keys(template.modeOffsetModifier)) {
        if (!ALL_MODE_CODES.includes(mode as ModeCode)) {
          issues.push({
            code: 'INVALID_MODE_OFFSET_MODIFIER',
            severity: 'ERROR',
            message: `Template ${templateId} declares unsupported mode offset key: ${mode}.`,
            templateId,
            field: 'modeOffsetModifier',
            notes: Object.freeze([]),
          });
        }
      }
    }

    // Pressure scalar keys
    if (template.pressureScalar) {
      for (const tier of Object.keys(template.pressureScalar)) {
        if (!PRESSURE_TIERS.includes(tier as PressureTier)) {
          issues.push({
            code: 'INVALID_PRESSURE_SCALAR',
            severity: 'ERROR',
            message: `Template ${templateId} declares unsupported pressure scalar key: ${tier}.`,
            templateId,
            field: 'pressureScalar',
            notes: Object.freeze([]),
          });
        }
      }
    }

    // Phase scalar keys
    if (template.phaseScalar) {
      for (const phase of Object.keys(template.phaseScalar)) {
        if (!SUPPORTED_PHASES.includes(phase as CascadeSupportedPhase)) {
          issues.push({
            code: 'INVALID_PHASE_SCALAR',
            severity: 'ERROR',
            message: `Template ${templateId} declares unsupported phase scalar key: ${phase}.`,
            templateId,
            field: 'phaseScalar',
            notes: Object.freeze([]),
          });
        }
      }
    }

    // ─── Phase scalar default-deviation advisory (PHASE_SCALAR_DEFAULTS) ─────
    // Phase scalar values more than 2.5× above the phase default indicate
    // aggressive amplification that can dominate effect totals in late-game
    // phases, making SOVEREIGNTY-phase chains disproportionately punishing.
    if (template.phaseScalar) {
      for (const phase of SUPPORTED_PHASES) {
        const authored = template.phaseScalar[phase];
        if (authored === undefined) {
          continue;
        }
        const defaultValue = PHASE_SCALAR_DEFAULTS[phase] ?? 1;
        if (authored > defaultValue * 2.5) {
          issues.push({
            code: 'UNKNOWN',
            severity: 'WARNING',
            message: `Template ${templateId}: phaseScalar[${phase}]=${authored.toFixed(2)} is ${(authored / defaultValue).toFixed(1)}x the default (${defaultValue}).`,
            templateId,
            field: 'phaseScalar',
            notes: Object.freeze([
              `Phase "${phase}" default scalar is ${defaultValue}.`,
              'Large phase scalar deviations can dominate effect totals in late-game runs.',
            ]),
          });
        }
      }
    }

    // Recovery tags on positives
    if (template.positive) {
      if (template.recovery.length > 0) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: `Positive template ${templateId} must not declare recovery conditions.`,
          templateId,
          field: 'recovery',
          notes: Object.freeze([]),
        });
      }
      if (template.recoveryTags.length > 0) {
        issues.push({
          code: 'EMPTY_RECOVERY_TAG',
          severity: 'ERROR',
          message: `Positive template ${templateId} must not declare recoveryTags.`,
          templateId,
          field: 'recoveryTags',
          notes: Object.freeze([]),
        });
      }
    }

    // Negative must have recovery
    if (!template.positive && template.recovery.length === 0 && template.recoveryTags.length === 0) {
      issues.push({
        code: 'INVALID_RECOVERY_CONDITION',
        severity: 'ERROR',
        message: `Negative template ${templateId} must declare recovery conditions or recovery tags.`,
        templateId,
        field: 'recovery',
        notes: Object.freeze([]),
      });
    }

    // Warn on missing telemetry tags
    if (!template.telemetryTags || template.telemetryTags.length === 0) {
      issues.push({
        code: 'UNKNOWN',
        severity: 'WARNING',
        message: `Template ${templateId} has no telemetryTags — recommended for observability.`,
        templateId,
        field: 'telemetryTags',
        notes: Object.freeze(['Add appropriate tags from CASCADE_TELEMETRY_TAGS for monitoring.']),
      });
    }

    // Warn on missing trigger families
    if (!template.triggerFamilies || template.triggerFamilies.length === 0) {
      issues.push({
        code: 'UNKNOWN',
        severity: 'WARNING',
        message: `Template ${templateId} has no triggerFamilies — recommended for routing diagnostics.`,
        templateId,
        field: 'triggerFamilies',
        notes: Object.freeze(['Add appropriate entries from CASCADE_TRIGGER_FAMILIES.']),
      });
    }

    // Validate trigger families against allowed values
    if (template.triggerFamilies) {
      for (const family of template.triggerFamilies) {
        if (!VALID_TRIGGER_FAMILIES.includes(family)) {
          issues.push({
            code: 'UNKNOWN',
            severity: 'WARNING',
            message: `Template ${templateId} uses unrecognized trigger family '${String(family)}'.`,
            templateId,
            field: 'triggerFamilies',
            notes: Object.freeze([`Known families: ${VALID_TRIGGER_FAMILIES.join(', ')}`]),
          });
        }
      }
    }

    // Validate trigger facets
    if (template.triggerFacets) {
      for (const facet of template.triggerFacets) {
        if (!VALID_TRIGGER_FACETS.includes(facet)) {
          issues.push({
            code: 'UNKNOWN',
            severity: 'WARNING',
            message: `Template ${templateId} uses unrecognized trigger facet '${String(facet)}'.`,
            templateId,
            field: 'triggerFacets',
            notes: Object.freeze([`Known facets: ${VALID_TRIGGER_FACETS.join(', ')}`]),
          });
        }
      }
    }

    // Validate telemetry tags
    if (template.telemetryTags) {
      for (const tag of template.telemetryTags) {
        if (!VALID_TELEMETRY_TAGS.includes(tag)) {
          issues.push({
            code: 'UNKNOWN',
            severity: 'WARNING',
            message: `Template ${templateId} uses unrecognized telemetry tag '${String(tag)}'.`,
            templateId,
            field: 'telemetryTags',
            notes: Object.freeze([`Known tags: ${VALID_TELEMETRY_TAGS.join(', ')}`]),
          });
        }
      }
    }

    // ─── Recovery condition kind cross-check (RECOVERY_COMPARATORS) ──────────
    // Every recovery condition kind must have a registered comparator in
    // RECOVERY_COMPARATORS.  An unrecognized kind silently produces EMPTY_INPUT
    // at evaluation time — the chain becomes permanently unrecoverable with no
    // error surfaced to the player.  Catching this here prevents silent traps.
    for (const rc of template.recovery) {
      if (!(rc.kind in RECOVERY_COMPARATORS)) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'ERROR',
          message: `Template ${templateId}: recovery condition kind '${String(rc.kind)}' has no registered comparator.`,
          templateId,
          field: 'recovery',
          notes: Object.freeze([
            `Known comparator kinds: ${Object.keys(RECOVERY_COMPARATORS).join(', ')}`,
          ]),
        });
      }
    }

    // ─── Recovery status token advisory (RECOVERY_STATUS_TOKENS) ─────────────
    // Negative templates where every recovery condition is PRESSURE_NOT_ABOVE
    // become impossible to escape under sustained T3/T4 pressure — a UX trap
    // that locks the player into cascading losses with no viable recovery path.
    if (!template.positive && template.recovery.length > 0) {
      const onlyPressureGated = template.recovery.every((rc) => rc.kind === 'PRESSURE_NOT_ABOVE');
      if (onlyPressureGated) {
        issues.push({
          code: 'INVALID_RECOVERY_CONDITION',
          severity: 'WARNING',
          message: `Template ${templateId}: all recovery uses PRESSURE_NOT_ABOVE — chain may become inescapable under T3/T4 pressure.`,
          templateId,
          field: 'recovery',
          notes: Object.freeze([
            `Valid recovery evaluation statuses: ${RECOVERY_STATUS_TOKENS.join(', ')}`,
            'Mix in CASH_MIN, CARD_TAG_ANY, or HEAT_MAX for pressure-independent escape paths.',
          ]),
        });
      }
    }

    // ─── Positive evaluation state advisory (POSITIVE_EVAL_STATES) ───────────
    // Positive templates with no triggerFamilies cannot route to ELIGIBLE state
    // in the evaluator — they remain stuck in INELIGIBLE for the entire run,
    // never granting the player the opportunity window they were designed to give.
    if (template.positive && (template.triggerFamilies?.length ?? 0) === 0) {
      issues.push({
        code: 'UNKNOWN',
        severity: 'WARNING',
        message: `Positive template ${templateId}: no triggerFamilies declared — template will remain INELIGIBLE in all runs.`,
        templateId,
        field: 'triggerFamilies',
        notes: Object.freeze([
          `Positive cascade evaluation states: ${POSITIVE_EVAL_STATES.join(', ')}`,
          'Add triggerFamilies entries to enable ELIGIBLE evaluation during run progression.',
        ]),
      });
    }

    // ─── Issue code meta-validation (KNOWN_VALIDATION_CODES) ─────────────────
    // Confirm all issue codes pushed above are in the canonical vocabulary.
    // Prevents silent failures from typos in issue code strings or version
    // mismatches between the registry and the types module.
    {
      const knownCodesSet = new Set<string>(KNOWN_VALIDATION_CODES);
      const snapshotLen = issues.length;
      for (let i = 0; i < snapshotLen; i += 1) {
        const issue = issues[i]!;
        if (!knownCodesSet.has(issue.code as string)) {
          issues.push({
            code: 'UNKNOWN',
            severity: 'WARNING',
            message: `Template ${templateId}: issue code '${issue.code}' is not in the registered vocabulary.`,
            templateId,
            field: issue.field,
            notes: Object.freeze([
              'Unregistered codes indicate a registry–types version mismatch.',
              `Registered codes: ${KNOWN_VALIDATION_CODES.slice(0, 8).join(', ')}...`,
            ]),
          });
        }
      }
    }

    const errors = issues.filter((i) => i.severity === 'ERROR');
    const warnings = issues.filter((i) => i.severity === 'WARNING');

    return Object.freeze({
      valid: errors.length === 0,
      issues: Object.freeze(issues),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
    });
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private resolveLayerAffinity(templateId: CascadeTemplateId): ShieldLayerId | null {
    for (const layerId of ALL_SHIELD_LAYERS) {
      if (this.layerTemplateMap[layerId] === templateId) {
        return layerId;
      }
    }
    return null;
  }

  private resolveLayerAffinityRank(layerId: ShieldLayerId | null): number {
    if (!layerId) {
      return 0;
    }
    return ALL_SHIELD_LAYERS.indexOf(layerId);
  }

  private computePressureAmplificationRange(template: CascadeTemplate): number {
    const scalars = PRESSURE_TIERS.map(
      (tier) => template.pressureScalar?.[tier] ?? PRESSURE_SCALARS_REFERENCE[tier],
    );
    const maxScalar = Math.max(...scalars);
    const minScalar = Math.min(...scalars);
    return Math.min(1, Math.max(0, maxScalar - minScalar));
  }

  private computeModeVariance(template: CascadeTemplate): number {
    const offsets = ALL_MODE_CODES.map(
      (mode) => template.modeOffsetModifier?.[mode] ?? MODE_OFFSET_REFERENCE[mode],
    );
    const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
    const variance = offsets.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / offsets.length;
    return Math.min(1, Math.sqrt(variance) / 2);
  }

  private computeRecoveryComplexity(template: CascadeTemplate): number {
    if (template.positive) {
      return 0;
    }
    const kindCount = collectRecoveryConditionKinds(template.recovery).length;
    const tagCount = template.recoveryTags.length;
    return Math.min(1, (kindCount * 0.15 + tagCount * 0.05));
  }

  private computeEconomicSeverityScore(
    cashDelta: number,
    incomeDelta: number,
    debtDelta: number,
    severity: CascadeSeverity,
  ): number {
    const baseline = SEVERITY_ECONOMIC_BASELINE[severity];
    const raw = Math.abs(cashDelta) + Math.abs(incomeDelta) * 4 + Math.abs(debtDelta);
    return Math.min(3, raw / Math.max(1, baseline));
  }

  private computeShieldSeverityScore(shieldDelta: number, severity: CascadeSeverity): number {
    const weight = SEVERITY_DEFAULT_SCALARS[severity];
    return Math.min(3, Math.abs(shieldDelta) * weight / 10);
  }

  private computeTrustSeverityScore(trustDelta: number, severity: CascadeSeverity): number {
    const weight = SEVERITY_DEFAULT_SCALARS[severity];
    return Math.min(3, Math.abs(trustDelta) * weight / 5);
  }

  private weightedSeverityScore(
    economic: number,
    shield: number,
    trust: number,
    heat: number,
    divergence: number,
  ): number {
    return (
      economic * ML_ECONOMIC_WEIGHT +
      shield * ML_SHIELD_WEIGHT +
      trust * ML_RECOVERY_COMPLEXITY_WEIGHT +
      (Math.abs(heat) / 10) * ML_TIMING_WEIGHT +
      (Math.abs(divergence) / 5) * 0.04
    );
  }

  private normalizeSeverityScore(score: number): number {
    return Math.min(1, Math.max(0, score / 3));
  }

  private isEffectEmpty(effect: CascadeTemplate['effects'][number]): boolean {
    const numericFields = EFFECT_FIELD_LABELS;
    const hasNumericSignal = numericFields.some((field) => {
      const value = (effect as unknown as Record<string, number | undefined>)[field];
      return value !== undefined && value !== 0;
    });
    const hasCardSignal = Boolean(
      (effect.injectCards?.length ?? 0) > 0 ||
      (effect.exhaustCards?.length ?? 0) > 0 ||
      (effect.grantBadges?.length ?? 0) > 0,
    );
    const hasNamedAction = Boolean(effect.namedActionId);
    const hasTag = Boolean(effect.cascadeTag);
    return !(hasNumericSignal || hasCardSignal || hasNamedAction || hasTag);
  }

  private validateCatalog(): void {
    const seenDedupeKeys = new Set<string>();

    for (const templateId of CASCADE_TEMPLATE_IDS) {
      const template = this.templates[templateId];

      if (template.templateId !== templateId) {
        throw new Error(
          `Cascade template key mismatch: registry key ${templateId} !== template.templateId ${template.templateId}`,
        );
      }

      if (!template.label.trim()) {
        throw new Error(`Cascade template ${templateId} is missing a non-empty label.`);
      }

      if (template.maxConcurrent <= 0) {
        throw new Error(`Cascade template ${templateId} must have maxConcurrent > 0.`);
      }

      if (template.maxTriggersPerRun <= 0) {
        throw new Error(`Cascade template ${templateId} must have maxTriggersPerRun > 0.`);
      }

      if (template.baseOffsets.length === 0) {
        throw new Error(`Cascade template ${templateId} must define at least one scheduled offset.`);
      }

      if (template.baseOffsets.length !== template.effects.length) {
        throw new Error(
          `Cascade template ${templateId} has ${template.baseOffsets.length} offsets but ${template.effects.length} effects.`,
        );
      }

      for (let index = 0; index < template.baseOffsets.length; index += 1) {
        const offset = template.baseOffsets[index];
        if (offset === undefined || !Number.isInteger(offset) || offset < 0) {
          throw new Error(
            `Cascade template ${templateId} has invalid base offset at index ${index}: ${String(offset)}.`,
          );
        }

        if (index > 0 && offset < (template.baseOffsets[index - 1] ?? 0)) {
          throw new Error(
            `Cascade template ${templateId} offsets must be non-decreasing for deterministic scheduling.`,
          );
        }
      }

      if (!template.dedupeKey.trim()) {
        throw new Error(`Cascade template ${templateId} is missing a dedupe key.`);
      }

      if (seenDedupeKeys.has(template.dedupeKey)) {
        throw new Error(
          `Cascade template ${templateId} reuses dedupe key ${template.dedupeKey}; dedupe keys must be unique.`,
        );
      }
      seenDedupeKeys.add(template.dedupeKey);

      if (template.positive && template.recovery.length > 0) {
        throw new Error(
          `Positive cascade template ${templateId} must not declare recovery conditions.`,
        );
      }

      if (template.positive && template.recoveryTags.length > 0) {
        throw new Error(
          `Positive cascade template ${templateId} must not declare recoveryTags.`,
        );
      }

      if (!template.positive && template.recovery.length === 0 && template.recoveryTags.length === 0) {
        throw new Error(
          `Negative cascade template ${templateId} must declare structured recovery or legacy recovery tags.`,
        );
      }

      if (template.modeOffsetModifier) {
        for (const mode of Object.keys(template.modeOffsetModifier)) {
          if (!ALL_MODE_CODES.includes(mode as ModeCode)) {
            throw new Error(`Cascade template ${templateId} declares unsupported mode offset key: ${mode}.`);
          }
        }
      }

      if (template.pressureScalar) {
        for (const tier of Object.keys(template.pressureScalar)) {
          if (!PRESSURE_TIERS.includes(tier as PressureTier)) {
            throw new Error(
              `Cascade template ${templateId} declares unsupported pressure scalar key: ${tier}.`,
            );
          }
        }
      }

      const effectlessTemplate = template.effects.every((effect) => this.isEffectEmpty(effect));
      if (effectlessTemplate) {
        throw new Error(`Cascade template ${templateId} must produce at least one meaningful effect.`);
      }

      for (const [index, effect] of template.effects.entries()) {
        if (this.isEffectEmpty(effect)) {
          throw new Error(`Cascade template ${templateId} has an empty effect payload at index ${index}.`);
        }
      }
    }

    for (const layerId of ALL_SHIELD_LAYERS) {
      const templateId = this.layerTemplateMap[layerId];
      if (!templateId) {
        throw new Error(`Layer template map is missing a cascade template for ${layerId}.`);
      }
      if (!(NEGATIVE_CASCADE_TEMPLATE_IDS as readonly CascadeTemplateId[]).includes(templateId)) {
        throw new Error(`Layer ${layerId} must map to a negative cascade template; received ${templateId}.`);
      }
    }

    for (const severity of ALL_SEVERITIES) {
      if (!this.severityIndex[severity]) {
        throw new Error(`Severity index is missing severity bucket ${severity}.`);
      }
    }

    for (const tier of PRESSURE_TIERS) {
      if (!this.pressureAmplifiedIndex[tier]) {
        throw new Error(`Pressure amplification index is missing tier bucket ${tier}.`);
      }
    }

    for (const mode of ALL_MODE_CODES) {
      if (!this.modeShiftedIndex[mode]) {
        throw new Error(`Mode-shifted index is missing mode bucket ${mode}.`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Type Guard Forwards (for external consumers)
  // ---------------------------------------------------------------------------

  public static isCascadeTemplateId(value: string): value is CascadeTemplateId {
    return isCascadeTemplateId(value);
  }

  public static isPositiveCascadeTemplateId(value: string): boolean {
    return isPositiveCascadeTemplateId(value);
  }

  public static isNegativeCascadeTemplateId(value: string): boolean {
    return isNegativeCascadeTemplateId(value);
  }
}

