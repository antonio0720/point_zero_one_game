/*
 * POINT ZERO ONE — BACKEND SHIELD ENGINE TYPES
 * /backend/src/game/engine/shield/types.ts
 *
 * Doctrine:
 * - backend shield simulation is authoritative and deterministic
 * - shield routing belongs exclusively to AttackRouter
 * - shield damage never writes economy consequences directly
 * - L4 breach emits downstream cascade signals; it does not hard-call CascadeEngine
 * - repair scheduling must be replay-safe and queue-bounded
 *
 * Extended doctrine (v2):
 * - shield UX text must be computed server-side for deterministic rendering
 * - shield diagnostics are first-class outputs, not afterthoughts
 * - ML feature extraction is replay-deterministic: no randomness, no Date.now()
 * - all scoring functions are pure: same input always yields same output
 * - every constant is wired to at least one exported function
 */

import type {
  AttackCategory,
  AttackEvent,
  ShieldLayerId,
  ShieldLayerLabel,
} from '../core/GamePrimitives';
import type { ShieldLayerState } from '../core/RunStateSnapshot';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — TYPE EXPORTS (all original types preserved)
// ─────────────────────────────────────────────────────────────────────────────

export type RepairLayerId = ShieldLayerId | 'ALL';

export type ShieldDoctrineAttackType =
  | 'FINANCIAL_SABOTAGE'
  | 'EXPENSE_INJECTION'
  | 'DEBT_ATTACK'
  | 'ASSET_STRIP'
  | 'REPUTATION_ATTACK'
  | 'REGULATORY_ATTACK'
  | 'HATER_INJECTION'
  | 'OPPORTUNITY_KILL';

export type ShieldHealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type ShieldStatusBand =
  | 'FORTIFIED'
  | 'HEALTHY'
  | 'STRESSED'
  | 'CRITICAL'
  | 'BREACHED';

export type AttackSeverityTier =
  | 'NEGLIGIBLE'
  | 'MINOR'
  | 'MODERATE'
  | 'SEVERE'
  | 'CATASTROPHIC';

export type RepairStrategyKind =
  | 'TRIAGE_CRITICAL'
  | 'SPREAD_HEAL'
  | 'FORTIFY_STRONGEST'
  | 'CASCADE_PREVENTION'
  | 'PASSIVE_RECOVERY';

export type LayerDangerLevel =
  | 'SAFE'
  | 'GUARDED'
  | 'ELEVATED'
  | 'HIGH'
  | 'SEVERE'
  | 'CRITICAL';

export type ShieldEventKind =
  | 'DAMAGE_TAKEN'
  | 'LAYER_BREACHED'
  | 'REPAIR_STARTED'
  | 'REPAIR_COMPLETED'
  | 'REGEN_TICK'
  | 'FORTIFICATION_REACHED'
  | 'CASCADE_TRIGGERED'
  | 'DEFLECTION_APPLIED';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — INTERFACE EXPORTS (all original interfaces preserved)
// ─────────────────────────────────────────────────────────────────────────────

export interface ShieldLayerConfig {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly doctrineName: string;
  readonly max: number;
  readonly passiveRegenRate: number;
  readonly breachedRegenRate: number;
  readonly cascadeGate: boolean;
  readonly breachConsequenceText: string;
}

export interface RepairJob {
  readonly jobId: string;
  readonly tick: number;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly amountPerTick: number;
  readonly createdAtTick: number;
  readonly source: 'CARD' | 'SYSTEM' | 'ADMIN';
  readonly tags: readonly string[];
  ticksRemaining: number;
  delivered: number;
}

export interface PendingRepairSlice {
  readonly jobId: string;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly completed: boolean;
  readonly sourceTick: number;
}

export interface QueueRejection {
  readonly tick: number;
  readonly layerId: RepairLayerId;
  readonly amount: number;
  readonly durationTicks: number;
  readonly source: 'CARD' | 'SYSTEM' | 'ADMIN';
}

export interface RoutedAttack {
  readonly attackId: string;
  readonly source: AttackEvent['source'];
  readonly category: AttackCategory;
  readonly doctrineType: ShieldDoctrineAttackType;
  readonly requestedLayer: ShieldLayerId | 'DIRECT';
  readonly targetLayer: ShieldLayerId;
  readonly fallbackLayer: ShieldLayerId | null;
  readonly magnitude: number;
  readonly createdAtTick: number;
  readonly noteTags: readonly string[];
  readonly bypassDeflection: boolean;
}

export interface DamageResolution {
  readonly layers: readonly ShieldLayerState[];
  readonly actualLayerId: ShieldLayerId;
  readonly fallbackLayerId: ShieldLayerId | null;
  readonly effectiveDamage: number;
  readonly deflectionApplied: number;
  readonly preHitIntegrity: number;
  readonly postHitIntegrity: number;
  readonly breached: boolean;
  readonly wasAlreadyBreached: boolean;
  readonly blocked: boolean;
}

