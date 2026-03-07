/**
 * Commerce Governance — Validation Schemas
 * backend/src/api-gateway/commerce_governance/governance_schemas.ts
 *
 * Hardened validation layer for commerce governance request bodies.
 *
 * Design goals:
 * - Keep backwards-compatible export names so existing imports do not break
 * - Stay aligned with the backend's Joi-based validation style
 * - Enforce cross-field invariants that plain JSON-schema-style objects miss
 * - Provide reusable middleware + direct assertion helpers for routes/services/tests
 * - Normalize common inputs (trim strings, validate enums, reject unknown keys)
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import type { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import type { ObjectSchema, ValidationOptions } from 'joi';

/* ──────────────────────────────────────────────────────────────────────────────
 * Canonical enums
 * ──────────────────────────────────────────────────────────────────────────── */

export const SKU_CLASSES = [
  'COSMETIC',
  'ACCESS_CONTENT',
  'CONVENIENCE_NONCOMPETITIVE',
  'SOCIAL_FEATURE',
  'ARCHIVE_PROOF',
  'SUBSCRIPTION_PASS',
] as const;

export const OFFER_TRIGGERS = [
  'STORE_BROWSE',
  'SESSION_END',
  'SEASON_START',
  'ACHIEVEMENT',
  'SCHEDULED',
  'MANUAL',
] as const;

export const EXPERIMENT_VARIABLES = [
  'PRICE',
  'OFFER_TIMING',
  'BUNDLE_COMPOSITION',
  'DISCOUNT_PCT',
  'UI_PLACEMENT',
  'COPY_VARIANT',
] as const;

export const GUARDRail_DIRECTIONS = ['ABOVE', 'BELOW'] as const;

export const KILLSWITCH_TARGETS = [
  'SKU',
  'OFFER',
  'EXPERIMENT',
  'STORE',
  'ALL_PURCHASES',
] as const;

export type SkuClass = (typeof SKU_CLASSES)[number];
export type OfferTrigger = (typeof OFFER_TRIGGERS)[number];
export type ExperimentVariable = (typeof EXPERIMENT_VARIABLES)[number];
export type GuardrailDirection = (typeof GUARDRail_DIRECTIONS)[number];
export type KillswitchTarget = (typeof KILLSWITCH_TARGETS)[number];

/* ──────────────────────────────────────────────────────────────────────────────
 * Request contracts
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CreateSkuRequest {
  name: string;
  description?: string | null;
  skuClass: SkuClass;
  priceUsdCents: number;
  stripePriceId: string;
  stripeProductId: string;
  tags?: string[];
  competitiveSafe?: boolean;
  maxPerUser?: number;
}

export interface UpdateSkuRequest {
  name?: string;
  description?: string | null;
  priceUsdCents?: number;
  stripePriceId?: string;
  tags?: string[];
  competitiveSafe?: boolean;
  maxPerUser?: number;
  active?: boolean;
}

export interface CreateOfferRequest {
  name: string;
  skuIds: string[];
  trigger: OfferTrigger;
  maxImpressionsPerUserPerDay?: number;
  maxImpressionsPerUserTotal?: number;
  cooldownSeconds?: number;
  suppressAfterLoss?: boolean;
  minTicksPlayedToShow?: number;
  discountPct?: number;
  startsAt?: string;
  endsAt?: string;
}

export interface GuardrailMetric {
  metricName: string;
  threshold: number;
  direction: GuardrailDirection;
  checkIntervalMinutes: number;
}

export interface CreateExperimentRequest {
  name: string;
  description?: string | null;
  variable: ExperimentVariable;
  controlPct: number;
  treatmentPct: number;
  holdoutPct: number;
  targetSkuIds?: string[];
  segmentFilter?: Record<string, unknown>;
  maxEnrollment?: number;
  primaryMetric: string;
  guardrailMetrics: GuardrailMetric[];
}

export interface ActivateKillswitchRequest {
  target: KillswitchTarget;
  targetId?: string;
  reason: string;
}

export interface PublishPolicyRulesRequest {
  maxDiscountPct: number;
  globalMaxImpressionsPerDay: number;
  globalSuppressAfterLoss?: boolean;
  globalMinTicksBeforeMonetization?: number;
  maxConcurrentExperiments: number;
  minControlGroupPct?: number;
  minHoldoutGroupPct?: number;
}

export interface PublishPolicyRequest {
  rules: PublishPolicyRulesRequest;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Validation constants
 * ──────────────────────────────────────────────────────────────────────────── */

