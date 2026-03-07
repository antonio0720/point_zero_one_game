/**
 * Commerce Governance — Type System
 * backend/src/api-gateway/commerce_governance/types.ts
 *
 * Implements the Monetization Governance OS doctrine:
 * "Money buys variety, identity, and access — not win probability."
 *
 * Density6 LLC · Point Zero One · Confidential
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKU TAXONOMY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Allowed SKU classes — safe by design */
export type AllowedSkuClass =
  | 'COSMETIC'
  | 'ACCESS_CONTENT'
  | 'CONVENIENCE_NONCOMPETITIVE'
  | 'SOCIAL_FEATURE'
  | 'ARCHIVE_PROOF'
  | 'SUBSCRIPTION_PASS';

/** Forbidden SKU classes — blocked at runtime, no exceptions */
export type ForbiddenSkuClass =
  | 'POWER'
  | 'BOOST'
  | 'TIME_SKIP'
  | 'RNG_REROLL'
  | 'INSURANCE'
  | 'ADVANTAGE_INFERENCE';

export type SkuClass = AllowedSkuClass | ForbiddenSkuClass;

export const ALLOWED_SKU_CLASSES: readonly AllowedSkuClass[] = [
  'COSMETIC', 'ACCESS_CONTENT', 'CONVENIENCE_NONCOMPETITIVE',
  'SOCIAL_FEATURE', 'ARCHIVE_PROOF', 'SUBSCRIPTION_PASS',
];

export const FORBIDDEN_SKU_CLASSES: readonly ForbiddenSkuClass[] = [
  'POWER', 'BOOST', 'TIME_SKIP', 'RNG_REROLL', 'INSURANCE', 'ADVANTAGE_INFERENCE',
];