export interface CascadeResolution {
  readonly layers: readonly ShieldLayerState[];
  readonly triggered: boolean;
  readonly chainId: string | null;
  readonly templateId: string | null;
  readonly cascadeCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2b — NEW INTERFACE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export interface ShieldHealthReport {
  readonly grade: ShieldHealthGrade;
  readonly numericScore: number;
  readonly band: ShieldStatusBand;
  readonly layerGrades: readonly LayerGradeEntry[];
  readonly weakestLayerId: ShieldLayerId;
  readonly breachedCount: number;
  readonly fortifiedCount: number;
  readonly overallIntegrity: number;
  readonly narrativeSummary: string;
  readonly shortStatus: string;
}

export interface LayerGradeEntry {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly grade: ShieldHealthGrade;
  readonly integrityRatio: number;
  readonly dangerLevel: LayerDangerLevel;
  readonly uxStatusLine: string;
  readonly uxDetailLine: string;
}

export interface LayerVulnerabilityScore {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly vulnerabilityScore: number;
  readonly riskFactors: readonly string[];
  readonly ticksSinceLastDamage: number | null;
  readonly ticksSinceLastRecovery: number | null;
  readonly isHighestRisk: boolean;
}

export interface ShieldRecoveryEstimate {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly deficit: number;
  readonly regenPerTick: number;
  readonly ticksToFull: number;
  readonly ticksToFortified: number;
  readonly ticksToSafe: number;
  readonly breached: boolean;
  readonly recoveryNarrative: string;
}

export interface FortificationProgress {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly current: number;
  readonly fortifiedThreshold: number;
  readonly max: number;
  readonly progressRatio: number;
  readonly isFortified: boolean;
  readonly pointsRemaining: number;
  readonly uxProgressText: string;
}

export interface AttackAnalysisResult {
  readonly attackId: string;
  readonly category: AttackCategory;
  readonly source: AttackEvent['source'];
  readonly severityTier: AttackSeverityTier;
  readonly severityScore: number;
  readonly doctrineType: ShieldDoctrineAttackType | null;
  readonly targetLayer: ShieldLayerId | 'DIRECT';
  readonly isShieldTargeted: boolean;
  readonly isBotSourced: boolean;
  readonly magnitudeNormalized: number;
  readonly uxDescription: string;
  readonly uxSourceLabel: string;
}

export interface AttackBatchAnalysis {
  readonly attacks: readonly AttackAnalysisResult[];
  readonly totalCount: number;
  readonly categoryBreakdown: Readonly<Record<AttackCategory, number>>;
  readonly averageSeverity: number;
  readonly maxSeverity: number;
  readonly dominantCategory: AttackCategory;
  readonly dominantDoctrineType: ShieldDoctrineAttackType | null;
  readonly layerTargetBreakdown: Readonly<Record<ShieldLayerId, number>>;
  readonly directTargetCount: number;
  readonly uxBatchSummary: string;
}

export interface DoctrineCoherenceResult {
  readonly score: number;
  readonly dominantDoctrine: ShieldDoctrineAttackType | null;
  readonly doctrineDistribution: ReadonlyMap<ShieldDoctrineAttackType, number>;
  readonly isCoherent: boolean;
  readonly uxCoherenceLabel: string;
}

export interface AttackPatternSignal {
  readonly patternId: string;
  readonly description: string;
  readonly confidence: number;
  readonly involvedCategories: readonly AttackCategory[];
  readonly involvedLayers: readonly ShieldLayerId[];
  readonly tickSpan: number;
  readonly attackCount: number;
}

export interface RepairPriorityEntry {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly priorityScore: number;
  readonly reasons: readonly string[];
  readonly suggestedAmount: number;
  readonly urgencyLabel: string;
}

export interface RepairCostEstimate {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly deficit: number;
  readonly estimatedCost: number;
  readonly costPerHp: number;
  readonly durationTicks: number;
  readonly uxCostLabel: string;
}

export interface RepairStrategyRecommendation {
  readonly strategy: RepairStrategyKind;
  readonly confidence: number;
  readonly reasoning: string;
  readonly targetLayers: readonly ShieldLayerId[];
  readonly estimatedTicksToStable: number;
  readonly uxRecommendationText: string;
}

export interface RepairQueueSaturationReport {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly activeJobs: number;
  readonly maxJobs: number;
  readonly saturationRatio: number;
  readonly isSaturated: boolean;
  readonly queuedAmount: number;
  readonly uxSaturationLabel: string;
}

export interface RepairEffectivenessPrediction {
  readonly layerId: ShieldLayerId;
  readonly label: ShieldLayerLabel;
  readonly proposedAmount: number;
  readonly effectiveAmount: number;
  readonly wasteAmount: number;
  readonly efficiencyRatio: number;
  readonly wouldReachFortified: boolean;
  readonly postRepairIntegrity: number;
  readonly uxEffectivenessLabel: string;
}

export interface ShieldMLFeatureVector {
  readonly layerIntegrities: readonly number[];
  readonly layerBreachedFlags: readonly number[];
  readonly layerRegenRates: readonly number[];
  readonly overallIntegrity: number;
  readonly breachedCount: number;
  readonly weakestLayerIndex: number;
  readonly fortifiedCount: number;
  readonly gradeNumeric: number;
  readonly avgTicksSinceLastDamage: number;
  readonly maxDeficit: number;
  readonly cascadeRisk: number;
}

export interface AttackPatternFeatureVector {
  readonly categoryDistribution: readonly number[];
  readonly avgMagnitude: number;
  readonly maxMagnitude: number;
  readonly attackRate: number;
  readonly layerConcentration: readonly number[];
  readonly directTargetRatio: number;
  readonly botSourceRatio: number;
  readonly doctrineCoherence: number;
  readonly severityDistribution: readonly number[];
}

export interface RepairEfficiencyFeatureVector {
  readonly saturationByLayer: readonly number[];
  readonly avgRepairAmount: number;
  readonly totalQueued: number;
  readonly repairToDeficitRatio: number;
  readonly cardSourceRatio: number;
  readonly systemSourceRatio: number;
  readonly avgDurationTicks: number;
  readonly avgDeliveredRatio: number;
}

export interface ShieldUXSnapshot {
  readonly healthReport: ShieldHealthReport;
  readonly layerDetails: readonly LayerGradeEntry[];
  readonly vulnerabilities: readonly LayerVulnerabilityScore[];
  readonly recoveryEstimates: readonly ShieldRecoveryEstimate[];
  readonly fortificationProgress: readonly FortificationProgress[];
  readonly repairStrategy: RepairStrategyRecommendation;
  readonly overallNarrative: string;
  readonly playerActionHint: string;
}

export interface ShieldEventUXCopy {
  readonly eventKind: ShieldEventKind;
  readonly headline: string;
  readonly body: string;
  readonly severity: AttackSeverityTier;
  readonly layerId: ShieldLayerId | null;
  readonly label: ShieldLayerLabel | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — CORE CONSTANTS (all original constants preserved)
// ─────────────────────────────────────────────────────────────────────────────

export const SHIELD_LAYER_ORDER = Object.freeze([
  'L1',
  'L2',
  'L3',
  'L4',
] as const satisfies readonly ShieldLayerId[]);

export const SHIELD_LAYER_CONFIGS: Readonly<Record<ShieldLayerId, ShieldLayerConfig>> =
  Object.freeze({
    L1: Object.freeze({
      layerId: 'L1',
      label: 'CASH_RESERVE',
      doctrineName: 'LIQUIDITY_BUFFER',
      max: 100,
      passiveRegenRate: 2,
      breachedRegenRate: 1,
      cascadeGate: false,
      breachConsequenceText:
        'Liquidity buffer breached. Downstream systems should model income disruption.',
    }),
    L2: Object.freeze({
      layerId: 'L2',
      label: 'CREDIT_LINE',
      doctrineName: 'CREDIT_LINE',
      max: 80,
      passiveRegenRate: 2,
      breachedRegenRate: 1,
      cascadeGate: false,
      breachConsequenceText:
        'Credit line breached. Downstream systems should model debt pressure and expense spike.',
    }),
    L3: Object.freeze({
      layerId: 'L3',
      label: 'INCOME_BASE',
      doctrineName: 'ASSET_FLOOR',
      max: 60,
      passiveRegenRate: 1,
      breachedRegenRate: 0,
      cascadeGate: false,
      breachConsequenceText:
        'Asset floor breached. Downstream systems should model opportunity or income loss.',
    }),
    L4: Object.freeze({
      layerId: 'L4',
      label: 'NETWORK_CORE',
      doctrineName: 'NETWORK_CORE',
      max: 40,
      passiveRegenRate: 1,
      breachedRegenRate: 0,
      cascadeGate: true,
      breachConsequenceText:
        'Network core breached. Downstream systems should trigger the highest-severity cascade.',
    }),
  });

export const SHIELD_CONSTANTS = Object.freeze({
  LOW_WARNING_THRESHOLD: 0.30,
  CRITICAL_WARNING_THRESHOLD: 0.10,
  FORTIFIED_THRESHOLD: 0.80,
  DEFLECTION_FULL_INTEGRITY: 0.10,
  FORTIFIED_BONUS_DEFLECT: 0.15,
  DEFLECTION_MAX: 0.25,
  CASCADE_CRACK_RATIO: 0.20,
  MAX_ACTIVE_REPAIR_JOBS_PER_LAYER: 3,
  MAX_HISTORY_DEPTH: 64,
});

export const SHIELD_ATTACK_ALIASES: Readonly<Record<string, ShieldDoctrineAttackType>> =
  Object.freeze({
    'financial-sabotage': 'FINANCIAL_SABOTAGE',
    financial_sabotage: 'FINANCIAL_SABOTAGE',
    embezzler: 'FINANCIAL_SABOTAGE',
    sabotage: 'FINANCIAL_SABOTAGE',

    'expense-injection': 'EXPENSE_INJECTION',
    expense_injection: 'EXPENSE_INJECTION',
    overhead: 'EXPENSE_INJECTION',
    lifestyle_creep: 'EXPENSE_INJECTION',

    'debt-attack': 'DEBT_ATTACK',
    debt_attack: 'DEBT_ATTACK',
    predatory_lender: 'DEBT_ATTACK',
    debt_daemon: 'DEBT_ATTACK',

    'asset-strip': 'ASSET_STRIP',
    asset_strip: 'ASSET_STRIP',
    liquidator: 'ASSET_STRIP',
    stripper: 'ASSET_STRIP',

    'reputation-attack': 'REPUTATION_ATTACK',
    reputation_attack: 'REPUTATION_ATTACK',
    reputation: 'REPUTATION_ATTACK',
    lawsuit: 'REPUTATION_ATTACK',

    'regulatory-attack': 'REGULATORY_ATTACK',
    regulatory_attack: 'REGULATORY_ATTACK',
    regulatory: 'REGULATORY_ATTACK',
    auditor: 'REGULATORY_ATTACK',
    tax_daemon: 'REGULATORY_ATTACK',
    compliance: 'REGULATORY_ATTACK',

    'hater-injection': 'HATER_INJECTION',
    hater_injection: 'HATER_INJECTION',
    weakest_layer: 'HATER_INJECTION',
    weakest: 'HATER_INJECTION',

    'opportunity-kill': 'OPPORTUNITY_KILL',
    opportunity_kill: 'OPPORTUNITY_KILL',
    opportunity_block: 'OPPORTUNITY_KILL',
    blocker: 'OPPORTUNITY_KILL',

    critical: 'HATER_INJECTION',
  });

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — EXTENDED CONSTANTS (all new, all wired to exported functions)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps each AttackCategory to its primary doctrine attack type.
 * Used at runtime in mapAttackCategoryToDoctrine() and attack analysis.
 */
export const ATTACK_CATEGORY_DOCTRINE_MAP: Readonly<Record<AttackCategory, ShieldDoctrineAttackType>> =
  Object.freeze({
    EXTRACTION: 'FINANCIAL_SABOTAGE',
    LOCK: 'REGULATORY_ATTACK',
    DRAIN: 'EXPENSE_INJECTION',
    HEAT: 'HATER_INJECTION',
    BREACH: 'ASSET_STRIP',
    DEBT: 'DEBT_ATTACK',
  });

/**
 * Base severity weight for each AttackCategory.
 * Higher values indicate inherently more dangerous attack types.
 * Used in attack severity scoring.
 */
export const ATTACK_CATEGORY_SEVERITY_WEIGHT: Readonly<Record<AttackCategory, number>> =
  Object.freeze({
    EXTRACTION: 0.75,
    LOCK: 0.60,
    DRAIN: 0.70,
    HEAT: 0.55,
    BREACH: 0.90,
    DEBT: 0.80,
  });

/**
 * Maps each AttackCategory to its preferred target layer.
 * Used by attack routing analysis to detect pattern deviations.
 */
export const ATTACK_CATEGORY_PREFERRED_LAYER: Readonly<Record<AttackCategory, ShieldLayerId>> =
  Object.freeze({
    EXTRACTION: 'L1',
    LOCK: 'L2',
    DRAIN: 'L1',
    HEAT: 'L4',
    BREACH: 'L3',
    DEBT: 'L2',
  });

/**
 * UX narrative description for each AttackCategory.
 * Used in attack analysis result generation and player-facing text.
 */
export const ATTACK_CATEGORY_UX_DESCRIPTION: Readonly<Record<AttackCategory, string>> =
  Object.freeze({
    EXTRACTION: 'Direct cash extraction threatens your liquidity reserves.',
    LOCK: 'A lock attack restricts your financial flexibility and credit access.',
    DRAIN: 'Ongoing drain steadily erodes your cash reserves over time.',
    HEAT: 'Heat pressure destabilizes your network core and support systems.',
    BREACH: 'Breach attack targets your income base and asset foundations.',
    DEBT: 'Debt pressure attacks your credit line with compounding obligations.',
  });

/**
 * UX narrative description for each ShieldDoctrineAttackType.
 */
export const DOCTRINE_TYPE_UX_DESCRIPTION: Readonly<Record<ShieldDoctrineAttackType, string>> =
  Object.freeze({
    FINANCIAL_SABOTAGE: 'An agent is actively sabotaging your financial position.',
    EXPENSE_INJECTION: 'Hidden expenses are being injected into your spending pattern.',
    DEBT_ATTACK: 'Predatory debt is being forced onto your credit line.',
    ASSET_STRIP: 'Your assets are being systematically stripped away.',
    REPUTATION_ATTACK: 'Your reputation is under coordinated attack.',
    REGULATORY_ATTACK: 'Regulatory pressure is threatening your operations.',
    HATER_INJECTION: 'A targeted attack is seeking your weakest shield layer.',
    OPPORTUNITY_KILL: 'Your growth opportunities are being actively blocked.',
  });

/**
 * Maps each ShieldLayerLabel to its UX-friendly display name.
 * Used in all player-facing text generation.
 */
export const LAYER_LABEL_DISPLAY_NAME: Readonly<Record<ShieldLayerLabel, string>> =
  Object.freeze({
    CASH_RESERVE: 'Cash Reserve',
    CREDIT_LINE: 'Credit Line',
    INCOME_BASE: 'Income Base',
    NETWORK_CORE: 'Network Core',
  });

/**
 * Short UX descriptions for each layer label — what the layer protects.
 */
export const LAYER_LABEL_UX_DESCRIPTION: Readonly<Record<ShieldLayerLabel, string>> =
  Object.freeze({
    CASH_RESERVE: 'Your liquid cash buffer that absorbs the first wave of financial shocks.',
    CREDIT_LINE: 'Your credit access that provides backup when cash runs low.',
    INCOME_BASE: 'Your income-generating assets that fund long-term stability.',
    NETWORK_CORE: 'Your core support network — the last line of defense before cascade.',
  });

/**
 * UX icon/emoji identifiers per layer label for rendering.
 * Each value is a semantic icon key, not a literal emoji.
 */
export const LAYER_LABEL_ICON_KEY: Readonly<Record<ShieldLayerLabel, string>> =
  Object.freeze({
    CASH_RESERVE: 'shield-cash',
    CREDIT_LINE: 'shield-credit',
    INCOME_BASE: 'shield-income',
    NETWORK_CORE: 'shield-network',
  });

/**
 * Danger level thresholds for computing LayerDangerLevel.
 * Array of [maxIntegrityRatio, dangerLevel] tuples, checked in order.
 */
export const LAYER_DANGER_THRESHOLDS = Object.freeze([
  [0.00, 'CRITICAL'],
  [0.10, 'SEVERE'],
  [0.25, 'HIGH'],
  [0.50, 'ELEVATED'],
  [0.70, 'GUARDED'],
  [1.01, 'SAFE'],
] as const);

/**
 * UX descriptions for each danger level.
 */
export const DANGER_LEVEL_UX_DESCRIPTION: Readonly<Record<LayerDangerLevel, string>> =
  Object.freeze({
    SAFE: 'Layer is operating normally with comfortable margin.',
    GUARDED: 'Layer is intact but should be monitored.',
    ELEVATED: 'Layer is under stress. Consider proactive repair.',
    HIGH: 'Layer is significantly weakened. Prioritize repair.',
    SEVERE: 'Layer is dangerously low. Immediate repair critical.',
    CRITICAL: 'Layer is breached or on the verge of failure.',
  });

/**
 * UX status line templates per danger level.
 * {layer} and {pct} are substituted at runtime.
 */
export const DANGER_LEVEL_STATUS_TEMPLATE: Readonly<Record<LayerDangerLevel, string>> =
  Object.freeze({
    SAFE: '{layer} is holding strong at {pct}%.',
    GUARDED: '{layer} is intact at {pct}% — monitor for changes.',
    ELEVATED: '{layer} is stressed at {pct}% — consider reinforcing.',
    HIGH: '{layer} is weakened to {pct}% — repair recommended.',
    SEVERE: '{layer} is critical at {pct}% — immediate action needed.',
    CRITICAL: '{layer} has been breached — shield layer offline.',
  });

/**
 * Maps each ShieldStatusBand to a UX icon key.
 */
export const STATUS_BAND_ICON_KEY: Readonly<Record<ShieldStatusBand, string>> =
  Object.freeze({
    FORTIFIED: 'shield-fortified',
    HEALTHY: 'shield-healthy',
    STRESSED: 'shield-stressed',
    CRITICAL: 'shield-critical',
    BREACHED: 'shield-breached',
  });

/**
 * Maps each ShieldStatusBand to a UX narrative sentence fragment.
 */
export const STATUS_BAND_UX_NARRATIVE: Readonly<Record<ShieldStatusBand, string>> =
  Object.freeze({
    FORTIFIED: 'Your shields are fortified and operating at peak capacity.',
    HEALTHY: 'Your shields are in good condition with minor wear.',
    STRESSED: 'Your shields are under stress — some layers need attention.',
    CRITICAL: 'Your shields are critically weakened — multiple layers in danger.',
    BREACHED: 'One or more shield layers have been breached. Take action now.',
  });

/**
 * Maps each ShieldHealthGrade to its numeric score range boundaries.
 * [minScore, maxScore] inclusive.
 */
export const GRADE_SCORE_BOUNDARIES = Object.freeze({
  A: [0.85, 1.00],
  B: [0.65, 0.849],
  C: [0.40, 0.649],
  D: [0.15, 0.399],
  F: [0.00, 0.149],
} as const);

/**
 * UX narrative for each health grade.
 */
export const GRADE_UX_NARRATIVE: Readonly<Record<ShieldHealthGrade, string>> =
  Object.freeze({
    A: 'Excellent shield integrity. You are well-protected against incoming threats.',
    B: 'Good shield integrity. Minor damage present but overall position is strong.',
    C: 'Fair shield integrity. Several layers are weakened and need attention.',
    D: 'Poor shield integrity. Critical vulnerabilities present across your defenses.',
    F: 'Shield failure. Your defenses are compromised. Immediate action required.',
  });

/**
 * Severity tier numeric boundaries for classifying attack severity.
 * [minScore, maxScore].
 */
export const SEVERITY_TIER_BOUNDARIES = Object.freeze({
  NEGLIGIBLE: [0.00, 0.15],
  MINOR: [0.15, 0.35],
  MODERATE: [0.35, 0.55],
  SEVERE: [0.55, 0.80],
  CATASTROPHIC: [0.80, 1.01],
} as const);

/**
 * UX descriptions for each severity tier.
 */
export const SEVERITY_TIER_UX_DESCRIPTION: Readonly<Record<AttackSeverityTier, string>> =
  Object.freeze({
    NEGLIGIBLE: 'A glancing blow with minimal impact.',
    MINOR: 'A light attack causing minor shield damage.',
    MODERATE: 'A solid hit causing noticeable shield degradation.',
    SEVERE: 'A heavy strike dealing significant shield damage.',
    CATASTROPHIC: 'A devastating attack threatening shield integrity.',
  });

/**
 * UX labels for each repair source type.
 */
export const REPAIR_SOURCE_UX_LABEL: Readonly<Record<RepairJob['source'], string>> =
  Object.freeze({
    CARD: 'Card-powered repair',
    SYSTEM: 'Passive system regeneration',
    ADMIN: 'Emergency administrative repair',
  });

/**
 * UX descriptions for repair strategy kinds.
 */
export const REPAIR_STRATEGY_UX_DESCRIPTION: Readonly<Record<RepairStrategyKind, string>> =
  Object.freeze({
    TRIAGE_CRITICAL: 'Focus all repair on the most critically damaged layer to prevent breach.',
    SPREAD_HEAL: 'Distribute repair across all layers evenly for balanced recovery.',
    FORTIFY_STRONGEST: 'Boost the strongest layer to fortified status for deflection bonuses.',
    CASCADE_PREVENTION: 'Prioritize L4 network core to prevent cascade triggers.',
    PASSIVE_RECOVERY: 'Let passive regeneration handle recovery — no active repair needed.',
  });

/**
 * Maps each ShieldEventKind to its UX headline template.
 * Substitution tokens: {layer}, {amount}, {pct}.
 */
export const SHIELD_EVENT_UX_HEADLINE: Readonly<Record<ShieldEventKind, string>> =
  Object.freeze({
    DAMAGE_TAKEN: '{layer} absorbed {amount} damage.',
    LAYER_BREACHED: '{layer} has been breached!',
    REPAIR_STARTED: 'Repair initiated on {layer}.',
    REPAIR_COMPLETED: '{layer} repair completed.',
    REGEN_TICK: '{layer} regenerated naturally.',
    FORTIFICATION_REACHED: '{layer} reached fortified status!',
    CASCADE_TRIGGERED: 'Cascade triggered from {layer} breach!',
    DEFLECTION_APPLIED: '{layer} deflected {amount} damage.',
  });

/**
 * Maps each ShieldEventKind to its UX body template for detailed messages.
 */
export const SHIELD_EVENT_UX_BODY: Readonly<Record<ShieldEventKind, string>> =
  Object.freeze({
    DAMAGE_TAKEN: '{layer} took {amount} points of damage, now at {pct}% integrity.',
    LAYER_BREACHED: '{layer} integrity dropped to zero. Downstream consequences may follow.',
    REPAIR_STARTED: 'A repair job is now restoring {layer}. Estimated delivery: {amount} HP.',
    REPAIR_COMPLETED: '{layer} repair job finished. Layer integrity now at {pct}%.',
    REGEN_TICK: '{layer} passively regenerated to {pct}% integrity.',
    FORTIFICATION_REACHED: '{layer} is now fortified at {pct}%. Deflection bonuses active.',
    CASCADE_TRIGGERED: 'Breach of {layer} triggered a cascade event affecting downstream systems.',
    DEFLECTION_APPLIED: '{layer} deflection reduced incoming damage by {amount} points.',
  });

/**
 * Layer weight factors for overall shield health scoring.
 * Inner layers (L3, L4) are weighted slightly higher because
 * their breach has more severe consequences.
 */
export const LAYER_HEALTH_WEIGHT: Readonly<Record<ShieldLayerId, number>> =
  Object.freeze({
    L1: 0.20,
    L2: 0.25,
    L3: 0.25,
    L4: 0.30,
  });

/**
 * Repair cost per HP for each layer. Inner layers cost more to repair.
 */
export const LAYER_REPAIR_COST_PER_HP: Readonly<Record<ShieldLayerId, number>> =
  Object.freeze({
    L1: 1.0,
    L2: 1.5,
    L3: 2.0,
    L4: 3.0,
  });

/**
 * Repair speed factor per layer. Outer layers repair faster.
 * Value is HP per tick for a standard CARD repair job.
 */
export const LAYER_REPAIR_SPEED: Readonly<Record<ShieldLayerId, number>> =
  Object.freeze({
    L1: 4.0,
    L2: 3.0,
    L3: 2.0,
    L4: 1.5,
  });

/**
 * Ordered list of all AttackCategory values for iteration.
 * Used by ML feature extraction to ensure deterministic ordering.
 */
export const ATTACK_CATEGORY_ORDER: readonly AttackCategory[] = Object.freeze([
  'EXTRACTION',
  'LOCK',
  'DRAIN',
  'HEAT',
  'BREACH',
  'DEBT',
] as const);

/**
 * Ordered list of all ShieldDoctrineAttackType values for iteration.
 */
export const DOCTRINE_TYPE_ORDER: readonly ShieldDoctrineAttackType[] = Object.freeze([
  'FINANCIAL_SABOTAGE',
  'EXPENSE_INJECTION',
  'DEBT_ATTACK',
  'ASSET_STRIP',
  'REPUTATION_ATTACK',
  'REGULATORY_ATTACK',
  'HATER_INJECTION',
  'OPPORTUNITY_KILL',
] as const);

/**
 * Ordered list of all severity tiers for ML feature extraction.
 */
export const SEVERITY_TIER_ORDER: readonly AttackSeverityTier[] = Object.freeze([
  'NEGLIGIBLE',
  'MINOR',
  'MODERATE',
  'SEVERE',
  'CATASTROPHIC',
] as const);

/**
 * UX source labels for attack sources.
 * Maps known source identifiers to display strings.
 */
export const ATTACK_SOURCE_UX_LABEL: Readonly<Record<string, string>> =
  Object.freeze({
    BOT_01: 'Tax Daemon',
    BOT_02: 'Lifestyle Creep',
    BOT_03: 'Predatory Lender',
    BOT_04: 'Compliance Auditor',
    BOT_05: 'Opportunity Blocker',
    OPPONENT: 'Opposing Player',
    SYSTEM: 'System Event',
  });

/**
 * UX label for each ShieldLayerLabel used in compact displays.
 */
export const LAYER_LABEL_SHORT_NAME: Readonly<Record<ShieldLayerLabel, string>> =
  Object.freeze({
    CASH_RESERVE: 'Cash',
    CREDIT_LINE: 'Credit',
    INCOME_BASE: 'Income',
    NETWORK_CORE: 'Network',
  });

/**
 * Maps AttackCategory to a UX-friendly short name.
 */
export const ATTACK_CATEGORY_UX_SHORT_NAME: Readonly<Record<AttackCategory, string>> =
  Object.freeze({
    EXTRACTION: 'Extraction',
    LOCK: 'Lock',
    DRAIN: 'Drain',
    HEAT: 'Heat',
    BREACH: 'Breach',
    DEBT: 'Debt',
  });

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — ORIGINAL EXPORTED FUNCTIONS (all preserved exactly)
// ─────────────────────────────────────────────────────────────────────────────

export function isShieldLayerId(value: unknown): value is ShieldLayerId {
  return value === 'L1' || value === 'L2' || value === 'L3' || value === 'L4';
}

export function getLayerConfig(layerId: ShieldLayerId): ShieldLayerConfig {
  return SHIELD_LAYER_CONFIGS[layerId];
}

export function buildShieldLayerState(
  layerId: ShieldLayerId,
  current: number,
  lastDamagedTick: number | null,
  lastRecoveredTick: number | null,
): ShieldLayerState {
  const config = getLayerConfig(layerId);
  const clamped = Math.max(0, Math.min(config.max, Math.round(current)));
  const breached = clamped <= 0;
  const regenPerTick = breached
    ? config.breachedRegenRate
    : config.passiveRegenRate;

  return {
    layerId,
    label: config.label,
    current: clamped,
    max: config.max,
    regenPerTick,
    breached,
    integrityRatio: config.max === 0 ? 0 : clamped / config.max,
    lastDamagedTick,
    lastRecoveredTick,
  };
}

export function normalizeShieldNoteTags(
  notes: readonly string[],
): readonly string[] {
  return Object.freeze(
    notes
      .map((note) =>
        note
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-'),
      )
      .filter((note) => note.length > 0),
  );
}

export function resolveShieldAlias(
  noteTags: readonly string[],
): ShieldDoctrineAttackType | null {
  for (const tag of noteTags) {
    const resolved = SHIELD_ATTACK_ALIASES[tag];
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return null;
}

export function layerOrderIndex(layerId: ShieldLayerId): number {
  return SHIELD_LAYER_ORDER.indexOf(layerId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — SHIELD LAYER DIAGNOSTICS & UX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the danger level for a given integrity ratio.
 * Uses LAYER_DANGER_THRESHOLDS for deterministic classification.
 */
export function computeLayerDangerLevel(integrityRatio: number): LayerDangerLevel {
  for (const [threshold, level] of LAYER_DANGER_THRESHOLDS) {
    if (integrityRatio <= threshold) {
      return level as LayerDangerLevel;
    }
  }
  return 'SAFE';
}

/**
 * Compute a ShieldHealthGrade from a numeric score (0-1).
 * Uses GRADE_SCORE_BOUNDARIES for deterministic grading.
 */
export function computeGradeFromScore(score: number): ShieldHealthGrade {
  const clamped = Math.max(0, Math.min(1, score));
  if (clamped >= GRADE_SCORE_BOUNDARIES.A[0]) return 'A';
  if (clamped >= GRADE_SCORE_BOUNDARIES.B[0]) return 'B';
  if (clamped >= GRADE_SCORE_BOUNDARIES.C[0]) return 'C';
  if (clamped >= GRADE_SCORE_BOUNDARIES.D[0]) return 'D';
  return 'F';
}

/**
 * Compute a numeric health grade value (0-1) from a ShieldHealthGrade letter.
 * Returns the midpoint of the grade's score range.
 */
export function gradeToNumericMidpoint(grade: ShieldHealthGrade): number {
  const bounds = GRADE_SCORE_BOUNDARIES[grade];
  return (bounds[0] + bounds[1]) / 2;
}

/**
 * Compute the overall shield status band from an integrity ratio.
 * Uses SHIELD_CONSTANTS thresholds for deterministic banding.
 */
export function computeStatusBand(overallIntegrity: number, breachedCount: number): ShieldStatusBand {
  if (breachedCount > 0) return 'BREACHED';
  if (overallIntegrity <= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD) return 'CRITICAL';
  if (overallIntegrity <= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) return 'STRESSED';
  if (overallIntegrity >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) return 'FORTIFIED';
  return 'HEALTHY';
}

/**
 * Generate a UX status line for a single layer given its state.
 * Substitutes {layer} and {pct} into the appropriate danger level template.
 * Reads ShieldLayerState.label and uses LAYER_LABEL_DISPLAY_NAME at runtime.
 */
export function generateLayerStatusLine(state: ShieldLayerState): string {
  const dangerLevel = computeLayerDangerLevel(state.integrityRatio);
  const template = DANGER_LEVEL_STATUS_TEMPLATE[dangerLevel];
  const displayName = LAYER_LABEL_DISPLAY_NAME[state.label];
  const pct = Math.round(state.integrityRatio * 100);
  return template.replace('{layer}', displayName).replace('{pct}', String(pct));
}

/**
 * Generate a detailed UX description line for a single layer.
 * Combines the layer description with its current danger level context.
 * Reads ShieldLayerState.label at runtime for LAYER_LABEL_UX_DESCRIPTION lookup.
 */
export function generateLayerDetailLine(state: ShieldLayerState): string {
  const description = LAYER_LABEL_UX_DESCRIPTION[state.label];
  const dangerLevel = computeLayerDangerLevel(state.integrityRatio);
  const dangerDesc = DANGER_LEVEL_UX_DESCRIPTION[dangerLevel];
  if (state.breached) {
    const config = getLayerConfig(state.layerId);
    return `${description} ${config.breachConsequenceText}`;
  }
  return `${description} ${dangerDesc}`;
}

/**
 * Build a LayerGradeEntry for a single ShieldLayerState.
 * This is the per-layer UX unit used in the full health report.
 */
export function buildLayerGradeEntry(state: ShieldLayerState): LayerGradeEntry {
  const grade = computeGradeFromScore(state.integrityRatio);
  const dangerLevel = computeLayerDangerLevel(state.integrityRatio);
  return {
    layerId: state.layerId,
    label: state.label,
    grade,
    integrityRatio: state.integrityRatio,
    dangerLevel,
    uxStatusLine: generateLayerStatusLine(state),
    uxDetailLine: generateLayerDetailLine(state),
  };
}

/**
 * Compute the weighted overall integrity from an array of ShieldLayerStates.
 * Uses LAYER_HEALTH_WEIGHT for per-layer weighting.
 */
export function computeWeightedIntegrity(layers: readonly ShieldLayerState[]): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const layer of layers) {
    const weight = LAYER_HEALTH_WEIGHT[layer.layerId];
    weightedSum += layer.integrityRatio * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

/**
 * Build a complete ShieldHealthReport from an array of ShieldLayerStates.
 * This is the primary UX output for shield status rendering.
 */
export function buildShieldHealthReport(layers: readonly ShieldLayerState[]): ShieldHealthReport {
  const layerGrades: LayerGradeEntry[] = [];
  let breachedCount = 0;
  let fortifiedCount = 0;
  let weakestRatio = Infinity;
  let weakestId: ShieldLayerId = 'L1';

  for (const layer of layers) {
    const entry = buildLayerGradeEntry(layer);
    layerGrades.push(entry);
    if (layer.breached) breachedCount++;
    if (layer.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) fortifiedCount++;
    if (layer.integrityRatio < weakestRatio) {
      weakestRatio = layer.integrityRatio;
      weakestId = layer.layerId;
    }
  }

  const overallIntegrity = computeWeightedIntegrity(layers);
  const numericScore = overallIntegrity;
  const grade = computeGradeFromScore(numericScore);
  const band = computeStatusBand(overallIntegrity, breachedCount);
  const narrativeSummary = buildShieldNarrativeSummary(grade, band, breachedCount, fortifiedCount, layers);
  const shortStatus = buildShieldShortStatus(grade, band, overallIntegrity);

  return {
    grade,
    numericScore,
    band,
    layerGrades,
    weakestLayerId: weakestId,
    breachedCount,
    fortifiedCount,
    overallIntegrity,
    narrativeSummary,
    shortStatus,
  };
}

/**
 * Build a narrative summary string for the overall shield status.
 * Combines grade narrative with band narrative and breach/fortification info.
 */
export function buildShieldNarrativeSummary(
  grade: ShieldHealthGrade,
  band: ShieldStatusBand,
  breachedCount: number,
  fortifiedCount: number,
  layers: readonly ShieldLayerState[],
): string {
  const parts: string[] = [];
  parts.push(GRADE_UX_NARRATIVE[grade]);
  parts.push(STATUS_BAND_UX_NARRATIVE[band]);

  if (breachedCount > 0) {
    const breachedLabels = layers
      .filter((l) => l.breached)
      .map((l) => LAYER_LABEL_DISPLAY_NAME[l.label]);
    parts.push(`Breached layers: ${breachedLabels.join(', ')}.`);
  }

  if (fortifiedCount > 0) {
    const fortifiedLabels = layers
      .filter((l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD)
      .map((l) => LAYER_LABEL_DISPLAY_NAME[l.label]);
    parts.push(`Fortified layers: ${fortifiedLabels.join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Build a short one-line status string for compact UX display.
 */
export function buildShieldShortStatus(
  grade: ShieldHealthGrade,
  band: ShieldStatusBand,
  overallIntegrity: number,
): string {
  const pct = Math.round(overallIntegrity * 100);
  const bandIcon = STATUS_BAND_ICON_KEY[band];
  return `[${bandIcon}] Grade ${grade} — ${pct}% shield integrity`;
}

/**
 * Identify which layer is most vulnerable given current states and tick context.
 * Returns a scored and ranked array of LayerVulnerabilityScore entries.
 */
export function computeLayerVulnerabilities(
  layers: readonly ShieldLayerState[],
  currentTick: number,
): readonly LayerVulnerabilityScore[] {
  const scored: LayerVulnerabilityScore[] = [];

  for (const layer of layers) {
    const riskFactors: string[] = [];
    let score = 0;

    // Base vulnerability from low integrity
    const deficitFactor = 1 - layer.integrityRatio;
    score += deficitFactor * 0.40;
    if (deficitFactor > 0.7) riskFactors.push('Integrity below 30%');

    // Breach status is highest risk
    if (layer.breached) {
      score += 0.30;
      riskFactors.push('Layer is currently breached');
    }

    // Cascade gate amplifies risk (L4)
    const config = getLayerConfig(layer.layerId);
    if (config.cascadeGate) {
      score += 0.15;
      riskFactors.push('Cascade gate layer — breach triggers chain reaction');
    }

    // Recent damage increases vulnerability
    const ticksSinceLastDamage = layer.lastDamagedTick !== null
      ? currentTick - layer.lastDamagedTick
      : null;
    if (ticksSinceLastDamage !== null && ticksSinceLastDamage < 5) {
      score += 0.10;
      riskFactors.push('Recently damaged');
    }

    // Low regen rate means slower recovery
    if (layer.regenPerTick === 0) {
      score += 0.05;
      riskFactors.push('No passive regeneration active');
    }

    const ticksSinceLastRecovery = layer.lastRecoveredTick !== null
      ? currentTick - layer.lastRecoveredTick
      : null;

    if (riskFactors.length === 0) {
      riskFactors.push('No significant risk factors identified');
    }

    scored.push({
      layerId: layer.layerId,
      label: layer.label,
      vulnerabilityScore: Math.min(1, score),
      riskFactors,
      ticksSinceLastDamage,
      ticksSinceLastRecovery,
      isHighestRisk: false,
    });
  }

  // Sort descending by vulnerability score
  scored.sort((a, b) => b.vulnerabilityScore - a.vulnerabilityScore);

  // Mark highest risk
  if (scored.length > 0) {
    scored[0] = { ...scored[0], isHighestRisk: true };
  }

  return scored;
}

/**
 * Estimate recovery time for each layer in ticks.
 * Returns a ShieldRecoveryEstimate per layer with tick counts and UX narrative.
 */
export function estimateShieldRecovery(
  layers: readonly ShieldLayerState[],
): readonly ShieldRecoveryEstimate[] {
  return layers.map((layer) => {
    const config = getLayerConfig(layer.layerId);
    const deficit = layer.max - layer.current;
    const regenPerTick = layer.regenPerTick;
    const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];

    const ticksToFull = regenPerTick > 0 ? Math.ceil(deficit / regenPerTick) : Infinity;

    const fortifiedTarget = layer.max * SHIELD_CONSTANTS.FORTIFIED_THRESHOLD;
    const deficitToFortified = Math.max(0, fortifiedTarget - layer.current);
    const ticksToFortified = regenPerTick > 0
      ? Math.ceil(deficitToFortified / regenPerTick)
      : Infinity;

    const safeTarget = layer.max * 0.70; // above GUARDED threshold
    const deficitToSafe = Math.max(0, safeTarget - layer.current);
    const ticksToSafe = regenPerTick > 0
      ? Math.ceil(deficitToSafe / regenPerTick)
      : Infinity;

    let recoveryNarrative: string;
    if (deficit === 0) {
      recoveryNarrative = `${displayName} is at full capacity. No recovery needed.`;
    } else if (regenPerTick === 0) {
      recoveryNarrative = `${displayName} has no passive regeneration. Active repair is required to restore this layer.`;
    } else if (layer.breached) {
      recoveryNarrative = `${displayName} is breached. Recovery at ${config.breachedRegenRate} HP/tick will take approximately ${ticksToFull} ticks to reach full capacity.`;
    } else if (ticksToFull <= 5) {
      recoveryNarrative = `${displayName} will reach full capacity in about ${ticksToFull} ticks.`;
    } else if (ticksToFull <= 20) {
      recoveryNarrative = `${displayName} is recovering at ${regenPerTick} HP/tick. Full capacity in approximately ${ticksToFull} ticks.`;
    } else {
      recoveryNarrative = `${displayName} has a significant deficit of ${deficit} HP. Full recovery estimated at ${ticksToFull} ticks.`;
    }

    return {
      layerId: layer.layerId,
      label: layer.label,
      currentHp: layer.current,
      maxHp: layer.max,
      deficit,
      regenPerTick,
      ticksToFull,
      ticksToFortified,
      ticksToSafe,
      breached: layer.breached,
      recoveryNarrative,
    };
  });
}

/**
 * Compute fortification progress for each layer.
 * Returns how close each layer is to the FORTIFIED_THRESHOLD.
 */
export function computeFortificationProgress(
  layers: readonly ShieldLayerState[],
): readonly FortificationProgress[] {
  return layers.map((layer) => {
    const fortifiedThreshold = layer.max * SHIELD_CONSTANTS.FORTIFIED_THRESHOLD;
    const isFortified = layer.current >= fortifiedThreshold;
    const progressRatio = fortifiedThreshold > 0
      ? Math.min(1, layer.current / fortifiedThreshold)
      : 0;
    const pointsRemaining = Math.max(0, Math.ceil(fortifiedThreshold - layer.current));
    const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];

    let uxProgressText: string;
    if (isFortified) {
      uxProgressText = `${displayName} is fortified. Deflection bonuses are active.`;
    } else if (progressRatio >= 0.9) {
      uxProgressText = `${displayName} is almost fortified — only ${pointsRemaining} HP to go.`;
    } else if (progressRatio >= 0.5) {
      uxProgressText = `${displayName} is ${Math.round(progressRatio * 100)}% to fortification.`;
    } else if (layer.breached) {
      uxProgressText = `${displayName} is breached. Fortification is a distant goal.`;
    } else {
      uxProgressText = `${displayName} needs ${pointsRemaining} HP to reach fortification.`;
    }

    return {
      layerId: layer.layerId,
      label: layer.label,
      current: layer.current,
      fortifiedThreshold,
      max: layer.max,
      progressRatio,
      isFortified,
      pointsRemaining,
      uxProgressText,
    };
  });
}

/**
 * Compute the deflection value for a layer at a given integrity ratio.
 * Uses SHIELD_CONSTANTS for all threshold lookups.
 */
export function computeLayerDeflection(integrityRatio: number): number {
  if (integrityRatio <= 0) return 0;
  let deflection = SHIELD_CONSTANTS.DEFLECTION_FULL_INTEGRITY;
  if (integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
    deflection += SHIELD_CONSTANTS.FORTIFIED_BONUS_DEFLECT;
  }
  return Math.min(deflection, SHIELD_CONSTANTS.DEFLECTION_MAX);
}

/**
 * Check whether a layer is at cascade-crack risk.
 * A layer is at cascade risk when its integrity ratio falls below CASCADE_CRACK_RATIO
 * and the layer is a cascade gate.
 */
export function isLayerAtCascadeRisk(state: ShieldLayerState): boolean {
  const config = getLayerConfig(state.layerId);
  if (!config.cascadeGate) return false;
  return state.integrityRatio <= SHIELD_CONSTANTS.CASCADE_CRACK_RATIO;
}

/**
 * Build a combined shield status summary string suitable for chat/UI overlay.
 * Returns a multi-line narrative with per-layer status and overall assessment.
 */
export function buildShieldStatusSummary(layers: readonly ShieldLayerState[]): string {
  const report = buildShieldHealthReport(layers);
  const lines: string[] = [];
  lines.push(report.shortStatus);
  lines.push('');
  for (const entry of report.layerGrades) {
    lines.push(entry.uxStatusLine);
  }
  lines.push('');
  lines.push(report.narrativeSummary);
  return lines.join('\n');
}

/**
 * Score the overall defensive posture of the shield system.
 * Returns a 0-1 value where 1 means impregnable and 0 means total collapse.
 * Factors in deflection potential, cascade risk, and regen rate.
 */
export function scoreDefensivePosture(layers: readonly ShieldLayerState[]): number {
  if (layers.length === 0) return 0;

  let score = 0;
  let totalWeight = 0;

  for (const layer of layers) {
    const weight = LAYER_HEALTH_WEIGHT[layer.layerId];
    const config = getLayerConfig(layer.layerId);
    totalWeight += weight;

    // Integrity contribution
    const integrityContrib = layer.integrityRatio * 0.60;

    // Deflection contribution
    const deflectionContrib = computeLayerDeflection(layer.integrityRatio) * 0.20;

    // Regen contribution (normalized to max possible regen)
    const maxRegen = config.passiveRegenRate;
    const regenContrib = maxRegen > 0
      ? (layer.regenPerTick / maxRegen) * 0.15
      : 0;

    // Cascade safety contribution
    const cascadeContrib = config.cascadeGate
      ? (layer.integrityRatio > SHIELD_CONSTANTS.CASCADE_CRACK_RATIO ? 0.05 : 0)
      : 0.05;

    score += (integrityContrib + deflectionContrib + regenContrib + cascadeContrib) * weight;
  }

  return totalWeight > 0 ? Math.min(1, score / totalWeight) : 0;
}

/**
 * Determine the number of ticks a layer has been in continuous distress
 * (below LOW_WARNING_THRESHOLD) given tick history.
 */
export function computeLayerDistressDuration(
  state: ShieldLayerState,
  currentTick: number,
): number {
  if (state.integrityRatio > SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) return 0;
  if (state.lastDamagedTick === null) return 0;
  // Distress started at the last damage event at minimum
  const damageTick = state.lastDamagedTick;
  const recoveredTick = state.lastRecoveredTick ?? 0;
  // If last recovery was after last damage, no current distress
  if (recoveredTick > damageTick) return 0;
  return currentTick - damageTick;
}

/**
 * Generate a player action hint based on the current shield state.
 * This suggests the single most impactful thing the player should do.
 */
export function generatePlayerActionHint(layers: readonly ShieldLayerState[]): string {
  const breached = layers.filter((l) => l.breached);
  if (breached.length > 0) {
    const names = breached.map((l) => LAYER_LABEL_DISPLAY_NAME[l.label]);
    if (breached.some((l) => getLayerConfig(l.layerId).cascadeGate)) {
      return `URGENT: ${names.join(' and ')} breached — cascade risk active. Play a repair card immediately.`;
    }
    return `${names.join(' and ')} breached. Focus repair on the most critical layer.`;
  }

  const critical = layers.filter(
    (l) => l.integrityRatio <= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD && !l.breached,
  );
  if (critical.length > 0) {
    const name = LAYER_LABEL_DISPLAY_NAME[critical[0].label];
    return `${name} is critically low. A repair card could prevent a breach.`;
  }

  const stressed = layers.filter(
    (l) => l.integrityRatio <= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD && !l.breached,
  );
  if (stressed.length > 0) {
    const name = LAYER_LABEL_DISPLAY_NAME[stressed[0].label];
    return `${name} is under stress. Consider reinforcing before the next attack.`;
  }

  const nearFortified = layers.filter(
    (l) => !l.breached
      && l.integrityRatio >= 0.65
      && l.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
  );
  if (nearFortified.length > 0) {
    const name = LAYER_LABEL_DISPLAY_NAME[nearFortified[0].label];
    return `${name} is close to fortification. A small boost would activate deflection bonuses.`;
  }

  const allFortified = layers.every(
    (l) => l.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
  );
  if (allFortified) {
    return 'All shields fortified. Your defenses are at peak strength.';
  }

  return 'Shields are stable. Monitor for incoming threats.';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — ATTACK ANALYSIS & CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map an AttackCategory to its primary ShieldDoctrineAttackType.
 * This is the canonical runtime lookup that maps game-primitive attack categories
 * to shield doctrine attack types.
 */
export function mapAttackCategoryToDoctrine(category: AttackCategory): ShieldDoctrineAttackType {
  return ATTACK_CATEGORY_DOCTRINE_MAP[category];
}

/**
 * Get the severity weight for an AttackCategory.
 * Used as a multiplier in severity scoring.
 */
export function getAttackCategorySeverityWeight(category: AttackCategory): number {
  return ATTACK_CATEGORY_SEVERITY_WEIGHT[category];
}

/**
 * Get the preferred target layer for a given AttackCategory.
 */
export function getAttackCategoryPreferredLayer(category: AttackCategory): ShieldLayerId {
  return ATTACK_CATEGORY_PREFERRED_LAYER[category];
}

/**
 * Classify attack severity into a tier based on magnitude and category weight.
 * Returns the severity tier and a numeric score.
 */
export function classifyAttackSeverity(
  category: AttackCategory,
  magnitude: number,
): { tier: AttackSeverityTier; score: number } {
  const weight = ATTACK_CATEGORY_SEVERITY_WEIGHT[category];
  const score = Math.min(1, magnitude * weight);

  let tier: AttackSeverityTier = 'NEGLIGIBLE';
  if (score >= SEVERITY_TIER_BOUNDARIES.CATASTROPHIC[0]) tier = 'CATASTROPHIC';
  else if (score >= SEVERITY_TIER_BOUNDARIES.SEVERE[0]) tier = 'SEVERE';
  else if (score >= SEVERITY_TIER_BOUNDARIES.MODERATE[0]) tier = 'MODERATE';
  else if (score >= SEVERITY_TIER_BOUNDARIES.MINOR[0]) tier = 'MINOR';

  return { tier, score };
}

/**
 * Classify an AttackEvent's severity by extracting its category and magnitude at runtime.
 */
export function classifyAttackEventSeverity(
  attack: AttackEvent,
): { tier: AttackSeverityTier; score: number } {
  return classifyAttackSeverity(attack.category, attack.magnitude);
}

/**
 * Validate that an AttackEvent has structurally valid fields for shield processing.
 * Returns an array of validation error strings. Empty array means valid.
 * Reads attack.source, attack.category, attack.targetLayer, attack.magnitude at runtime.
 */
export function validateAttackForShield(attack: AttackEvent): readonly string[] {
  const errors: string[] = [];

  if (!attack.attackId || attack.attackId.trim().length === 0) {
    errors.push('attackId is empty or missing');
  }

  if (attack.magnitude < 0) {
    errors.push(`magnitude is negative: ${attack.magnitude}`);
  }

  if (attack.magnitude > 1000) {
    errors.push(`magnitude exceeds maximum: ${attack.magnitude}`);
  }

  if (attack.createdAtTick < 0) {
    errors.push(`createdAtTick is negative: ${attack.createdAtTick}`);
  }

  // Validate category is a known AttackCategory value
  const knownCategories = ATTACK_CATEGORY_ORDER;
  if (!knownCategories.includes(attack.category)) {
    errors.push(`unknown attack category: ${attack.category}`);
  }

  // Validate target layer
  if (attack.targetLayer !== 'DIRECT' && !isShieldLayerId(attack.targetLayer)) {
    errors.push(`invalid targetLayer: ${attack.targetLayer}`);
  }

  // Validate source
  const validSources = ['BOT_01', 'BOT_02', 'BOT_03', 'BOT_04', 'BOT_05', 'OPPONENT', 'SYSTEM'];
  if (!validSources.includes(attack.source)) {
    errors.push(`unknown attack source: ${attack.source}`);
  }

  return errors;
}

/**
 * Determine if an attack source is a bot.
 * Reads attack.source at runtime for the check.
 */
export function isAttackSourceBot(attack: AttackEvent): boolean {
  const src = attack.source;
  return src === 'BOT_01' || src === 'BOT_02' || src === 'BOT_03'
    || src === 'BOT_04' || src === 'BOT_05';
}

/**
 * Get a UX-friendly label for an attack source.
 * Reads attack.source at runtime for ATTACK_SOURCE_UX_LABEL lookup.
 */
export function getAttackSourceUXLabel(attack: AttackEvent): string {
  return ATTACK_SOURCE_UX_LABEL[attack.source] ?? `Unknown source (${attack.source})`;
}

/**
 * Build a full AttackAnalysisResult from an AttackEvent.
 * This is the primary attack analysis function that extracts all UX-relevant data.
 */
export function analyzeAttack(attack: AttackEvent): AttackAnalysisResult {
  const severity = classifyAttackEventSeverity(attack);
  const doctrineType = mapAttackCategoryToDoctrine(attack.category);
  const aliasResolved = resolveShieldAlias(normalizeShieldNoteTags(attack.notes));
  const isShieldTargeted = attack.targetLayer !== 'DIRECT';
  const isBotSourced = isAttackSourceBot(attack);
  const uxDescription = ATTACK_CATEGORY_UX_DESCRIPTION[attack.category];
  const uxSourceLabel = getAttackSourceUXLabel(attack);

  return {
    attackId: attack.attackId,
    category: attack.category,
    source: attack.source,
    severityTier: severity.tier,
    severityScore: severity.score,
    doctrineType: aliasResolved ?? doctrineType,
    targetLayer: attack.targetLayer,
    isShieldTargeted,
    isBotSourced,
    magnitudeNormalized: Math.min(1, attack.magnitude),
    uxDescription,
    uxSourceLabel,
  };
}

/**
 * Analyze a batch of attacks and produce aggregate statistics.
 * Returns category breakdowns, severity distributions, and UX summary.
 */
export function analyzeAttackBatch(attacks: readonly AttackEvent[]): AttackBatchAnalysis {
  const results: AttackAnalysisResult[] = [];
  const categoryBreakdown: Record<AttackCategory, number> = {
    EXTRACTION: 0, LOCK: 0, DRAIN: 0, HEAT: 0, BREACH: 0, DEBT: 0,
  };
  const layerTargetBreakdown: Record<ShieldLayerId, number> = {
    L1: 0, L2: 0, L3: 0, L4: 0,
  };
  let directTargetCount = 0;
  let totalSeverity = 0;
  let maxSeverity = 0;

  for (const attack of attacks) {
    const result = analyzeAttack(attack);
    results.push(result);

    categoryBreakdown[attack.category]++;
    if (attack.targetLayer !== 'DIRECT' && isShieldLayerId(attack.targetLayer)) {
      layerTargetBreakdown[attack.targetLayer]++;
    } else {
      directTargetCount++;
    }

    totalSeverity += result.severityScore;
    if (result.severityScore > maxSeverity) {
      maxSeverity = result.severityScore;
    }
  }

  const averageSeverity = attacks.length > 0 ? totalSeverity / attacks.length : 0;

  // Find dominant category
  let dominantCategory: AttackCategory = 'EXTRACTION';
  let maxCategoryCount = 0;
  for (const cat of ATTACK_CATEGORY_ORDER) {
    if (categoryBreakdown[cat] > maxCategoryCount) {
      maxCategoryCount = categoryBreakdown[cat];
      dominantCategory = cat;
    }
  }

  const dominantDoctrineType = mapAttackCategoryToDoctrine(dominantCategory);

  const uxBatchSummary = buildAttackBatchUXSummary(
    attacks.length,
    averageSeverity,
    dominantCategory,
    directTargetCount,
  );

  return {
    attacks: results,
    totalCount: attacks.length,
    categoryBreakdown,
    averageSeverity,
    maxSeverity,
    dominantCategory,
    dominantDoctrineType,
    layerTargetBreakdown,
    directTargetCount,
    uxBatchSummary,
  };
}

/**
 * Build a UX summary string for an attack batch.
 */
function buildAttackBatchUXSummary(
  totalCount: number,
  averageSeverity: number,
  dominantCategory: AttackCategory,
  directTargetCount: number,
): string {
  if (totalCount === 0) return 'No active attacks detected.';

  const categoryName = ATTACK_CATEGORY_UX_SHORT_NAME[dominantCategory];
  const severityLabel = averageSeverity >= 0.6 ? 'heavy' : averageSeverity >= 0.3 ? 'moderate' : 'light';

  const parts: string[] = [];
  parts.push(`${totalCount} attack${totalCount !== 1 ? 's' : ''} detected.`);
  parts.push(`Average severity: ${severityLabel}.`);
  parts.push(`Dominant type: ${categoryName}.`);
  if (directTargetCount > 0) {
    parts.push(`${directTargetCount} bypassing shields directly.`);
  }

  return parts.join(' ');
}

/**
 * Compute doctrine coherence — how focused an attack pattern is on a single doctrine.
 * A coherent attack pattern suggests coordinated enemy strategy.
 */
export function computeDoctrineCoherence(
  attacks: readonly AttackEvent[],
): DoctrineCoherenceResult {
  if (attacks.length === 0) {
    return {
      score: 0,
      dominantDoctrine: null,
      doctrineDistribution: new Map(),
      isCoherent: false,
      uxCoherenceLabel: 'No attacks to analyze.',
    };
  }

  const counts = new Map<ShieldDoctrineAttackType, number>();
  for (const attack of attacks) {
    const doctrine = mapAttackCategoryToDoctrine(attack.category);
    counts.set(doctrine, (counts.get(doctrine) ?? 0) + 1);
  }

  let maxCount = 0;
  let dominant: ShieldDoctrineAttackType | null = null;
  for (const [doctrine, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominant = doctrine;
    }
  }

  const score = attacks.length > 0 ? maxCount / attacks.length : 0;
  const isCoherent = score >= 0.6;

  let uxCoherenceLabel: string;
  if (score >= 0.8) {
    uxCoherenceLabel = `Highly focused attack pattern — ${dominant ? DOCTRINE_TYPE_UX_DESCRIPTION[dominant] : 'Unknown'}`;
  } else if (score >= 0.6) {
    uxCoherenceLabel = 'Moderately coordinated attacks with a dominant pattern.';
  } else if (score >= 0.3) {
    uxCoherenceLabel = 'Scattered attack pattern with no dominant strategy.';
  } else {
    uxCoherenceLabel = 'Chaotic and unfocused attacks — no clear strategy detected.';
  }

  return {
    score,
    dominantDoctrine: dominant,
    doctrineDistribution: counts,
    isCoherent,
    uxCoherenceLabel,
  };
}

/**
 * Detect patterns in a batch of attacks based on timing, category, and layer targeting.
 * Returns identified pattern signals with confidence scores.
 */
export function detectAttackPatterns(
  attacks: readonly AttackEvent[],
): readonly AttackPatternSignal[] {
  if (attacks.length < 2) return [];

  const patterns: AttackPatternSignal[] = [];
  const sorted = [...attacks].sort((a, b) => a.createdAtTick - b.createdAtTick);

  // Pattern 1: Layer focus — multiple attacks on the same layer within a short window
  const layerClusters: Record<string, AttackEvent[]> = {};
  for (const attack of sorted) {
    if (attack.targetLayer !== 'DIRECT') {
      const key = attack.targetLayer;
      if (!layerClusters[key]) layerClusters[key] = [];
      layerClusters[key].push(attack);
    }
  }

  for (const [layerKey, cluster] of Object.entries(layerClusters)) {
    if (cluster.length >= 2 && isShieldLayerId(layerKey)) {
      const tickSpan = cluster[cluster.length - 1].createdAtTick - cluster[0].createdAtTick;
      if (tickSpan <= 10) {
        const categories = [...new Set(cluster.map((a) => a.category))];
        const displayName = LAYER_LABEL_DISPLAY_NAME[getLayerConfig(layerKey).label];
        patterns.push({
          patternId: `layer-focus-${layerKey}`,
          description: `Concentrated attack on ${displayName}: ${cluster.length} hits in ${tickSpan} ticks.`,
          confidence: Math.min(1, cluster.length / 4),
          involvedCategories: categories,
          involvedLayers: [layerKey],
          tickSpan,
          attackCount: cluster.length,
        });
      }
    }
  }

  // Pattern 2: Category burst — multiple attacks of the same category in rapid succession
  const categoryClusters: Partial<Record<AttackCategory, AttackEvent[]>> = {};
  for (const attack of sorted) {
    if (!categoryClusters[attack.category]) categoryClusters[attack.category] = [];
    categoryClusters[attack.category]!.push(attack);
  }

  for (const cat of ATTACK_CATEGORY_ORDER) {
    const cluster = categoryClusters[cat];
    if (cluster && cluster.length >= 3) {
      const tickSpan = cluster[cluster.length - 1].createdAtTick - cluster[0].createdAtTick;
      if (tickSpan <= 15) {
        const involvedLayers = [...new Set(
          cluster
            .filter((a) => a.targetLayer !== 'DIRECT' && isShieldLayerId(a.targetLayer))
            .map((a) => a.targetLayer as ShieldLayerId),
        )];
        const catName = ATTACK_CATEGORY_UX_SHORT_NAME[cat];
        patterns.push({
          patternId: `category-burst-${cat}`,
          description: `${catName} burst: ${cluster.length} attacks in ${tickSpan} ticks.`,
          confidence: Math.min(1, cluster.length / 5),
          involvedCategories: [cat],
          involvedLayers,
          tickSpan,
          attackCount: cluster.length,
        });
      }
    }
  }

  // Pattern 3: Escalation — attacks increasing in magnitude over time
  if (sorted.length >= 3) {
    let escalationCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].magnitude > sorted[i - 1].magnitude) escalationCount++;
    }
    const escalationRatio = escalationCount / (sorted.length - 1);
    if (escalationRatio >= 0.6) {
      const categories = [...new Set(sorted.map((a) => a.category))];
      const involvedLayers = [...new Set(
        sorted
          .filter((a) => a.targetLayer !== 'DIRECT' && isShieldLayerId(a.targetLayer))
          .map((a) => a.targetLayer as ShieldLayerId),
      )];
      const tickSpan = sorted[sorted.length - 1].createdAtTick - sorted[0].createdAtTick;
      patterns.push({
        patternId: 'escalation',
        description: `Attack magnitude is escalating over ${sorted.length} attacks.`,
        confidence: escalationRatio,
        involvedCategories: categories,
        involvedLayers,
        tickSpan,
        attackCount: sorted.length,
      });
    }
  }

  // Pattern 4: Multi-vector — different categories hitting different layers simultaneously
  if (sorted.length >= 3) {
    const uniqueCategories = new Set(sorted.map((a) => a.category));
    const uniqueLayers = new Set(
      sorted
        .filter((a) => a.targetLayer !== 'DIRECT' && isShieldLayerId(a.targetLayer))
        .map((a) => a.targetLayer as ShieldLayerId),
    );
    if (uniqueCategories.size >= 3 && uniqueLayers.size >= 2) {
      const tickSpan = sorted[sorted.length - 1].createdAtTick - sorted[0].createdAtTick;
      patterns.push({
        patternId: 'multi-vector',
        description: `Multi-vector assault: ${uniqueCategories.size} attack types across ${uniqueLayers.size} layers.`,
        confidence: Math.min(1, (uniqueCategories.size * uniqueLayers.size) / 12),
        involvedCategories: [...uniqueCategories],
        involvedLayers: [...uniqueLayers],
        tickSpan,
        attackCount: sorted.length,
      });
    }
  }

  // Pattern 5: Bot swarm — multiple bot sources attacking in same window
  if (sorted.length >= 2) {
    const botAttacks = sorted.filter((a) => isAttackSourceBot(a));
    const uniqueBots = new Set(botAttacks.map((a) => a.source));
    if (uniqueBots.size >= 2) {
      const tickSpan = botAttacks.length >= 2
        ? botAttacks[botAttacks.length - 1].createdAtTick - botAttacks[0].createdAtTick
        : 0;
      if (tickSpan <= 10) {
        const categories = [...new Set(botAttacks.map((a) => a.category))];
        const involvedLayers = [...new Set(
          botAttacks
            .filter((a) => a.targetLayer !== 'DIRECT' && isShieldLayerId(a.targetLayer))
            .map((a) => a.targetLayer as ShieldLayerId),
        )];
        patterns.push({
          patternId: 'bot-swarm',
          description: `${uniqueBots.size} bots attacking simultaneously.`,
          confidence: Math.min(1, uniqueBots.size / 4),
          involvedCategories: categories,
          involvedLayers,
          tickSpan,
          attackCount: botAttacks.length,
        });
      }
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if an attack is targeting its category's preferred layer.
 * Deviation from preferred layer may indicate strategic adaptation.
 */
export function isAttackOnPreferredLayer(attack: AttackEvent): boolean {
  if (attack.targetLayer === 'DIRECT') return false;
  const preferred = ATTACK_CATEGORY_PREFERRED_LAYER[attack.category];
  return attack.targetLayer === preferred;
}

/**
 * Compute the "heat concentration" for a set of attacks on a specific layer.
 * Returns 0-1 where 1 means all attack heat is focused on this one layer.
 */
export function computeLayerHeatConcentration(
  attacks: readonly AttackEvent[],
  layerId: ShieldLayerId,
): number {
  if (attacks.length === 0) return 0;
  const layerAttacks = attacks.filter(
    (a) => a.targetLayer === layerId,
  );
  const totalMagnitude = attacks.reduce((sum, a) => sum + a.magnitude, 0);
  const layerMagnitude = layerAttacks.reduce((sum, a) => sum + a.magnitude, 0);
  return totalMagnitude > 0 ? layerMagnitude / totalMagnitude : 0;
}

/**
 * Generate UX copy for a single attack suitable for a notification or log entry.
 */
export function generateAttackUXCopy(attack: AttackEvent): { headline: string; body: string } {
  const analysis = analyzeAttack(attack);
  const severityDesc = SEVERITY_TIER_UX_DESCRIPTION[analysis.severityTier];

  let targetDesc: string;
  if (attack.targetLayer === 'DIRECT') {
    targetDesc = 'bypassing shields entirely';
  } else {
    const config = getLayerConfig(attack.targetLayer);
    targetDesc = `targeting ${LAYER_LABEL_DISPLAY_NAME[config.label]}`;
  }

  const headline = `${analysis.uxSourceLabel} — ${ATTACK_CATEGORY_UX_SHORT_NAME[attack.category]} attack`;
  const body = `${severityDesc} ${targetDesc}. ${analysis.uxDescription}`;

  return { headline, body };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — REPAIR PLANNING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score repair priority for each layer.
 * Higher scores mean the layer should be repaired first.
 * Factors: integrity deficit, cascade risk, recent damage, layer weight.
 */
export function scoreRepairPriorities(
  layers: readonly ShieldLayerState[],
  currentTick: number,
): readonly RepairPriorityEntry[] {
  const entries: RepairPriorityEntry[] = [];

  for (const layer of layers) {
    const reasons: string[] = [];
    let score = 0;
    const config = getLayerConfig(layer.layerId);
    const weight = LAYER_HEALTH_WEIGHT[layer.layerId];
    const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];

    // Integrity deficit is the primary driver
    const deficit = 1 - layer.integrityRatio;
    score += deficit * 0.40;
    if (deficit > 0) reasons.push(`${Math.round(deficit * 100)}% integrity deficit`);

    // Breached layers get emergency priority
    if (layer.breached) {
      score += 0.25;
      reasons.push('Layer is breached');
    }

    // Cascade gate layers get additional priority
    if (config.cascadeGate && layer.integrityRatio < SHIELD_CONSTANTS.CASCADE_CRACK_RATIO) {
      score += 0.20;
      reasons.push('Cascade risk — gate layer below crack threshold');
    } else if (config.cascadeGate && layer.integrityRatio < 0.5) {
      score += 0.10;
      reasons.push('Cascade gate layer below 50%');
    }

    // Layer weight affects priority
    score += weight * 0.10;

    // Recent damage elevates priority
    if (layer.lastDamagedTick !== null) {
      const ticksSinceDamage = currentTick - layer.lastDamagedTick;
      if (ticksSinceDamage < 3) {
        score += 0.05;
        reasons.push('Damaged very recently');
      }
    }

    // No regen means only active repair can fix it
    if (layer.regenPerTick === 0 && !layer.breached && layer.integrityRatio < 1) {
      score += 0.05;
      reasons.push('No passive regeneration');
    }

    // Suggested repair amount based on deficit and layer max
    const suggestedAmount = Math.ceil((1 - layer.integrityRatio) * layer.max);

    let urgencyLabel: string;
    if (score >= 0.7) urgencyLabel = 'CRITICAL';
    else if (score >= 0.5) urgencyLabel = 'HIGH';
    else if (score >= 0.3) urgencyLabel = 'MEDIUM';
    else if (score >= 0.1) urgencyLabel = 'LOW';
    else urgencyLabel = 'NONE';

    if (reasons.length === 0) reasons.push(`${displayName} is in good condition`);

    entries.push({
      layerId: layer.layerId,
      label: layer.label,
      priorityScore: Math.min(1, score),
      reasons,
      suggestedAmount,
      urgencyLabel,
    });
  }

  return entries.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Estimate repair cost for bringing each layer to a target integrity.
 * Default target is full (1.0).
 */
export function estimateRepairCosts(
  layers: readonly ShieldLayerState[],
  targetRatio: number = 1.0,
): readonly RepairCostEstimate[] {
  return layers.map((layer) => {
    const targetHp = Math.ceil(layer.max * Math.min(1, targetRatio));
    const deficit = Math.max(0, targetHp - layer.current);
    const costPerHp = LAYER_REPAIR_COST_PER_HP[layer.layerId];
    const estimatedCost = deficit * costPerHp;
    const repairSpeed = LAYER_REPAIR_SPEED[layer.layerId];
    const durationTicks = repairSpeed > 0 ? Math.ceil(deficit / repairSpeed) : Infinity;
    const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];

    let uxCostLabel: string;
    if (deficit === 0) {
      uxCostLabel = `${displayName} is already at target capacity.`;
    } else if (estimatedCost <= 10) {
      uxCostLabel = `${displayName}: minor repair — ${deficit} HP for ${estimatedCost} resources.`;
    } else if (estimatedCost <= 50) {
      uxCostLabel = `${displayName}: moderate repair — ${deficit} HP for ${estimatedCost} resources.`;
    } else {
      uxCostLabel = `${displayName}: major repair — ${deficit} HP for ${estimatedCost} resources over ${durationTicks} ticks.`;
    }

    return {
      layerId: layer.layerId,
      label: layer.label,
      deficit,
      estimatedCost,
      costPerHp,
      durationTicks,
      uxCostLabel,
    };
  });
}

/**
 * Recommend a repair strategy based on the current shield state.
 * Examines layer states to determine the best approach.
 */
export function recommendRepairStrategy(
  layers: readonly ShieldLayerState[],
): RepairStrategyRecommendation {
  const breached = layers.filter((l) => l.breached);
  const critical = layers.filter(
    (l) => !l.breached && l.integrityRatio <= SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD,
  );
  const stressed = layers.filter(
    (l) => !l.breached && l.integrityRatio <= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD
      && l.integrityRatio > SHIELD_CONSTANTS.CRITICAL_WARNING_THRESHOLD,
  );
  const healthy = layers.filter(
    (l) => l.integrityRatio > SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD,
  );

  // Check L4 cascade risk specifically
  const l4State = layers.find((l) => l.layerId === 'L4');
  const l4CascadeRisk = l4State !== undefined && isLayerAtCascadeRisk(l4State);

  // Strategy: CASCADE_PREVENTION if L4 is at risk
  if (l4CascadeRisk) {
    const ticksEstimate = l4State!.regenPerTick > 0
      ? Math.ceil((l4State!.max * SHIELD_CONSTANTS.CASCADE_CRACK_RATIO - l4State!.current) / l4State!.regenPerTick)
      : 50;
    return {
      strategy: 'CASCADE_PREVENTION',
      confidence: 0.9,
      reasoning: 'L4 network core is below cascade crack threshold. Preventing cascade is the highest priority.',
      targetLayers: ['L4'],
      estimatedTicksToStable: Math.max(0, ticksEstimate),
      uxRecommendationText: REPAIR_STRATEGY_UX_DESCRIPTION.CASCADE_PREVENTION,
    };
  }

  // Strategy: TRIAGE_CRITICAL if any layer is breached or critically low
  if (breached.length > 0 || critical.length > 0) {
    const targetLayers = [...breached, ...critical]
      .sort((a, b) => a.integrityRatio - b.integrityRatio)
      .map((l) => l.layerId);
    const worstLayer = targetLayers[0];
    const worstState = layers.find((l) => l.layerId === worstLayer);
    const ticksEstimate = worstState && worstState.regenPerTick > 0
      ? Math.ceil((worstState.max * SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD) / worstState.regenPerTick)
      : 30;

    return {
      strategy: 'TRIAGE_CRITICAL',
      confidence: 0.85,
      reasoning: `${breached.length} breached and ${critical.length} critical layers require immediate triage.`,
      targetLayers,
      estimatedTicksToStable: ticksEstimate,
      uxRecommendationText: REPAIR_STRATEGY_UX_DESCRIPTION.TRIAGE_CRITICAL,
    };
  }

  // Strategy: SPREAD_HEAL if multiple layers are stressed but none critical
  if (stressed.length >= 2) {
    const targetLayers = stressed.map((l) => l.layerId);
    return {
      strategy: 'SPREAD_HEAL',
      confidence: 0.70,
      reasoning: `${stressed.length} layers are stressed. Spreading repair prevents any single layer from becoming critical.`,
      targetLayers,
      estimatedTicksToStable: 15,
      uxRecommendationText: REPAIR_STRATEGY_UX_DESCRIPTION.SPREAD_HEAL,
    };
  }

  // Strategy: FORTIFY_STRONGEST if most layers are healthy and one is close to fortification
  const nearFortified = healthy.filter(
    (l) => l.integrityRatio >= 0.65 && l.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD,
  );
  if (nearFortified.length > 0 && breached.length === 0 && critical.length === 0) {
    const target = nearFortified.sort(
      (a, b) => b.integrityRatio - a.integrityRatio,
    )[0];
    const deficit = target.max * SHIELD_CONSTANTS.FORTIFIED_THRESHOLD - target.current;
    const ticksEstimate = target.regenPerTick > 0
      ? Math.ceil(deficit / target.regenPerTick)
      : 10;

    return {
      strategy: 'FORTIFY_STRONGEST',
      confidence: 0.60,
      reasoning: `${LAYER_LABEL_DISPLAY_NAME[target.label]} is close to fortification. Boosting it activates deflection bonuses.`,
      targetLayers: [target.layerId],
      estimatedTicksToStable: ticksEstimate,
      uxRecommendationText: REPAIR_STRATEGY_UX_DESCRIPTION.FORTIFY_STRONGEST,
    };
  }

  // Strategy: PASSIVE_RECOVERY if everything is in decent shape
  return {
    strategy: 'PASSIVE_RECOVERY',
    confidence: 0.90,
    reasoning: 'All layers are in acceptable condition. Passive regeneration will handle recovery.',
    targetLayers: [],
    estimatedTicksToStable: 0,
    uxRecommendationText: REPAIR_STRATEGY_UX_DESCRIPTION.PASSIVE_RECOVERY,
  };
}

/**
 * Analyze repair queue saturation per layer.
 * Determines whether the repair queue can accept new jobs.
 */
export function analyzeRepairQueueSaturation(
  activeJobs: readonly RepairJob[],
): readonly RepairQueueSaturationReport[] {
  const reports: RepairQueueSaturationReport[] = [];

  for (const layerId of SHIELD_LAYER_ORDER) {
    const config = getLayerConfig(layerId);
    const layerJobs = activeJobs.filter(
      (j) => j.layerId === layerId || j.layerId === 'ALL',
    );
    const activeCount = layerJobs.filter((j) => j.ticksRemaining > 0).length;
    const maxJobs = SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;
    const saturationRatio = maxJobs > 0 ? activeCount / maxJobs : 0;
    const isSaturated = activeCount >= maxJobs;
    const queuedAmount = layerJobs.reduce((sum, j) => sum + (j.amount - j.delivered), 0);
    const displayName = LAYER_LABEL_DISPLAY_NAME[config.label];

    let uxSaturationLabel: string;
    if (isSaturated) {
      uxSaturationLabel = `${displayName} repair queue is full (${activeCount}/${maxJobs}). New repairs will be rejected.`;
    } else if (saturationRatio >= 0.67) {
      uxSaturationLabel = `${displayName} repair queue is nearly full (${activeCount}/${maxJobs}).`;
    } else if (activeCount > 0) {
      uxSaturationLabel = `${displayName} has ${activeCount} active repair${activeCount !== 1 ? 's' : ''}.`;
    } else {
      uxSaturationLabel = `${displayName} repair queue is empty.`;
    }

    reports.push({
      layerId,
      label: config.label,
      activeJobs: activeCount,
      maxJobs,
      saturationRatio: Math.min(1, saturationRatio),
      isSaturated,
      queuedAmount,
      uxSaturationLabel,
    });
  }

  return reports;
}

/**
 * Predict the effectiveness of a proposed repair on a given layer.
 * Accounts for overflow (repair exceeding max) and queue limits.
 */
export function predictRepairEffectiveness(
  layer: ShieldLayerState,
  proposedAmount: number,
  activeJobCount: number,
): RepairEffectivenessPrediction {
  const maxJobs = SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;
  const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];

  // If queue is full, repair is completely ineffective
  if (activeJobCount >= maxJobs) {
    return {
      layerId: layer.layerId,
      label: layer.label,
      proposedAmount,
      effectiveAmount: 0,
      wasteAmount: proposedAmount,
      efficiencyRatio: 0,
      wouldReachFortified: false,
      postRepairIntegrity: layer.integrityRatio,
      uxEffectivenessLabel: `${displayName} repair queue is full. This repair would be rejected.`,
    };
  }

  const deficit = layer.max - layer.current;
  const effectiveAmount = Math.min(proposedAmount, deficit);
  const wasteAmount = Math.max(0, proposedAmount - deficit);
  const efficiencyRatio = proposedAmount > 0 ? effectiveAmount / proposedAmount : 0;

  const postRepairCurrent = layer.current + effectiveAmount;
  const postRepairIntegrity = layer.max > 0 ? postRepairCurrent / layer.max : 0;
  const fortifiedThreshold = layer.max * SHIELD_CONSTANTS.FORTIFIED_THRESHOLD;
  const wouldReachFortified = postRepairCurrent >= fortifiedThreshold;

  let uxEffectivenessLabel: string;
  if (deficit === 0) {
    uxEffectivenessLabel = `${displayName} is already at full capacity. Repair would be wasted.`;
  } else if (wasteAmount > 0) {
    uxEffectivenessLabel = `${displayName}: ${effectiveAmount} HP effective, ${wasteAmount} HP wasted (overflow).`;
  } else if (wouldReachFortified && layer.integrityRatio < SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) {
    uxEffectivenessLabel = `${displayName}: ${effectiveAmount} HP applied — this would reach fortified status!`;
  } else {
    uxEffectivenessLabel = `${displayName}: ${effectiveAmount} HP effective at ${Math.round(efficiencyRatio * 100)}% efficiency.`;
  }

  return {
    layerId: layer.layerId,
    label: layer.label,
    proposedAmount,
    effectiveAmount,
    wasteAmount,
    efficiencyRatio,
    wouldReachFortified,
    postRepairIntegrity,
    uxEffectivenessLabel,
  };
}

/**
 * Compute the optimal distribution of a fixed repair budget across layers.
 * Returns the recommended HP allocation per layer.
 */
export function computeOptimalRepairDistribution(
  layers: readonly ShieldLayerState[],
  totalBudgetHp: number,
  currentTick: number,
): readonly { layerId: ShieldLayerId; label: ShieldLayerLabel; allocatedHp: number; reason: string }[] {
  if (totalBudgetHp <= 0 || layers.length === 0) {
    return layers.map((l) => ({
      layerId: l.layerId,
      label: l.label,
      allocatedHp: 0,
      reason: 'No budget available.',
    }));
  }

  const priorities = scoreRepairPriorities(layers, currentTick);
  const totalPriority = priorities.reduce((sum, p) => sum + p.priorityScore, 0);

  if (totalPriority === 0) {
    return layers.map((l) => ({
      layerId: l.layerId,
      label: l.label,
      allocatedHp: 0,
      reason: 'No repair needed.',
    }));
  }

  let remainingBudget = totalBudgetHp;
  const allocations: { layerId: ShieldLayerId; label: ShieldLayerLabel; allocatedHp: number; reason: string }[] = [];

  for (const entry of priorities) {
    const layer = layers.find((l) => l.layerId === entry.layerId);
    if (!layer) continue;

    const deficit = layer.max - layer.current;
    const proportionalShare = (entry.priorityScore / totalPriority) * totalBudgetHp;
    const allocated = Math.min(remainingBudget, deficit, Math.ceil(proportionalShare));
    remainingBudget -= allocated;

    allocations.push({
      layerId: entry.layerId,
      label: entry.label,
      allocatedHp: allocated,
      reason: allocated > 0
        ? `Allocated ${allocated} HP (priority: ${entry.urgencyLabel}).`
        : entry.suggestedAmount === 0
          ? 'Layer is at full capacity.'
          : 'Budget exhausted before reaching this layer.',
    });
  }

  return allocations;
}

/**
 * Estimate how many ticks until a repair job delivers all remaining HP.
 */
export function estimateRepairJobCompletion(job: RepairJob): {
  ticksRemaining: number;
  hpRemaining: number;
  completionRatio: number;
} {
  const hpRemaining = job.amount - job.delivered;
  const completionRatio = job.amount > 0 ? job.delivered / job.amount : 1;
  return {
    ticksRemaining: job.ticksRemaining,
    hpRemaining: Math.max(0, hpRemaining),
    completionRatio: Math.min(1, completionRatio),
  };
}

/**
 * Generate UX copy for a repair job status.
 */
export function generateRepairJobUXCopy(job: RepairJob): { headline: string; body: string } {
  const completion = estimateRepairJobCompletion(job);
  const sourceLabel = REPAIR_SOURCE_UX_LABEL[job.source];
  let targetLabel: string;
  if (job.layerId === 'ALL') {
    targetLabel = 'all shield layers';
  } else if (isShieldLayerId(job.layerId)) {
    const config = getLayerConfig(job.layerId);
    targetLabel = LAYER_LABEL_DISPLAY_NAME[config.label];
  } else {
    targetLabel = 'unknown layer';
  }

  const pctComplete = Math.round(completion.completionRatio * 100);

  if (completion.ticksRemaining <= 0) {
    return {
      headline: `Repair complete on ${targetLabel}.`,
      body: `${sourceLabel} delivered ${job.delivered} HP to ${targetLabel}.`,
    };
  }

  return {
    headline: `Repairing ${targetLabel} — ${pctComplete}% complete.`,
    body: `${sourceLabel} restoring ${targetLabel}. ${completion.hpRemaining} HP remaining, ${completion.ticksRemaining} ticks to go.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — ML / DL FEATURE EXTRACTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fixed-length ML feature vector from the current shield state.
 * All features are deterministic and normalized to [0, 1] where applicable.
 * Uses ShieldLayerState fields at runtime for feature extraction.
 */
export function buildShieldMLFeatureVector(
  layers: readonly ShieldLayerState[],
): ShieldMLFeatureVector {
  // Ensure deterministic ordering by layerOrderIndex
  const ordered = [...layers].sort(
    (a, b) => layerOrderIndex(a.layerId) - layerOrderIndex(b.layerId),
  );

  const layerIntegrities: number[] = [];
  const layerBreachedFlags: number[] = [];
  const layerRegenRates: number[] = [];
  let breachedCount = 0;
  let fortifiedCount = 0;
  let weakestIndex = 0;
  let weakestRatio = Infinity;
  let maxDeficit = 0;
  let totalTicksSinceDamage = 0;
  let damageCount = 0;

  for (let i = 0; i < ordered.length; i++) {
    const layer = ordered[i];
    layerIntegrities.push(layer.integrityRatio);
    layerBreachedFlags.push(layer.breached ? 1 : 0);

    // Normalize regen rate to [0, 1] based on config max
    const config = getLayerConfig(layer.layerId);
    const normalizedRegen = config.passiveRegenRate > 0
      ? layer.regenPerTick / config.passiveRegenRate
      : 0;
    layerRegenRates.push(normalizedRegen);

    if (layer.breached) breachedCount++;
    if (layer.integrityRatio >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD) fortifiedCount++;
    if (layer.integrityRatio < weakestRatio) {
      weakestRatio = layer.integrityRatio;
      weakestIndex = i;
    }

    const deficit = layer.max - layer.current;
    if (deficit > maxDeficit) maxDeficit = deficit;

    if (layer.lastDamagedTick !== null) {
      // Use lastDamagedTick directly as a feature component
      totalTicksSinceDamage += layer.lastDamagedTick;
      damageCount++;
    }
  }

  const overallIntegrity = computeWeightedIntegrity(ordered);
  const grade = computeGradeFromScore(overallIntegrity);
  const gradeNumeric = gradeToNumericMidpoint(grade);
  const avgTicksSinceLastDamage = damageCount > 0 ? totalTicksSinceDamage / damageCount : 0;

  // Normalize maxDeficit to [0, 1] based on maximum possible deficit
  const maxPossibleDeficit = Math.max(
    ...SHIELD_LAYER_ORDER.map((id) => getLayerConfig(id).max),
  );
  const normalizedMaxDeficit = maxPossibleDeficit > 0 ? maxDeficit / maxPossibleDeficit : 0;

  // Cascade risk: 1 if L4 is at cascade risk, 0 otherwise
  const l4Layer = ordered.find((l) => l.layerId === 'L4');
  const cascadeRisk = l4Layer !== undefined && isLayerAtCascadeRisk(l4Layer) ? 1 : 0;

  return {
    layerIntegrities,
    layerBreachedFlags,
    layerRegenRates,
    overallIntegrity,
    breachedCount,
    weakestLayerIndex: weakestIndex,
    fortifiedCount,
    gradeNumeric,
    avgTicksSinceLastDamage,
    maxDeficit: normalizedMaxDeficit,
    cascadeRisk,
  };
}

/**
 * Extract per-layer integrity features as a flat array for ML consumption.
 * Returns [L1_integrity, L1_breached, L1_regen, L2_integrity, ...] (12 features total).
 * Uses ShieldLayerState.label to verify correct layer ordering.
 */
export function extractLayerIntegrityFeatures(
  layers: readonly ShieldLayerState[],
): readonly number[] {
  const features: number[] = [];
  for (const layerId of SHIELD_LAYER_ORDER) {
    const layer = layers.find((l) => l.layerId === layerId);
    if (layer) {
      // Verify label matches expected config
      const expectedLabel = getLayerConfig(layerId).label;
      const labelMatch = layer.label === expectedLabel ? 1 : 0;
      features.push(layer.integrityRatio);
      features.push(layer.breached ? 1 : 0);
      features.push(layer.regenPerTick);
      features.push(labelMatch); // Integrity check feature
    } else {
      features.push(0, 1, 0, 0); // Missing layer: zero integrity, breached, no regen, no match
    }
  }
  return features;
}

/**
 * Build an attack pattern feature vector from a batch of attacks.
 * All features are normalized and deterministically ordered.
 * Uses AttackCategory and AttackEvent fields at runtime.
 */
export function buildAttackPatternFeatureVector(
  attacks: readonly AttackEvent[],
  windowTicks: number,
): AttackPatternFeatureVector {
  // Category distribution: count per category normalized by total
  const categoryCounts: number[] = new Array(ATTACK_CATEGORY_ORDER.length).fill(0);
  let totalMagnitude = 0;
  let maxMagnitude = 0;
  let botCount = 0;
  let directCount = 0;
  const layerCounts: number[] = new Array(SHIELD_LAYER_ORDER.length).fill(0);
  const severityCounts: number[] = new Array(SEVERITY_TIER_ORDER.length).fill(0);

  for (const attack of attacks) {
    // Category distribution
    const catIndex = ATTACK_CATEGORY_ORDER.indexOf(attack.category);
    if (catIndex >= 0) categoryCounts[catIndex]++;

    totalMagnitude += attack.magnitude;
    if (attack.magnitude > maxMagnitude) maxMagnitude = attack.magnitude;

    // Bot source tracking
    if (isAttackSourceBot(attack)) botCount++;

    // Layer targeting
    if (attack.targetLayer === 'DIRECT') {
      directCount++;
    } else {
      const layerIndex = SHIELD_LAYER_ORDER.indexOf(attack.targetLayer);
      if (layerIndex >= 0) layerCounts[layerIndex]++;
    }

    // Severity distribution
    const severity = classifyAttackSeverity(attack.category, attack.magnitude);
    const sevIndex = SEVERITY_TIER_ORDER.indexOf(severity.tier);
    if (sevIndex >= 0) severityCounts[sevIndex]++;
  }

  const total = attacks.length;
  const categoryDistribution = total > 0
    ? categoryCounts.map((c) => c / total)
    : categoryCounts;

  const avgMagnitude = total > 0 ? totalMagnitude / total : 0;
  const attackRate = windowTicks > 0 ? total / windowTicks : 0;

  const layerConcentration = total > 0
    ? layerCounts.map((c) => c / total)
    : layerCounts;

  const directTargetRatio = total > 0 ? directCount / total : 0;
  const botSourceRatio = total > 0 ? botCount / total : 0;

  // Doctrine coherence as a single numeric feature
  const coherence = computeDoctrineCoherence(attacks);

  const severityDistribution = total > 0
    ? severityCounts.map((c) => c / total)
    : severityCounts;

  return {
    categoryDistribution,
    avgMagnitude,
    maxMagnitude,
    attackRate,
    layerConcentration,
    directTargetRatio,
    botSourceRatio,
    doctrineCoherence: coherence.score,
    severityDistribution,
  };
}

/**
 * Build a repair efficiency feature vector from active repair jobs.
 * Used for ML models that predict optimal repair strategy.
 */
export function buildRepairEfficiencyFeatureVector(
  jobs: readonly RepairJob[],
  layers: readonly ShieldLayerState[],
): RepairEfficiencyFeatureVector {
  // Saturation by layer (ordered)
  const saturationByLayer: number[] = [];
  const maxJobs = SHIELD_CONSTANTS.MAX_ACTIVE_REPAIR_JOBS_PER_LAYER;

  for (const layerId of SHIELD_LAYER_ORDER) {
    const layerJobs = jobs.filter(
      (j) => j.layerId === layerId || j.layerId === 'ALL',
    );
    const activeCount = layerJobs.filter((j) => j.ticksRemaining > 0).length;
    saturationByLayer.push(maxJobs > 0 ? activeCount / maxJobs : 0);
  }

  const activeJobs = jobs.filter((j) => j.ticksRemaining > 0);
  const totalQueued = activeJobs.reduce((sum, j) => sum + (j.amount - j.delivered), 0);
  const avgRepairAmount = activeJobs.length > 0
    ? activeJobs.reduce((sum, j) => sum + j.amount, 0) / activeJobs.length
    : 0;

  // Total deficit across all layers
  const totalDeficit = layers.reduce((sum, l) => sum + (l.max - l.current), 0);
  const repairToDeficitRatio = totalDeficit > 0 ? Math.min(1, totalQueued / totalDeficit) : 0;

  // Source distribution
  const cardJobs = activeJobs.filter((j) => j.source === 'CARD').length;
  const systemJobs = activeJobs.filter((j) => j.source === 'SYSTEM').length;
  const cardSourceRatio = activeJobs.length > 0 ? cardJobs / activeJobs.length : 0;
  const systemSourceRatio = activeJobs.length > 0 ? systemJobs / activeJobs.length : 0;

  // Average duration and delivery ratio
  const avgDurationTicks = activeJobs.length > 0
    ? activeJobs.reduce((sum, j) => sum + j.durationTicks, 0) / activeJobs.length
    : 0;
  const avgDeliveredRatio = activeJobs.length > 0
    ? activeJobs.reduce((sum, j) => sum + (j.amount > 0 ? j.delivered / j.amount : 0), 0) / activeJobs.length
    : 0;

  return {
    saturationByLayer,
    avgRepairAmount,
    totalQueued,
    repairToDeficitRatio,
    cardSourceRatio,
    systemSourceRatio,
    avgDurationTicks,
    avgDeliveredRatio,
  };
}

/**
 * Flatten a ShieldMLFeatureVector into a plain number array for model input.
 * Deterministic ordering: layerIntegrities, layerBreachedFlags, layerRegenRates,
 * then scalar features.
 */
export function flattenShieldMLFeatures(vec: ShieldMLFeatureVector): readonly number[] {
  return [
    ...vec.layerIntegrities,
    ...vec.layerBreachedFlags,
    ...vec.layerRegenRates,
    vec.overallIntegrity,
    vec.breachedCount,
    vec.weakestLayerIndex,
    vec.fortifiedCount,
    vec.gradeNumeric,
    vec.avgTicksSinceLastDamage,
    vec.maxDeficit,
    vec.cascadeRisk,
  ];
}

/**
 * Flatten an AttackPatternFeatureVector into a plain number array.
 */
export function flattenAttackPatternFeatures(vec: AttackPatternFeatureVector): readonly number[] {
  return [
    ...vec.categoryDistribution,
    vec.avgMagnitude,
    vec.maxMagnitude,
    vec.attackRate,
    ...vec.layerConcentration,
    vec.directTargetRatio,
    vec.botSourceRatio,
    vec.doctrineCoherence,
    ...vec.severityDistribution,
  ];
}

/**
 * Flatten a RepairEfficiencyFeatureVector into a plain number array.
 */
export function flattenRepairEfficiencyFeatures(vec: RepairEfficiencyFeatureVector): readonly number[] {
  return [
    ...vec.saturationByLayer,
    vec.avgRepairAmount,
    vec.totalQueued,
    vec.repairToDeficitRatio,
    vec.cardSourceRatio,
    vec.systemSourceRatio,
    vec.avgDurationTicks,
    vec.avgDeliveredRatio,
  ];
}

/**
 * Build a combined feature vector merging shield state, attack pattern, and repair efficiency.
 * This is the full input vector for ML models that need holistic shield context.
 */
export function buildCombinedMLFeatureVector(
  layers: readonly ShieldLayerState[],
  attacks: readonly AttackEvent[],
  jobs: readonly RepairJob[],
  windowTicks: number,
): readonly number[] {
  const shield = flattenShieldMLFeatures(buildShieldMLFeatureVector(layers));
  const attack = flattenAttackPatternFeatures(buildAttackPatternFeatureVector(attacks, windowTicks));
  const repair = flattenRepairEfficiencyFeatures(buildRepairEfficiencyFeatureVector(jobs, layers));
  return [...shield, ...attack, ...repair];
}

/**
 * Compute the feature vector dimensionality for each component.
 * Useful for ML model configuration and validation.
 */
export function getMLFeatureDimensions(): {
  shieldDims: number;
  attackDims: number;
  repairDims: number;
  totalDims: number;
} {
  // Shield: 4 layers * 3 per-layer features + 7 scalar features = 19
  const shieldDims = SHIELD_LAYER_ORDER.length * 3 + 7;
  // Attack: 6 categories + 2 scalars + 4 layers + 3 scalars + 5 severity tiers = 20
  const attackDims = ATTACK_CATEGORY_ORDER.length + 2 + SHIELD_LAYER_ORDER.length + 3 + SEVERITY_TIER_ORDER.length;
  // Repair: 4 layers + 6 scalars = 10
  const repairDims = SHIELD_LAYER_ORDER.length + 6;
  return {
    shieldDims,
    attackDims,
    repairDims,
    totalDims: shieldDims + attackDims + repairDims,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — SHIELD UX EVENT COPY GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build ShieldEventUXCopy for a damage event.
 * Uses ShieldLayerState to extract label and compute severity.
 */
export function buildDamageEventUXCopy(
  layer: ShieldLayerState,
  damageAmount: number,
): ShieldEventUXCopy {
  const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];
  const pct = Math.round(layer.integrityRatio * 100);
  const headline = SHIELD_EVENT_UX_HEADLINE.DAMAGE_TAKEN
    .replace('{layer}', displayName)
    .replace('{amount}', String(Math.round(damageAmount)));
  const body = SHIELD_EVENT_UX_BODY.DAMAGE_TAKEN
    .replace('{layer}', displayName)
    .replace('{amount}', String(Math.round(damageAmount)))
    .replace('{pct}', String(pct));

  const severityRatio = layer.max > 0 ? damageAmount / layer.max : 0;
  let severity: AttackSeverityTier = 'NEGLIGIBLE';
  if (severityRatio >= 0.4) severity = 'CATASTROPHIC';
  else if (severityRatio >= 0.25) severity = 'SEVERE';
  else if (severityRatio >= 0.15) severity = 'MODERATE';
  else if (severityRatio >= 0.05) severity = 'MINOR';

  return {
    eventKind: 'DAMAGE_TAKEN',
    headline,
    body,
    severity,
    layerId: layer.layerId,
    label: layer.label,
  };
}

/**
 * Build ShieldEventUXCopy for a breach event.
 */
export function buildBreachEventUXCopy(
  layer: ShieldLayerState,
): ShieldEventUXCopy {
  const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];
  const config = getLayerConfig(layer.layerId);
  const headline = SHIELD_EVENT_UX_HEADLINE.LAYER_BREACHED
    .replace('{layer}', displayName);
  const body = SHIELD_EVENT_UX_BODY.LAYER_BREACHED
    .replace('{layer}', displayName);

  const severity: AttackSeverityTier = config.cascadeGate ? 'CATASTROPHIC' : 'SEVERE';

  return {
    eventKind: 'LAYER_BREACHED',
    headline,
    body,
    severity,
    layerId: layer.layerId,
    label: layer.label,
  };
}

/**
 * Build ShieldEventUXCopy for a repair started event.
 */
export function buildRepairStartedEventUXCopy(
  job: RepairJob,
): ShieldEventUXCopy {
  let displayName: string;
  let layerId: ShieldLayerId | null = null;
  let label: ShieldLayerLabel | null = null;

  if (job.layerId === 'ALL') {
    displayName = 'All layers';
  } else if (isShieldLayerId(job.layerId)) {
    const config = getLayerConfig(job.layerId);
    displayName = LAYER_LABEL_DISPLAY_NAME[config.label];
    layerId = job.layerId;
    label = config.label;
  } else {
    displayName = 'Unknown layer';
  }

  const headline = SHIELD_EVENT_UX_HEADLINE.REPAIR_STARTED
    .replace('{layer}', displayName);
  const body = SHIELD_EVENT_UX_BODY.REPAIR_STARTED
    .replace('{layer}', displayName)
    .replace('{amount}', String(job.amount));

  return {
    eventKind: 'REPAIR_STARTED',
    headline,
    body,
    severity: 'NEGLIGIBLE',
    layerId,
    label,
  };
}

/**
 * Build ShieldEventUXCopy for a repair completed event.
 */
export function buildRepairCompletedEventUXCopy(
  job: RepairJob,
  postRepairState: ShieldLayerState | null,
): ShieldEventUXCopy {
  let displayName: string;
  let layerId: ShieldLayerId | null = null;
  let label: ShieldLayerLabel | null = null;

  if (job.layerId === 'ALL') {
    displayName = 'All layers';
  } else if (isShieldLayerId(job.layerId)) {
    const config = getLayerConfig(job.layerId);
    displayName = LAYER_LABEL_DISPLAY_NAME[config.label];
    layerId = job.layerId;
    label = config.label;
  } else {
    displayName = 'Unknown layer';
  }

  const pct = postRepairState
    ? String(Math.round(postRepairState.integrityRatio * 100))
    : '??';

  const headline = SHIELD_EVENT_UX_HEADLINE.REPAIR_COMPLETED
    .replace('{layer}', displayName);
  const body = SHIELD_EVENT_UX_BODY.REPAIR_COMPLETED
    .replace('{layer}', displayName)
    .replace('{pct}', pct);

  return {
    eventKind: 'REPAIR_COMPLETED',
    headline,
    body,
    severity: 'NEGLIGIBLE',
    layerId,
    label,
  };
}

/**
 * Build ShieldEventUXCopy for a fortification reached event.
 */
export function buildFortificationReachedEventUXCopy(
  layer: ShieldLayerState,
): ShieldEventUXCopy {
  const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];
  const pct = String(Math.round(layer.integrityRatio * 100));
  const headline = SHIELD_EVENT_UX_HEADLINE.FORTIFICATION_REACHED
    .replace('{layer}', displayName);
  const body = SHIELD_EVENT_UX_BODY.FORTIFICATION_REACHED
    .replace('{layer}', displayName)
    .replace('{pct}', pct);

  return {
    eventKind: 'FORTIFICATION_REACHED',
    headline,
    body,
    severity: 'NEGLIGIBLE',
    layerId: layer.layerId,
    label: layer.label,
  };
}

/**
 * Build ShieldEventUXCopy for a cascade triggered event.
 */
export function buildCascadeTriggeredEventUXCopy(
  layer: ShieldLayerState,
): ShieldEventUXCopy {
  const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];
  const headline = SHIELD_EVENT_UX_HEADLINE.CASCADE_TRIGGERED
    .replace('{layer}', displayName);
  const body = SHIELD_EVENT_UX_BODY.CASCADE_TRIGGERED
    .replace('{layer}', displayName);

  return {
    eventKind: 'CASCADE_TRIGGERED',
    headline,
    body,
    severity: 'CATASTROPHIC',
    layerId: layer.layerId,
    label: layer.label,
  };
}

/**
 * Build ShieldEventUXCopy for a deflection applied event.
 */
export function buildDeflectionEventUXCopy(
  layer: ShieldLayerState,
  deflectedAmount: number,
): ShieldEventUXCopy {
  const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];
  const headline = SHIELD_EVENT_UX_HEADLINE.DEFLECTION_APPLIED
    .replace('{layer}', displayName)
    .replace('{amount}', String(Math.round(deflectedAmount)));
  const body = SHIELD_EVENT_UX_BODY.DEFLECTION_APPLIED
    .replace('{layer}', displayName)
    .replace('{amount}', String(Math.round(deflectedAmount)));

  return {
    eventKind: 'DEFLECTION_APPLIED',
    headline,
    body,
    severity: 'NEGLIGIBLE',
    layerId: layer.layerId,
    label: layer.label,
  };
}

/**
 * Build ShieldEventUXCopy for a regeneration tick event.
 */
export function buildRegenTickEventUXCopy(
  layer: ShieldLayerState,
): ShieldEventUXCopy {
  const displayName = LAYER_LABEL_DISPLAY_NAME[layer.label];
  const pct = String(Math.round(layer.integrityRatio * 100));
  const headline = SHIELD_EVENT_UX_HEADLINE.REGEN_TICK
    .replace('{layer}', displayName);
  const body = SHIELD_EVENT_UX_BODY.REGEN_TICK
    .replace('{layer}', displayName)
    .replace('{pct}', pct);

  return {
    eventKind: 'REGEN_TICK',
    headline,
    body,
    severity: 'NEGLIGIBLE',
    layerId: layer.layerId,
    label: layer.label,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — FULL UX SNAPSHOT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete ShieldUXSnapshot suitable for rendering the full shield panel.
 * This is the top-level UX aggregator that composes all diagnostic sub-systems.
 */
export function buildShieldUXSnapshot(
  layers: readonly ShieldLayerState[],
  currentTick: number,
): ShieldUXSnapshot {
  const healthReport = buildShieldHealthReport(layers);
  const layerDetails = healthReport.layerGrades;
  const vulnerabilities = computeLayerVulnerabilities(layers, currentTick);
  const recoveryEstimates = estimateShieldRecovery(layers);
  const fortificationProgress = computeFortificationProgress(layers);
  const repairStrategy = recommendRepairStrategy(layers);
  const overallNarrative = healthReport.narrativeSummary;
  const playerActionHint = generatePlayerActionHint(layers);

  return {
    healthReport,
    layerDetails,
    vulnerabilities,
    recoveryEstimates,
    fortificationProgress,
    repairStrategy,
    overallNarrative,
    playerActionHint,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12 — SHIELD STATE COMPARISON & DELTA ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two shield state snapshots and identify what changed.
 * Useful for turn-over-turn UX updates showing what happened.
 */
export function compareShieldStates(
  before: readonly ShieldLayerState[],
  after: readonly ShieldLayerState[],
): readonly {
  layerId: ShieldLayerId;
  label: ShieldLayerLabel;
  previousIntegrity: number;
  currentIntegrity: number;
  delta: number;
  becameBreach: boolean;
  recoveredFromBreach: boolean;
  becameFortified: boolean;
  lostFortification: boolean;
  uxDeltaText: string;
}[] {
  return SHIELD_LAYER_ORDER.map((layerId) => {
    const beforeLayer = before.find((l) => l.layerId === layerId);
    const afterLayer = after.find((l) => l.layerId === layerId);

    const prevIntegrity = beforeLayer?.integrityRatio ?? 0;
    const currIntegrity = afterLayer?.integrityRatio ?? 0;
    const delta = currIntegrity - prevIntegrity;
    const label = afterLayer?.label ?? beforeLayer?.label ?? getLayerConfig(layerId).label;
    const displayName = LAYER_LABEL_DISPLAY_NAME[label];

    const wasBreach = beforeLayer?.breached ?? true;
    const nowBreach = afterLayer?.breached ?? true;
    const becameBreach = !wasBreach && nowBreach;
    const recoveredFromBreach = wasBreach && !nowBreach;

    const wasFortified = prevIntegrity >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD;
    const nowFortified = currIntegrity >= SHIELD_CONSTANTS.FORTIFIED_THRESHOLD;
    const becameFortified = !wasFortified && nowFortified;
    const lostFortification = wasFortified && !nowFortified;

    let uxDeltaText: string;
    if (becameBreach) {
      uxDeltaText = `${displayName} was breached!`;
    } else if (recoveredFromBreach) {
      uxDeltaText = `${displayName} recovered from breach.`;
    } else if (becameFortified) {
      uxDeltaText = `${displayName} reached fortified status.`;
    } else if (lostFortification) {
      uxDeltaText = `${displayName} lost fortified status.`;
    } else if (Math.abs(delta) < 0.01) {
      uxDeltaText = `${displayName} unchanged.`;
    } else if (delta > 0) {
      uxDeltaText = `${displayName} improved by ${Math.round(delta * 100)}%.`;
    } else {
      uxDeltaText = `${displayName} dropped by ${Math.round(Math.abs(delta) * 100)}%.`;
    }

    return {
      layerId,
      label,
      previousIntegrity: prevIntegrity,
      currentIntegrity: currIntegrity,
      delta,
      becameBreach,
      recoveredFromBreach,
      becameFortified,
      lostFortification,
      uxDeltaText,
    };
  });
}

/**
 * Compute a "shield momentum" score indicating whether the shield state
 * is improving, degrading, or stable compared to a previous snapshot.
 * Returns -1 to 1 where positive means improving.
 */
export function computeShieldMomentum(
  before: readonly ShieldLayerState[],
  after: readonly ShieldLayerState[],
): number {
  const deltas = compareShieldStates(before, after);
  let weightedDelta = 0;
  let totalWeight = 0;

  for (const d of deltas) {
    const weight = LAYER_HEALTH_WEIGHT[d.layerId];
    weightedDelta += d.delta * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, weightedDelta / totalWeight));
}

/**
 * Generate a turn summary narrative comparing two shield states.
 */
export function generateTurnShieldNarrative(
  before: readonly ShieldLayerState[],
  after: readonly ShieldLayerState[],
): string {
  const momentum = computeShieldMomentum(before, after);
  const deltas = compareShieldStates(before, after);
  const significantChanges = deltas.filter((d) => Math.abs(d.delta) >= 0.05
    || d.becameBreach || d.recoveredFromBreach
    || d.becameFortified || d.lostFortification);

  const parts: string[] = [];

  if (momentum > 0.1) {
    parts.push('Shields are recovering.');
  } else if (momentum < -0.1) {
    parts.push('Shields are taking damage.');
  } else {
    parts.push('Shield status is stable.');
  }

  for (const change of significantChanges) {
    parts.push(change.uxDeltaText);
  }

  if (significantChanges.length === 0) {
    parts.push('No significant changes this turn.');
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13 — ADVANCED SHIELD SCORING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a "threat absorption capacity" score for the entire shield system.
 * Estimates how much total damage the shields can absorb before any layer breaches.
 */
export function computeThreatAbsorptionCapacity(layers: readonly ShieldLayerState[]): number {
  let totalCapacity = 0;
  for (const layer of layers) {
    if (!layer.breached) {
      totalCapacity += layer.current;
    }
  }
  return totalCapacity;
}

/**
 * Compute the "effective HP" for a layer accounting for deflection.
 * A fortified layer effectively has more HP because it deflects some damage.
 */
export function computeEffectiveLayerHP(layer: ShieldLayerState): number {
  const deflection = computeLayerDeflection(layer.integrityRatio);
  // Effective HP is current / (1 - deflection) since deflection reduces incoming damage
  const damageMultiplier = 1 - deflection;
  return damageMultiplier > 0 ? layer.current / damageMultiplier : layer.current;
}

/**
 * Compute the "shield resilience index" — a composite measure of how well
 * the shield system can withstand a sustained attack over N ticks.
 * Considers HP, regen, deflection, and cascade safety.
 */
export function computeShieldResilienceIndex(
  layers: readonly ShieldLayerState[],
  sustainedDamagePerTick: number,
  ticks: number,
): number {
  if (ticks <= 0 || sustainedDamagePerTick <= 0) return 1;

  let totalDamageAbsorbed = 0;
  const totalIncomingDamage = sustainedDamagePerTick * ticks;

  for (const layer of layers) {
    if (layer.breached) continue;

    const deflection = computeLayerDeflection(layer.integrityRatio);
    const effectiveDamagePerTick = sustainedDamagePerTick * (1 - deflection) / layers.length;
    const totalRegenOverWindow = layer.regenPerTick * ticks;
    const netDamage = Math.max(0, effectiveDamagePerTick * ticks - totalRegenOverWindow);
    const absorbed = Math.min(layer.current, netDamage);
    totalDamageAbsorbed += absorbed;
  }

  // Resilience = how much of the total damage can be absorbed vs how much comes in
  return totalIncomingDamage > 0
    ? Math.min(1, (computeThreatAbsorptionCapacity(layers) + layers.reduce((s, l) => s + l.regenPerTick * ticks, 0)) / totalIncomingDamage)
    : 1;
}

/**
 * Determine if the shield is in a "death spiral" — a state where damage rate
 * exceeds regen rate and all layers are declining toward breach.
 */
export function isShieldInDeathSpiral(
  layers: readonly ShieldLayerState[],
  recentAttacks: readonly AttackEvent[],
  windowTicks: number,
): boolean {
  if (recentAttacks.length === 0 || windowTicks <= 0) return false;

  const totalDamage = recentAttacks.reduce((sum, a) => sum + a.magnitude, 0);
  const damagePerTick = totalDamage / windowTicks;
  const totalRegen = layers.reduce((sum, l) => sum + l.regenPerTick, 0);
  const nonBreachedLayers = layers.filter((l) => !l.breached);

  // Death spiral: damage outpaces regen by at least 2x AND at least half layers are stressed
  const damageDominance = totalRegen > 0 ? damagePerTick / totalRegen : Infinity;
  const stressedCount = nonBreachedLayers.filter(
    (l) => l.integrityRatio <= SHIELD_CONSTANTS.LOW_WARNING_THRESHOLD,
  ).length;
  const stressedRatio = layers.length > 0 ? stressedCount / layers.length : 0;

  return damageDominance >= 2 && stressedRatio >= 0.5;
}

/**
 * Compute the "critical path to cascade" — the minimum total damage needed
 * to trigger a cascade event from the current state.
 * This is the sum of HP remaining on all layers between the weakest path and L4.
 */
export function computeCriticalPathToCascade(layers: readonly ShieldLayerState[]): number {
  const l4 = layers.find((l) => l.layerId === 'L4');
  if (!l4) return Infinity;
  if (l4.breached) return 0; // Already cascading

  const config = getLayerConfig('L4');
  if (!config.cascadeGate) return Infinity;

  // The critical path is just the L4 HP needed to bring it below cascade crack threshold
  const crackThreshold = l4.max * SHIELD_CONSTANTS.CASCADE_CRACK_RATIO;
  const hpAboveCrack = Math.max(0, l4.current - crackThreshold);

  return hpAboveCrack;
}

/**
 * Score how "balanced" the shield layer distribution is.
 * Returns 0-1 where 1 means perfectly balanced (all layers at same ratio)
 * and 0 means maximally unbalanced.
 */
export function scoreShieldBalance(layers: readonly ShieldLayerState[]): number {
  if (layers.length <= 1) return 1;

  const ratios = layers.map((l) => l.integrityRatio);
  const mean = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  if (mean === 0) return 0;

  const variance = ratios.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratios.length;
  const stddev = Math.sqrt(variance);
  // Normalize: stddev of 0 = perfect balance (1.0), stddev of 0.5 = terrible (0.0)
  return Math.max(0, 1 - stddev * 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 14 — SHIELD HISTORY & TREND ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a rolling average integrity ratio over a series of snapshots.
 * Each snapshot is a readonly array of ShieldLayerState.
 * Uses SHIELD_CONSTANTS.MAX_HISTORY_DEPTH to cap lookback.
 */
export function computeRollingIntegrity(
  snapshots: readonly (readonly ShieldLayerState[])[],
): number {
  const maxDepth = SHIELD_CONSTANTS.MAX_HISTORY_DEPTH;
  const effectiveSnapshots = snapshots.length > maxDepth
    ? snapshots.slice(snapshots.length - maxDepth)
    : snapshots;

  if (effectiveSnapshots.length === 0) return 0;

  let totalIntegrity = 0;
  for (const snapshot of effectiveSnapshots) {
    totalIntegrity += computeWeightedIntegrity(snapshot);
  }

  return totalIntegrity / effectiveSnapshots.length;
}

/**
 * Detect a trend in shield health over time: IMPROVING, DEGRADING, or STABLE.
 * Compares the first and second halves of the snapshot window.
 */
export function detectShieldTrend(
  snapshots: readonly (readonly ShieldLayerState[])[],
): 'IMPROVING' | 'DEGRADING' | 'STABLE' {
  const maxDepth = SHIELD_CONSTANTS.MAX_HISTORY_DEPTH;
  const effective = snapshots.length > maxDepth
    ? snapshots.slice(snapshots.length - maxDepth)
    : snapshots;

  if (effective.length < 4) return 'STABLE';

  const midpoint = Math.floor(effective.length / 2);
  const firstHalf = effective.slice(0, midpoint);
  const secondHalf = effective.slice(midpoint);

  const firstAvg = computeRollingIntegrity(firstHalf);
  const secondAvg = computeRollingIntegrity(secondHalf);
  const delta = secondAvg - firstAvg;

  if (delta > 0.05) return 'IMPROVING';
  if (delta < -0.05) return 'DEGRADING';
  return 'STABLE';
}

/**
 * Compute per-layer breach frequency from a series of snapshots.
 * Returns the number of distinct breach transitions per layer.
 */
export function computeBreachFrequency(
  snapshots: readonly (readonly ShieldLayerState[])[],
): Readonly<Record<ShieldLayerId, number>> {
  const counts: Record<ShieldLayerId, number> = { L1: 0, L2: 0, L3: 0, L4: 0 };
  const maxDepth = SHIELD_CONSTANTS.MAX_HISTORY_DEPTH;
  const effective = snapshots.length > maxDepth
    ? snapshots.slice(snapshots.length - maxDepth)
    : snapshots;

  for (let i = 1; i < effective.length; i++) {
    for (const layerId of SHIELD_LAYER_ORDER) {
      const prev = effective[i - 1].find((l) => l.layerId === layerId);
      const curr = effective[i].find((l) => l.layerId === layerId);
      if (prev && curr && !prev.breached && curr.breached) {
        counts[layerId]++;
      }
    }
  }

  return counts;
}

/**
 * Generate a trend summary narrative for the player.
 */
export function generateTrendNarrative(
  snapshots: readonly (readonly ShieldLayerState[])[],
): string {
  const trend = detectShieldTrend(snapshots);
  const breachFreq = computeBreachFrequency(snapshots);
  const rollingIntegrity = computeRollingIntegrity(snapshots);

  const parts: string[] = [];

  switch (trend) {
    case 'IMPROVING':
      parts.push('Your shields have been recovering over recent turns.');
      break;
    case 'DEGRADING':
      parts.push('Your shields have been weakening over recent turns.');
      break;
    case 'STABLE':
      parts.push('Your shield integrity has been stable recently.');
      break;
  }

  parts.push(`Average integrity: ${Math.round(rollingIntegrity * 100)}%.`);

  const breachEntries: string[] = [];
  for (const layerId of SHIELD_LAYER_ORDER) {
    const config = getLayerConfig(layerId);
    const displayName = LAYER_LABEL_DISPLAY_NAME[config.label];
    if (breachFreq[layerId] > 0) {
      breachEntries.push(`${displayName} breached ${breachFreq[layerId]} time${breachFreq[layerId] !== 1 ? 's' : ''}`);
    }
  }

  if (breachEntries.length > 0) {
    parts.push(`Recent breaches: ${breachEntries.join(', ')}.`);
  } else {
    parts.push('No breaches in the analysis window.');
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 15 — ATTACK RESPONSE URGENCY & TACTIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score the urgency of responding to an attack given the current shield state.
 * Combines attack severity with the target layer's current health.
 * Returns 0-1 where 1 means maximum urgency.
 */
export function scoreAttackResponseUrgency(
  attack: AttackEvent,
  layers: readonly ShieldLayerState[],
  currentTick: number,
): number {
  const severity = classifyAttackEventSeverity(attack);
  let score = severity.score * 0.40;

  // Target layer health amplifies urgency
  if (attack.targetLayer !== 'DIRECT') {
    const targetState = layers.find((l) => l.layerId === attack.targetLayer);
    if (targetState) {
      const vulnerability = 1 - targetState.integrityRatio;
      score += vulnerability * 0.30;

      // Cascade risk amplifier
      if (isLayerAtCascadeRisk(targetState)) {
        score += 0.20;
      }
    }
  }

  // Attack freshness — newer attacks are more urgent
  const age = currentTick - attack.createdAtTick;
  const freshnessFactor = Math.max(0, 1 - age / 10);
  score += freshnessFactor * 0.10;

  return Math.min(1, score);
}

/**
 * Rank attacks by response urgency given the current shield state.
 */
export function rankAttacksByUrgency(
  attacks: readonly AttackEvent[],
  layers: readonly ShieldLayerState[],
  currentTick: number,
): readonly { attack: AttackEvent; urgency: number }[] {
  return [...attacks]
    .map((attack) => ({
      attack,
      urgency: scoreAttackResponseUrgency(attack, layers, currentTick),
    }))
    .sort((a, b) => b.urgency - a.urgency);
}

/**
 * Determine the "counter-doctrine" — the recommended player response
 * to a given attack category.
 */
export function getCounterDoctrineHint(category: AttackCategory): string {
  const catName = ATTACK_CATEGORY_UX_SHORT_NAME[category];
  const preferredLayer = ATTACK_CATEGORY_PREFERRED_LAYER[category];
  const layerConfig = getLayerConfig(preferredLayer);
  const layerName = LAYER_LABEL_DISPLAY_NAME[layerConfig.label];

  switch (category) {
    case 'EXTRACTION':
      return `Counter ${catName}: Reinforce ${layerName}. Play a defensive card to block cash drainage.`;
    case 'LOCK':
      return `Counter ${catName}: Diversify credit access. Repair ${layerName} to maintain financial flexibility.`;
    case 'DRAIN':
      return `Counter ${catName}: Reduce expenses and boost ${layerName}. Cut unnecessary spending cards.`;
    case 'HEAT':
      return `Counter ${catName}: Strengthen your ${layerName}. Build trust and alliances to absorb pressure.`;
    case 'BREACH':
      return `Counter ${catName}: Protect ${layerName}. Play asset protection cards to maintain income streams.`;
    case 'DEBT':
      return `Counter ${catName}: Pay down obligations on ${layerName}. Avoid taking on more debt-category cards.`;
  }
}

/**
 * Generate a tactical assessment for the current shield/attack situation.
 */
export function generateTacticalAssessment(
  layers: readonly ShieldLayerState[],
  attacks: readonly AttackEvent[],
  currentTick: number,
): string {
  if (attacks.length === 0) {
    const posture = scoreDefensivePosture(layers);
    if (posture >= 0.8) return 'No active threats. Shields in excellent condition. Focus on fortification.';
    if (posture >= 0.5) return 'No active threats. Use this window to repair weakened layers.';
    return 'No active threats, but shields are weakened. Prioritize recovery before the next wave.';
  }

  const batch = analyzeAttackBatch(attacks);
  const ranked = rankAttacksByUrgency(attacks, layers, currentTick);
  const deathSpiral = isShieldInDeathSpiral(layers, attacks, 10);

  const parts: string[] = [];

  if (deathSpiral) {
    parts.push('WARNING: Shield death spiral detected. Damage is outpacing regeneration. Immediate intervention required.');
  }

  parts.push(batch.uxBatchSummary);

  if (ranked.length > 0 && ranked[0].urgency >= 0.7) {
    const topThreat = ranked[0].attack;
    const counterHint = getCounterDoctrineHint(topThreat.category);
    parts.push(counterHint);
  }

  const cascadeDistance = computeCriticalPathToCascade(layers);
  if (cascadeDistance <= 20 && cascadeDistance > 0) {
    parts.push(`Cascade alert: Only ${Math.round(cascadeDistance)} HP from cascade trigger.`);
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 16 — SERIALIZATION & VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a ShieldLayerState object for internal consistency.
 * Returns an array of error strings. Empty means valid.
 * Uses the ShieldLayerState fields (layerId, label, current, max, etc.) at runtime.
 */
export function validateShieldLayerState(state: ShieldLayerState): readonly string[] {
  const errors: string[] = [];

  if (!isShieldLayerId(state.layerId)) {
    errors.push(`Invalid layerId: ${state.layerId}`);
  }

  const config = getLayerConfig(state.layerId);
  if (state.label !== config.label) {
    errors.push(`Label mismatch: expected ${config.label}, got ${state.label}`);
  }

  if (state.current < 0) {
    errors.push(`current is negative: ${state.current}`);
  }

  if (state.current > state.max) {
    errors.push(`current ${state.current} exceeds max ${state.max}`);
  }

  if (state.max !== config.max) {
    errors.push(`max mismatch: expected ${config.max}, got ${state.max}`);
  }

  if (state.integrityRatio < 0 || state.integrityRatio > 1) {
    errors.push(`integrityRatio out of range: ${state.integrityRatio}`);
  }

  const expectedRatio = state.max > 0 ? state.current / state.max : 0;
  if (Math.abs(state.integrityRatio - expectedRatio) > 0.01) {
    errors.push(`integrityRatio inconsistent: expected ~${expectedRatio.toFixed(3)}, got ${state.integrityRatio}`);
  }

  if (state.breached && state.current > 0) {
    errors.push('breached is true but current > 0');
  }

  if (!state.breached && state.current <= 0) {
    errors.push('breached is false but current <= 0');
  }

  return errors;
}

/**
 * Validate an entire shield layer state array for consistency.
 * Checks that all four layers are present and each is valid.
 */
export function validateShieldLayerArray(
  layers: readonly ShieldLayerState[],
): readonly string[] {
  const errors: string[] = [];

  if (layers.length !== SHIELD_LAYER_ORDER.length) {
    errors.push(`Expected ${SHIELD_LAYER_ORDER.length} layers, got ${layers.length}`);
  }

  const seenIds = new Set<string>();
  for (const layer of layers) {
    if (seenIds.has(layer.layerId)) {
      errors.push(`Duplicate layerId: ${layer.layerId}`);
    }
    seenIds.add(layer.layerId);
    errors.push(...validateShieldLayerState(layer));
  }

  for (const expected of SHIELD_LAYER_ORDER) {
    if (!seenIds.has(expected)) {
      errors.push(`Missing layerId: ${expected}`);
    }
  }

  return errors;
}

/**
 * Validate a RoutedAttack for structural correctness.
 * Checks that all fields reference valid types and values.
 */
export function validateRoutedAttack(routed: RoutedAttack): readonly string[] {
  const errors: string[] = [];

  if (!routed.attackId || routed.attackId.trim().length === 0) {
    errors.push('attackId is empty');
  }

  if (!ATTACK_CATEGORY_ORDER.includes(routed.category)) {
    errors.push(`Invalid category: ${routed.category}`);
  }

  if (!DOCTRINE_TYPE_ORDER.includes(routed.doctrineType)) {
    errors.push(`Invalid doctrineType: ${routed.doctrineType}`);
  }

  if (!isShieldLayerId(routed.targetLayer)) {
    errors.push(`Invalid targetLayer: ${routed.targetLayer}`);
  }

  if (routed.fallbackLayer !== null && !isShieldLayerId(routed.fallbackLayer)) {
    errors.push(`Invalid fallbackLayer: ${routed.fallbackLayer}`);
  }

  if (routed.magnitude < 0) {
    errors.push(`Negative magnitude: ${routed.magnitude}`);
  }

  if (routed.createdAtTick < 0) {
    errors.push(`Negative createdAtTick: ${routed.createdAtTick}`);
  }

  return errors;
}

/**
 * Validate a RepairJob for structural correctness.
 */
export function validateRepairJob(job: RepairJob): readonly string[] {
  const errors: string[] = [];

  if (!job.jobId || job.jobId.trim().length === 0) {
    errors.push('jobId is empty');
  }

  if (job.layerId !== 'ALL' && !isShieldLayerId(job.layerId)) {
    errors.push(`Invalid layerId: ${job.layerId}`);
  }

  if (job.amount <= 0) {
    errors.push(`amount must be positive: ${job.amount}`);
  }

  if (job.durationTicks <= 0) {
    errors.push(`durationTicks must be positive: ${job.durationTicks}`);
  }

  if (job.ticksRemaining < 0) {
    errors.push(`ticksRemaining is negative: ${job.ticksRemaining}`);
  }

  if (job.delivered < 0) {
    errors.push(`delivered is negative: ${job.delivered}`);
  }

  if (job.delivered > job.amount) {
    errors.push(`delivered ${job.delivered} exceeds amount ${job.amount}`);
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 17 — SHIELD LAYER FACTORY & PRESET BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a complete set of ShieldLayerStates from raw HP values.
 * Convenience function for initializing a full shield state array.
 */
export function buildFullShieldState(
  hpValues: Readonly<Record<ShieldLayerId, number>>,
  lastDamagedTicks: Readonly<Record<ShieldLayerId, number | null>>,
  lastRecoveredTicks: Readonly<Record<ShieldLayerId, number | null>>,
): readonly ShieldLayerState[] {
  return SHIELD_LAYER_ORDER.map((layerId) =>
    buildShieldLayerState(
      layerId,
      hpValues[layerId],
      lastDamagedTicks[layerId],
      lastRecoveredTicks[layerId],
    ),
  );
}

/**
 * Build a full-health shield state array (all layers at max).
 */
export function buildFullHealthShieldState(): readonly ShieldLayerState[] {
  return SHIELD_LAYER_ORDER.map((layerId) => {
    const config = getLayerConfig(layerId);
    return buildShieldLayerState(layerId, config.max, null, null);
  });
}

/**
 * Build a breached shield state array (all layers at zero).
 */
export function buildBreachedShieldState(): readonly ShieldLayerState[] {
  return SHIELD_LAYER_ORDER.map((layerId) =>
    buildShieldLayerState(layerId, 0, 0, null),
  );
}

/**
 * Build a shield state at a specific uniform integrity ratio.
 * Useful for testing and scenario simulation.
 */
export function buildShieldStateAtRatio(
  ratio: number,
  lastDamagedTick: number | null = null,
): readonly ShieldLayerState[] {
  const clamped = Math.max(0, Math.min(1, ratio));
  return SHIELD_LAYER_ORDER.map((layerId) => {
    const config = getLayerConfig(layerId);
    const hp = Math.round(config.max * clamped);
    return buildShieldLayerState(layerId, hp, lastDamagedTick, null);
  });
}

/**
 * Clone a shield state array applying a damage amount to a specific layer.
 * Returns a new array with the damaged layer updated.
 */
export function applyDamageToShieldState(
  layers: readonly ShieldLayerState[],
  targetLayerId: ShieldLayerId,
  damage: number,
  currentTick: number,
): readonly ShieldLayerState[] {
  return layers.map((layer) => {
    if (layer.layerId !== targetLayerId) return layer;
    const newCurrent = Math.max(0, layer.current - damage);
    return buildShieldLayerState(
      layer.layerId,
      newCurrent,
      currentTick,
      layer.lastRecoveredTick,
    );
  });
}

/**
 * Clone a shield state array applying a repair amount to a specific layer.
 * Returns a new array with the repaired layer updated.
 */
export function applyRepairToShieldState(
  layers: readonly ShieldLayerState[],
  targetLayerId: ShieldLayerId | 'ALL',
  repairAmount: number,
  currentTick: number,
): readonly ShieldLayerState[] {
  return layers.map((layer) => {
    if (targetLayerId !== 'ALL' && layer.layerId !== targetLayerId) return layer;
    const perLayerAmount = targetLayerId === 'ALL'
      ? Math.floor(repairAmount / SHIELD_LAYER_ORDER.length)
      : repairAmount;
    const config = getLayerConfig(layer.layerId);
    const newCurrent = Math.min(config.max, layer.current + perLayerAmount);
    return buildShieldLayerState(
      layer.layerId,
      newCurrent,
      layer.lastDamagedTick,
      currentTick,
    );
  });
}

/**
 * Apply a single tick of passive regeneration to all layers.
 */
export function applyRegenTick(
  layers: readonly ShieldLayerState[],
  currentTick: number,
): readonly ShieldLayerState[] {
  return layers.map((layer) => {
    if (layer.regenPerTick <= 0) return layer;
    const config = getLayerConfig(layer.layerId);
    const newCurrent = Math.min(config.max, layer.current + layer.regenPerTick);
    if (newCurrent === layer.current) return layer;
    return buildShieldLayerState(
      layer.layerId,
      newCurrent,
      layer.lastDamagedTick,
      currentTick,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 18 — DAMAGE RESOLUTION ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a DamageResolution to produce UX-ready summary data.
 * Reads the layers field (readonly ShieldLayerState[]) at runtime.
 */
export function analyzeDamageResolution(resolution: DamageResolution): {
  readonly uxHeadline: string;
  readonly uxBody: string;
  readonly severity: AttackSeverityTier;
  readonly integrityDropPct: number;
  readonly postHitGrade: ShieldHealthGrade;
} {
  const config = getLayerConfig(resolution.actualLayerId);
  const displayName = LAYER_LABEL_DISPLAY_NAME[config.label];
  const integrityDropPct = Math.round(
    (resolution.preHitIntegrity - resolution.postHitIntegrity) * 100,
  );

  // Compute severity from damage vs layer max
  const damageFraction = config.max > 0
    ? resolution.effectiveDamage / config.max
    : 0;
  let severity: AttackSeverityTier = 'NEGLIGIBLE';
  if (damageFraction >= 0.4) severity = 'CATASTROPHIC';
  else if (damageFraction >= 0.25) severity = 'SEVERE';
  else if (damageFraction >= 0.15) severity = 'MODERATE';
  else if (damageFraction >= 0.05) severity = 'MINOR';

  const postHitIntegrity = computeWeightedIntegrity(resolution.layers);
  const postHitGrade = computeGradeFromScore(postHitIntegrity);

  let uxHeadline: string;
  if (resolution.blocked) {
    uxHeadline = `Attack blocked by ${displayName}.`;
  } else if (resolution.breached) {
    uxHeadline = `${displayName} breached!`;
  } else {
    uxHeadline = `${displayName} absorbed ${Math.round(resolution.effectiveDamage)} damage.`;
  }

  const bodyParts: string[] = [];
  if (resolution.deflectionApplied > 0) {
    bodyParts.push(`${Math.round(resolution.deflectionApplied)} damage deflected.`);
  }
  bodyParts.push(`Integrity dropped ${integrityDropPct}% to ${Math.round(resolution.postHitIntegrity * 100)}%.`);
  if (resolution.breached && !resolution.wasAlreadyBreached) {
    bodyParts.push(config.breachConsequenceText);
  }

  return {
    uxHeadline,
    uxBody: bodyParts.join(' '),
    severity,
    integrityDropPct,
    postHitGrade,
  };
}

/**
 * Analyze a CascadeResolution to produce UX-ready summary data.
 * Reads the layers field (readonly ShieldLayerState[]) at runtime.
 */
export function analyzeCascadeResolution(resolution: CascadeResolution): {
  readonly uxHeadline: string;
  readonly uxBody: string;
  readonly severity: AttackSeverityTier;
  readonly postCascadeGrade: ShieldHealthGrade;
} {
  if (!resolution.triggered) {
    return {
      uxHeadline: 'No cascade triggered.',
      uxBody: 'Shield integrity held. No downstream effects.',
      severity: 'NEGLIGIBLE',
      postCascadeGrade: computeGradeFromScore(computeWeightedIntegrity(resolution.layers)),
    };
  }

  const postIntegrity = computeWeightedIntegrity(resolution.layers);
  const postCascadeGrade = computeGradeFromScore(postIntegrity);

  return {
    uxHeadline: `Cascade triggered! ${resolution.cascadeCount} chain reaction${resolution.cascadeCount !== 1 ? 's' : ''}.`,
    uxBody: `Network core breach triggered a cascade event. Overall shield integrity now at ${Math.round(postIntegrity * 100)}%.`,
    severity: 'CATASTROPHIC',
    postCascadeGrade,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 19 — SHIELD SIMULATION HELPERS (for what-if analysis)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate N ticks of passive regeneration and return the resulting shield state.
 * Does not account for incoming attacks — pure regen simulation.
 */
export function simulateRegenTicks(
  layers: readonly ShieldLayerState[],
  ticks: number,
  startTick: number,
): readonly ShieldLayerState[] {
  let current = layers;
  for (let t = 0; t < ticks; t++) {
    current = applyRegenTick(current, startTick + t);
  }
  return current;
}

/**
 * Simulate a hypothetical attack on the shield and return the resulting state.
 * This does NOT route through AttackRouter — it's a simple what-if.
 */
export function simulateAttackImpact(
  layers: readonly ShieldLayerState[],
  targetLayer: ShieldLayerId,
  magnitude: number,
  currentTick: number,
): {
  resultLayers: readonly ShieldLayerState[];
  wouldBreach: boolean;
  effectiveDamage: number;
  deflected: number;
} {
  const state = layers.find((l) => l.layerId === targetLayer);
  if (!state) {
    return { resultLayers: layers, wouldBreach: false, effectiveDamage: 0, deflected: 0 };
  }

  const deflection = computeLayerDeflection(state.integrityRatio);
  const deflected = magnitude * deflection;
  const effectiveDamage = magnitude - deflected;
  const resultLayers = applyDamageToShieldState(layers, targetLayer, effectiveDamage, currentTick);
  const resultState = resultLayers.find((l) => l.layerId === targetLayer);
  const wouldBreach = resultState !== undefined && resultState.breached && !state.breached;

  return { resultLayers, wouldBreach, effectiveDamage, deflected };
}

/**
 * Simulate a repair scenario and predict the outcome.
 * Shows what the shield state would look like after a proposed repair.
 */
export function simulateRepairOutcome(
  layers: readonly ShieldLayerState[],
  targetLayer: ShieldLayerId | 'ALL',
  repairAmount: number,
  currentTick: number,
): {
  resultLayers: readonly ShieldLayerState[];
  healthReport: ShieldHealthReport;
  improvementDelta: number;
} {
  const beforeIntegrity = computeWeightedIntegrity(layers);
  const resultLayers = applyRepairToShieldState(layers, targetLayer, repairAmount, currentTick);
  const afterIntegrity = computeWeightedIntegrity(resultLayers);
  const healthReport = buildShieldHealthReport(resultLayers);

  return {
    resultLayers,
    healthReport,
    improvementDelta: afterIntegrity - beforeIntegrity,
  };
}

/**
 * Find the minimum repair needed on a specific layer to prevent its breach
 * if a hypothetical attack of a given magnitude hits it.
 */
export function computeMinRepairToSurvive(
  layer: ShieldLayerState,
  incomingMagnitude: number,
): number {
  const deflection = computeLayerDeflection(layer.integrityRatio);
  const effectiveDamage = incomingMagnitude * (1 - deflection);
  const neededHp = Math.max(0, effectiveDamage - layer.current + 1);
  return Math.ceil(neededHp);
}

/**
 * Compute the maximum sustained damage per tick the shield can absorb
 * indefinitely (steady-state) without any layer ever breaching.
 * This is the combined regen rate across all layers.
 */
export function computeSteadyStateDamageCapacity(layers: readonly ShieldLayerState[]): number {
  return layers.reduce((sum, l) => sum + l.regenPerTick, 0);
}