const MAX_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_REASON_LENGTH = 1_000;
const MAX_TAG_LENGTH = 50;
const MAX_TAG_COUNT = 20;
const MAX_STRIPE_ID_LENGTH = 255;
const MAX_ENTITY_ID_LENGTH = 255;
const MAX_METRIC_NAME_LENGTH = 100;
const MIN_PRICE_CENTS = 49;
const MAX_PRICE_CENTS = 99_999;
const MAX_SKU_IDS_PER_OFFER = 10;
const MAX_TARGET_SKU_IDS_PER_EXPERIMENT = 20;
const MAX_GUARDRAIL_METRICS = 10;
const MAX_IMPRESSIONS_PER_DAY = 20;
const MAX_IMPRESSIONS_TOTAL = 10_000;
const MAX_COOLDOWN_SECONDS = 86_400;
const MAX_TICKS_PLAYED = 100_000;
const MAX_DISCOUNT_PCT = 50;
const MAX_PER_USER = 10_000;
const MIN_MAX_ENROLLMENT = 100;
const MAX_MAX_ENROLLMENT = 10_000_000;
const MIN_CHECK_INTERVAL_MINUTES = 5;
const MAX_CHECK_INTERVAL_MINUTES = 1_440;

/* ──────────────────────────────────────────────────────────────────────────────
 * Shared Joi settings
 * ──────────────────────────────────────────────────────────────────────────── */

const DEFAULT_VALIDATE_OPTIONS: ValidationOptions = {
  abortEarly: false,
  convert: true,
  allowUnknown: false,
};

const COMMON_MESSAGES = {
  'any.custom': '{{#message}}',
  'array.unique': '{{#label}} contains duplicate values',
  'any.only': '{{#label}} must be one of the allowed values',
  'object.unknown': '{{#label}} contains an unknown field',
  'string.empty': '{{#label}} cannot be empty',
  'string.pattern.base': '{{#label}} has an invalid format',
};

/* ──────────────────────────────────────────────────────────────────────────────
 * Shared primitives
 * ──────────────────────────────────────────────────────────────────────────── */

const trimmedRequiredString = (max: number) =>
  Joi.string().trim().min(1).max(max).required();

const trimmedOptionalText = (max: number) =>
  Joi.string().trim().max(max).allow(null, '').empty('').optional();

const entityIdSchema = Joi.string()
  .trim()
  .min(1)
  .max(MAX_ENTITY_ID_LENGTH)
  .pattern(/^[A-Za-z0-9:_-]+$/);

const stripePriceIdSchema = Joi.string()
  .trim()
  .min(1)
  .max(MAX_STRIPE_ID_LENGTH)
  .pattern(/^price_[A-Za-z0-9]+$/);

const stripeProductIdSchema = Joi.string()
  .trim()
  .min(1)
  .max(MAX_STRIPE_ID_LENGTH)
  .pattern(/^prod_[A-Za-z0-9]+$/);

const isoDateTimeSchema = Joi.string().trim().isoDate();

const tagSchema = Joi.string()
  .trim()
  .lowercase()
  .min(1)
  .max(MAX_TAG_LENGTH)
  .pattern(/^[a-z0-9:_-]+$/);

const metricNameSchema = Joi.string()
  .trim()
  .min(1)
  .max(MAX_METRIC_NAME_LENGTH);

const pctNumberSchema = Joi.number().min(0).max(100).precision(2);

const moneyCentsSchema = Joi.number()
  .integer()
  .min(MIN_PRICE_CENTS)
  .max(MAX_PRICE_CENTS);

/* ──────────────────────────────────────────────────────────────────────────────
 * Cross-field validators
 * ──────────────────────────────────────────────────────────────────────────── */