export interface SkuDefinition {
  skuId: string;
  name: string;
  description: string;
  skuClass: AllowedSkuClass;
  priceUsdCents: number;
  stripePriceId: string;
  stripeProductId: string;
  tags: string[];
  /** Whether this SKU can appear in competitive/verified ladders */
  competitiveSafe: boolean;
  /** Whether this SKU affects run outcomes in any way */
  affectsOutcomes: false; // always false — enforced at validation
  /** Maximum quantity per user (0 = unlimited) */
  maxPerUser: number;
  /** Whether this SKU is currently available for purchase */
  active: boolean;
  /** Policy version that approved this SKU */
  approvedByPolicyVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkuValidationResult {
  valid: boolean;
  skuId: string;
  skuClass: SkuClass;
  violations: SkuViolation[];
}

export interface SkuViolation {
  code: string;
  message: string;
  severity: 'BLOCK' | 'WARN';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OFFER POLICY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type OfferTrigger = 'STORE_BROWSE' | 'SESSION_END' | 'SEASON_START' | 'ACHIEVEMENT' | 'SCHEDULED' | 'MANUAL';
export type OfferStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'KILLED';

export interface OfferPolicy {
  offerId: string;
  name: string;
  skuIds: string[];
  trigger: OfferTrigger;
  /** Max times this offer can be shown to a single user per day */
  maxImpressionsPerUserPerDay: number;
  /** Max times this offer can be shown to a single user total */
  maxImpressionsPerUserTotal: number;
  /** Cooldown between impressions in seconds */
  cooldownSeconds: number;
  /** Whether to suppress this offer if user just lost a run (anti-predatory) */
  suppressAfterLoss: boolean;
  /** Minimum ticks played before showing (anti-churn-bait) */
  minTicksPlayedToShow: number;
  /** Whether this offer can appear during a run (always false for PZO) */
  showDuringRun: false;
  /** Discount percentage (0-50, capped at 50% by governance) */
  discountPct: number;
  /** Start time for scheduled offers */
  startsAt: string | null;
  /** End time for scheduled offers */
  endsAt: string | null;
  status: OfferStatus;
  policyVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferEvaluation {
  offerId: string;
  eligible: boolean;
  reason: string | null;
  suppressedBy: string | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPERIMENT CONSTRAINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ExperimentStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'CONCLUDED' | 'KILLED';

/** What CAN be varied in an experiment */
export type AllowedExperimentVariable =
  | 'PRICE'              // price point testing
  | 'OFFER_TIMING'       // when offers appear
  | 'BUNDLE_COMPOSITION' // which SKUs in a bundle
  | 'DISCOUNT_PCT'       // discount amount (max 50%)
  | 'UI_PLACEMENT'       // where the offer appears
  | 'COPY_VARIANT';      // text/creative variant

/** What CANNOT be varied — governance hard blocks */
export type ForbiddenExperimentVariable =
  | 'WIN_PROBABILITY'
  | 'CARD_DRAW_ODDS'
  | 'DAMAGE_MULTIPLIER'
  | 'SHIELD_STRENGTH'
  | 'PRESSURE_SCORING'
  | 'CORD_FORMULA'
  | 'SEED_SELECTION'
  | 'MATCHMAKING_BIAS';

export interface Experiment {
  experimentId: string;
  name: string;
  description: string;
  variable: AllowedExperimentVariable;
  /** Control group percentage (must be >= 10%) */
  controlPct: number;
  /** Treatment group percentage */
  treatmentPct: number;
  /** Holdout group percentage (must be >= 5%) */
  holdoutPct: number;
  /** SKU IDs involved in the experiment */
  targetSkuIds: string[];
  /** User segment targeting */
  segmentFilter: Record<string, unknown>;
  /** Maximum users enrolled */
  maxEnrollment: number;
  /** Primary success metric */
  primaryMetric: string;
  /** Guardrail metrics that auto-kill if breached */
  guardrailMetrics: GuardrailMetric[];
  status: ExperimentStatus;
  startedAt: string | null;
  concludedAt: string | null;
  policyVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuardrailMetric {
  metricName: string;
  /** If metric crosses this threshold, experiment auto-kills */
  threshold: number;
  direction: 'ABOVE' | 'BELOW';
  /** Check interval in minutes */
  checkIntervalMinutes: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KILLSWITCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type KillswitchTarget = 'SKU' | 'OFFER' | 'EXPERIMENT' | 'STORE' | 'ALL_PURCHASES';

export interface KillswitchEvent {
  eventId: string;
  target: KillswitchTarget;
  targetId: string | null; // null for STORE / ALL_PURCHASES
  reason: string;
  triggeredBy: string;
  triggeredAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  autoTriggered: boolean;
  /** Guardrail metric that triggered auto-kill (if autoTriggered) */
  guardrailSource: string | null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POLICY VERSIONING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PolicyVersion {
  versionId: string;
  versionNumber: number;
  /** SHA-256 hash of the policy document */
  contentHash: string;
  /** The full policy rules as structured data */
  rules: PolicyRules;
  publishedBy: string;
  publishedAt: string;
  /** Whether this is the currently active policy */
  isActive: boolean;
  /** Previous version ID for audit trail */
  previousVersionId: string | null;
}

export interface PolicyRules {
  /** Maximum discount allowed on any offer */
  maxDiscountPct: number;
  /** Maximum impressions per user per day across all offers */
  globalMaxImpressionsPerDay: number;
  /** Whether to suppress all offers after a loss */
  globalSuppressAfterLoss: boolean;
  /** Minimum ticks played before any monetization surface appears */
  globalMinTicksBeforeMonetization: number;
  /** Whether store is accessible during a run */
  storeDuringRunEnabled: false;
  /** Maximum concurrent experiments */
  maxConcurrentExperiments: number;
  /** Minimum control group size for experiments */
  minControlGroupPct: number;
  /** Minimum holdout group size for experiments */
  minHoldoutGroupPct: number;
  /** Forbidden SKU classes (immutable — cannot be overridden) */
  forbiddenSkuClasses: readonly ForbiddenSkuClass[];
  /** Forbidden experiment variables (immutable — cannot be overridden) */
  forbiddenExperimentVariables: readonly ForbiddenExperimentVariable[];
}

export const DEFAULT_POLICY_RULES: PolicyRules = {
  maxDiscountPct: 50,
  globalMaxImpressionsPerDay: 5,
  globalSuppressAfterLoss: true,
  globalMinTicksBeforeMonetization: 100,
  storeDuringRunEnabled: false,
  maxConcurrentExperiments: 3,
  minControlGroupPct: 10,
  minHoldoutGroupPct: 5,
  forbiddenSkuClasses: FORBIDDEN_SKU_CLASSES,
  forbiddenExperimentVariables: [
    'WIN_PROBABILITY', 'CARD_DRAW_ODDS', 'DAMAGE_MULTIPLIER',
    'SHIELD_STRENGTH', 'PRESSURE_SCORING', 'CORD_FORMULA',
    'SEED_SELECTION', 'MATCHMAKING_BIAS',
  ],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GOVERNANCE AUDIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type GovernanceAction =
  | 'SKU_CREATED' | 'SKU_UPDATED' | 'SKU_DEACTIVATED' | 'SKU_BLOCKED'
  | 'OFFER_CREATED' | 'OFFER_UPDATED' | 'OFFER_PAUSED' | 'OFFER_KILLED'
  | 'EXPERIMENT_CREATED' | 'EXPERIMENT_STARTED' | 'EXPERIMENT_PAUSED'
  | 'EXPERIMENT_CONCLUDED' | 'EXPERIMENT_KILLED' | 'EXPERIMENT_GUARDRAIL_TRIGGERED'
  | 'KILLSWITCH_ACTIVATED' | 'KILLSWITCH_RESOLVED'
  | 'POLICY_PUBLISHED' | 'POLICY_ACTIVATED'
  | 'PURCHASE_BLOCKED' | 'OFFER_SUPPRESSED';

export interface GovernanceAuditEntry {
  entryId: string;
  action: GovernanceAction;
  actorId: string;
  actorType: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  policyVersionId: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}