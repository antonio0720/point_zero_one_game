/**
 * Commerce Governance — Validation Schemas
 * backend/src/api-gateway/commerce_governance/governance_schemas.ts
 *
 * Ajv JSON Schemas for all governance API request bodies.
 *
 * Density6 LLC · Point Zero One · Confidential
 */

export const CreateSkuSchema = {
  type: 'object',
  required: ['name', 'skuClass', 'priceUsdCents', 'stripePriceId', 'stripeProductId'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    description: { type: 'string', maxLength: 2000 },
    skuClass: {
      type: 'string',
      enum: ['COSMETIC', 'ACCESS_CONTENT', 'CONVENIENCE_NONCOMPETITIVE', 'SOCIAL_FEATURE', 'ARCHIVE_PROOF', 'SUBSCRIPTION_PASS'],
    },
    priceUsdCents: { type: 'integer', minimum: 49, maximum: 99999 },
    stripePriceId: { type: 'string', minLength: 1, maxLength: 255 },
    stripeProductId: { type: 'string', minLength: 1, maxLength: 255 },
    tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
    competitiveSafe: { type: 'boolean' },
    maxPerUser: { type: 'integer', minimum: 0, maximum: 10000 },
  },
  additionalProperties: false,
};

export const UpdateSkuSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    description: { type: 'string', maxLength: 2000 },
    priceUsdCents: { type: 'integer', minimum: 49, maximum: 99999 },
    stripePriceId: { type: 'string', minLength: 1, maxLength: 255 },
    tags: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
    competitiveSafe: { type: 'boolean' },
    maxPerUser: { type: 'integer', minimum: 0, maximum: 10000 },
    active: { type: 'boolean' },
  },
  additionalProperties: false,
};

export const CreateOfferSchema = {
  type: 'object',
  required: ['name', 'skuIds', 'trigger'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    skuIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
    trigger: { type: 'string', enum: ['STORE_BROWSE', 'SESSION_END', 'SEASON_START', 'ACHIEVEMENT', 'SCHEDULED', 'MANUAL'] },
    maxImpressionsPerUserPerDay: { type: 'integer', minimum: 1, maximum: 20 },
    maxImpressionsPerUserTotal: { type: 'integer', minimum: 0, maximum: 10000 },
    cooldownSeconds: { type: 'integer', minimum: 0, maximum: 86400 },
    suppressAfterLoss: { type: 'boolean' },
    minTicksPlayedToShow: { type: 'integer', minimum: 0, maximum: 100000 },
    discountPct: { type: 'integer', minimum: 0, maximum: 50 },
    startsAt: { type: 'string', format: 'date-time' },
    endsAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: false,
};

export const CreateExperimentSchema = {
  type: 'object',
  required: ['name', 'variable', 'controlPct', 'treatmentPct', 'holdoutPct', 'primaryMetric', 'guardrailMetrics'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 255 },
    description: { type: 'string', maxLength: 2000 },
    variable: { type: 'string', enum: ['PRICE', 'OFFER_TIMING', 'BUNDLE_COMPOSITION', 'DISCOUNT_PCT', 'UI_PLACEMENT', 'COPY_VARIANT'] },
    controlPct: { type: 'number', minimum: 10, maximum: 90 },
    treatmentPct: { type: 'number', minimum: 5, maximum: 85 },
    holdoutPct: { type: 'number', minimum: 5, maximum: 50 },
    targetSkuIds: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    segmentFilter: { type: 'object' },
    maxEnrollment: { type: 'integer', minimum: 100, maximum: 10000000 },
    primaryMetric: { type: 'string', minLength: 1, maxLength: 100 },
    guardrailMetrics: {
      type: 'array', minItems: 1, maxItems: 10,
      items: {
        type: 'object',
        required: ['metricName', 'threshold', 'direction', 'checkIntervalMinutes'],
        properties: {
          metricName: { type: 'string', minLength: 1 },
          threshold: { type: 'number' },
          direction: { type: 'string', enum: ['ABOVE', 'BELOW'] },
          checkIntervalMinutes: { type: 'integer', minimum: 5, maximum: 1440 },
        },
      },
    },
  },
  additionalProperties: false,
};

export const ActivateKillswitchSchema = {
  type: 'object',
  required: ['target', 'reason'],
  properties: {
    target: { type: 'string', enum: ['SKU', 'OFFER', 'EXPERIMENT', 'STORE', 'ALL_PURCHASES'] },
    targetId: { type: 'string', maxLength: 255 },
    reason: { type: 'string', minLength: 1, maxLength: 1000 },
  },
  additionalProperties: false,
};

export const PublishPolicySchema = {
  type: 'object',
  required: ['rules'],
  properties: {
    rules: {
      type: 'object',
      required: ['maxDiscountPct', 'globalMaxImpressionsPerDay', 'maxConcurrentExperiments'],
      properties: {
        maxDiscountPct: { type: 'integer', minimum: 0, maximum: 50 },
        globalMaxImpressionsPerDay: { type: 'integer', minimum: 1, maximum: 50 },
        globalSuppressAfterLoss: { type: 'boolean' },
        globalMinTicksBeforeMonetization: { type: 'integer', minimum: 0, maximum: 10000 },
        maxConcurrentExperiments: { type: 'integer', minimum: 1, maximum: 10 },
        minControlGroupPct: { type: 'integer', minimum: 5, maximum: 50 },
        minHoldoutGroupPct: { type: 'integer', minimum: 5, maximum: 50 },
      },
    },
  },
  additionalProperties: false,
};