function validateOfferWindow(
  value: CreateOfferRequest,
  helpers: Joi.CustomHelpers<CreateOfferRequest>,
): CreateOfferRequest {
  const hasStart = typeof value.startsAt === 'string' && value.startsAt.length > 0;
  const hasEnd = typeof value.endsAt === 'string' && value.endsAt.length > 0;

  if (hasStart !== hasEnd) {
    return helpers.error('any.custom', {
      message: 'startsAt and endsAt must be provided together',
    }) as unknown as CreateOfferRequest;
  }

  if (value.trigger === 'SCHEDULED' && (!hasStart || !hasEnd)) {
    return helpers.error('any.custom', {
      message: 'SCHEDULED offers require both startsAt and endsAt',
    }) as unknown as CreateOfferRequest;
  }

  if (hasStart && hasEnd) {
    const startMs = Date.parse(value.startsAt as string);
    const endMs = Date.parse(value.endsAt as string);

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return helpers.error('any.custom', {
        message: 'startsAt and endsAt must be valid ISO-8601 timestamps',
      }) as unknown as CreateOfferRequest;
    }

    if (endMs <= startMs) {
      return helpers.error('any.custom', {
        message: 'endsAt must be greater than startsAt',
      }) as unknown as CreateOfferRequest;
    }
  }

  if (
    typeof value.maxImpressionsPerUserTotal === 'number' &&
    value.maxImpressionsPerUserTotal > 0 &&
    typeof value.maxImpressionsPerUserPerDay === 'number' &&
    value.maxImpressionsPerUserPerDay > value.maxImpressionsPerUserTotal
  ) {
    return helpers.error('any.custom', {
      message:
        'maxImpressionsPerUserPerDay cannot exceed maxImpressionsPerUserTotal when a total cap is set',
    }) as unknown as CreateOfferRequest;
  }

  return value;
}

function validateExperimentAllocation(
  value: CreateExperimentRequest,
  helpers: Joi.CustomHelpers<CreateExperimentRequest>,
): CreateExperimentRequest {
  const total = Number(value.controlPct) + Number(value.treatmentPct) + Number(value.holdoutPct);
  const rounded = Math.round(total * 100) / 100;

  if (rounded !== 100) {
    return helpers.error('any.custom', {
      message: 'controlPct + treatmentPct + holdoutPct must equal exactly 100',
    }) as unknown as CreateExperimentRequest;
  }

  if (
    (value.variable === 'PRICE' || value.variable === 'DISCOUNT_PCT') &&
    (!Array.isArray(value.targetSkuIds) || value.targetSkuIds.length === 0)
  ) {
    return helpers.error('any.custom', {
      message: 'PRICE and DISCOUNT_PCT experiments require at least one targetSkuId',
    }) as unknown as CreateExperimentRequest;
  }

  const guardrailMetricNames = new Set<string>();
  for (const metric of value.guardrailMetrics ?? []) {
    const key = metric.metricName.trim().toLowerCase();
    if (guardrailMetricNames.has(key)) {
      return helpers.error('any.custom', {
        message: `guardrailMetrics contains a duplicate metricName: ${metric.metricName}`,
      }) as unknown as CreateExperimentRequest;
    }
    guardrailMetricNames.add(key);
  }

  if (guardrailMetricNames.has(value.primaryMetric.trim().toLowerCase())) {
    return helpers.error('any.custom', {
      message: 'primaryMetric must not also appear in guardrailMetrics',
    }) as unknown as CreateExperimentRequest;
  }

  return value;
}

function validateKillswitchPayload(
  value: ActivateKillswitchRequest,
  helpers: Joi.CustomHelpers<ActivateKillswitchRequest>,
): ActivateKillswitchRequest {
  const requiresTargetId =
    value.target === 'SKU' || value.target === 'OFFER' || value.target === 'EXPERIMENT';

  const hasTargetId = typeof value.targetId === 'string' && value.targetId.trim().length > 0;

  if (requiresTargetId && !hasTargetId) {
    return helpers.error('any.custom', {
      message: `${value.target} killswitch requires targetId`,
    }) as unknown as ActivateKillswitchRequest;
  }

  if (!requiresTargetId && hasTargetId) {
    return helpers.error('any.custom', {
      message: `${value.target} killswitch must not include targetId`,
    }) as unknown as ActivateKillswitchRequest;
  }

  return value;
}

function validatePolicyRules(
  value: PublishPolicyRequest,
  helpers: Joi.CustomHelpers<PublishPolicyRequest>,
): PublishPolicyRequest {
  const minControl = value.rules.minControlGroupPct ?? 5;
  const minHoldout = value.rules.minHoldoutGroupPct ?? 5;

  if (minControl + minHoldout >= 100) {
    return helpers.error('any.custom', {
      message: 'minControlGroupPct + minHoldoutGroupPct must be less than 100',
    }) as unknown as PublishPolicyRequest;
  }

  return value;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Schema definitions
 * ──────────────────────────────────────────────────────────────────────────── */

export const CreateSkuSchema: ObjectSchema<CreateSkuRequest> = Joi.object({
  name: trimmedRequiredString(MAX_NAME_LENGTH),
  description: trimmedOptionalText(MAX_DESCRIPTION_LENGTH),
  skuClass: Joi.string()
    .valid(...SKU_CLASSES)
    .required(),
  priceUsdCents: moneyCentsSchema.required(),
  stripePriceId: stripePriceIdSchema.required(),
  stripeProductId: stripeProductIdSchema.required(),
  tags: Joi.array()
    .items(tagSchema)
    .max(MAX_TAG_COUNT)
    .unique()
    .optional(),
  competitiveSafe: Joi.boolean().default(true),
  maxPerUser: Joi.number()
    .integer()
    .min(0)
    .max(MAX_PER_USER)
    .default(0),
})
  .unknown(false)
  .messages(COMMON_MESSAGES);

export const UpdateSkuSchema: ObjectSchema<UpdateSkuRequest> = Joi.object({
  name: trimmedRequiredString(MAX_NAME_LENGTH).optional(),
  description: trimmedOptionalText(MAX_DESCRIPTION_LENGTH),
  priceUsdCents: moneyCentsSchema.optional(),
  stripePriceId: stripePriceIdSchema.optional(),
  tags: Joi.array()
    .items(tagSchema)
    .max(MAX_TAG_COUNT)
    .unique()
    .optional(),
  competitiveSafe: Joi.boolean().optional(),
  maxPerUser: Joi.number()
    .integer()
    .min(0)
    .max(MAX_PER_USER)
    .optional(),
  active: Joi.boolean().optional(),
})
  .min(1)
  .unknown(false)
  .messages(COMMON_MESSAGES);

export const CreateOfferSchema: ObjectSchema<CreateOfferRequest> = Joi.object({
  name: trimmedRequiredString(MAX_NAME_LENGTH),
  skuIds: Joi.array()
    .items(entityIdSchema.required())
    .min(1)
    .max(MAX_SKU_IDS_PER_OFFER)
    .unique()
    .required(),
  trigger: Joi.string()
    .valid(...OFFER_TRIGGERS)
    .required(),
  maxImpressionsPerUserPerDay: Joi.number()
    .integer()
    .min(1)
    .max(MAX_IMPRESSIONS_PER_DAY)
    .default(3),
  maxImpressionsPerUserTotal: Joi.number()
    .integer()
    .min(0)
    .max(MAX_IMPRESSIONS_TOTAL)
    .default(0),
  cooldownSeconds: Joi.number()
    .integer()
    .min(0)
    .max(MAX_COOLDOWN_SECONDS)
    .default(0),
  suppressAfterLoss: Joi.boolean().default(false),
  minTicksPlayedToShow: Joi.number()
    .integer()
    .min(0)
    .max(MAX_TICKS_PLAYED)
    .default(0),
  discountPct: Joi.number()
    .integer()
    .min(0)
    .max(MAX_DISCOUNT_PCT)
    .default(0),
  startsAt: isoDateTimeSchema.optional(),
  endsAt: isoDateTimeSchema.optional(),
})
  .custom(validateOfferWindow)
  .unknown(false)
  .messages(COMMON_MESSAGES);

export const CreateExperimentSchema: ObjectSchema<CreateExperimentRequest> = Joi.object({
  name: trimmedRequiredString(MAX_NAME_LENGTH),
  description: trimmedOptionalText(MAX_DESCRIPTION_LENGTH),
  variable: Joi.string()
    .valid(...EXPERIMENT_VARIABLES)
    .required(),
  controlPct: pctNumberSchema.min(10).max(90).required(),
  treatmentPct: pctNumberSchema.min(5).max(85).required(),
  holdoutPct: pctNumberSchema.min(5).max(50).required(),
  targetSkuIds: Joi.array()
    .items(entityIdSchema.required())
    .max(MAX_TARGET_SKU_IDS_PER_EXPERIMENT)
    .unique()
    .optional(),
  segmentFilter: Joi.object().unknown(true).optional(),
  maxEnrollment: Joi.number()
    .integer()
    .min(MIN_MAX_ENROLLMENT)
    .max(MAX_MAX_ENROLLMENT)
    .default(100_000),
  primaryMetric: metricNameSchema.required(),
  guardrailMetrics: Joi.array()
    .items(
      Joi.object({
        metricName: metricNameSchema.required(),
        threshold: Joi.number().required(),
        direction: Joi.string()
          .valid(...GUARDRail_DIRECTIONS)
          .required(),
        checkIntervalMinutes: Joi.number()
          .integer()
          .min(MIN_CHECK_INTERVAL_MINUTES)
          .max(MAX_CHECK_INTERVAL_MINUTES)
          .required(),
      })
        .unknown(false)
        .messages(COMMON_MESSAGES),
    )
    .min(1)
    .max(MAX_GUARDRAIL_METRICS)
    .required(),
})
  .custom(validateExperimentAllocation)
  .unknown(false)
  .messages(COMMON_MESSAGES);

export const ActivateKillswitchSchema: ObjectSchema<ActivateKillswitchRequest> = Joi.object({
  target: Joi.string()
    .valid(...KILLSWITCH_TARGETS)
    .required(),
  targetId: entityIdSchema.optional(),
  reason: trimmedRequiredString(MAX_REASON_LENGTH),
})
  .custom(validateKillswitchPayload)
  .unknown(false)
  .messages(COMMON_MESSAGES);

export const PublishPolicySchema: ObjectSchema<PublishPolicyRequest> = Joi.object({
  rules: Joi.object({
    maxDiscountPct: Joi.number()
      .integer()
      .min(0)
      .max(MAX_DISCOUNT_PCT)
      .required(),
    globalMaxImpressionsPerDay: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .required(),
    globalSuppressAfterLoss: Joi.boolean().default(false),
    globalMinTicksBeforeMonetization: Joi.number()
      .integer()
      .min(0)
      .max(10_000)
      .default(0),
    maxConcurrentExperiments: Joi.number()
      .integer()
      .min(1)
      .max(10)
      .required(),
    minControlGroupPct: Joi.number()
      .integer()
      .min(5)
      .max(50)
      .default(5),
    minHoldoutGroupPct: Joi.number()
      .integer()
      .min(5)
      .max(50)
      .default(5),
  })
    .unknown(false)
    .required()
    .messages(COMMON_MESSAGES),
})
  .custom(validatePolicyRules)
  .unknown(false)
  .messages(COMMON_MESSAGES);

/* ──────────────────────────────────────────────────────────────────────────────
 * Canonical schema registry
 * ──────────────────────────────────────────────────────────────────────────── */

export const GovernanceSchemas = {
  createSku: CreateSkuSchema,
  updateSku: UpdateSkuSchema,
  createOffer: CreateOfferSchema,
  createExperiment: CreateExperimentSchema,
  activateKillswitch: ActivateKillswitchSchema,
  publishPolicy: PublishPolicySchema,
} as const;

export type GovernanceSchemaName = keyof typeof GovernanceSchemas;

/* ──────────────────────────────────────────────────────────────────────────────
 * Error formatting
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GovernanceValidationIssue {
  path: string;
  message: string;
  type: string;
}

export interface GovernanceValidationErrorResponse {
  ok: false;
  error: 'validation_failed';
  details: GovernanceValidationIssue[];
}

export function formatGovernanceValidationError(
  error: Joi.ValidationError,
): GovernanceValidationErrorResponse {
  return {
    ok: false,
    error: 'validation_failed',
    details: error.details.map((detail) => ({
      path: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    })),
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Reusable validators
 * ──────────────────────────────────────────────────────────────────────────── */

export function validateGovernanceBody(
  schema: ObjectSchema,
  options: Partial<ValidationOptions> = {},
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      ...DEFAULT_VALIDATE_OPTIONS,
      ...options,
    });

    if (error) {
      res.status(400).json(formatGovernanceValidationError(error));
      return;
    }

    req.body = value;
    next();
  };
}

export function validateGovernanceBodyByName(
  schemaName: GovernanceSchemaName,
  options: Partial<ValidationOptions> = {},
) {
  return validateGovernanceBody(GovernanceSchemas[schemaName], options);
}

export function assertValidGovernancePayload<T>(
  schema: ObjectSchema<T>,
  payload: unknown,
  options: Partial<ValidationOptions> = {},
): T {
  const { error, value } = schema.validate(payload, {
    ...DEFAULT_VALIDATE_OPTIONS,
    ...options,
  });

  if (error) {
    const details = error.details
      .map((detail) => `${detail.path.join('.') || '<root>'}: ${detail.message}`)
      .join('; ');

    throw new Error(`governance_validation_failed: ${details}`);
  }

  return value as T;
}

export default GovernanceSchemas;