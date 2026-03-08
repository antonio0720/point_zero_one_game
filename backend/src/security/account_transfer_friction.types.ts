/**
 * Account Transfer Friction — Shared Types
 * backend/src/security/account_transfer_friction.types.ts
 *
 * Shared domain types used by both the Account entity and the
 * AccountTransferFrictionService. This file exists to prevent
 * entity ↔ service coupling and circular imports.
 *
 * Design goals:
 * - Keep current service imports intact
 * - Provide strong literal-union typing for all abuse flags/reasons
 * - Offer lightweight runtime guards/helpers without introducing new dependencies
 * - Stay source-compatible with the existing Account entity and service logic
 */

// -----------------------------------------------------------------------------
// Abuse flags
// -----------------------------------------------------------------------------

export const ABUSE_FLAGS = [
  'RAPID_FIRE',
  'ROUND_TRIP',
  'STRUCTURING',
  'VELOCITY_BREACH',
  'NEW_ACCOUNT_HIGH_VALUE',
  'FOUNDER_LIMIT_BREACH',
] as const;

export type AbuseFlag = (typeof ABUSE_FLAGS)[number];

export type AbuseReportDetails = Partial<Record<AbuseFlag, string>>;

// -----------------------------------------------------------------------------
// Founder protection reasons
// -----------------------------------------------------------------------------

export const FOUNDER_BREACH_REASONS = [
  'FOUNDER_DAILY_LIMIT_EXCEEDED',
  'FOUNDER_RECIPIENT_LIMIT_EXCEEDED',
  'FOUNDER_STAKING_DRAIN_RISK',
] as const;

export type FounderBreachReason = (typeof FOUNDER_BREACH_REASONS)[number];

// -----------------------------------------------------------------------------
// Device fingerprinting
// -----------------------------------------------------------------------------

export interface DeviceFingerprint {
  ipAddress: string;
  userAgent: string;
  acceptLanguage: string;
  fingerprint: string;
}

// -----------------------------------------------------------------------------
// Abuse reporting
// -----------------------------------------------------------------------------

export interface AbuseReport {
  accountId: number;
  flags: AbuseFlag[];
  riskScore: number;
  details: AbuseReportDetails;
  detectedAt: string;
}

// -----------------------------------------------------------------------------
// Optional richer metadata types for future-safe reuse
// -----------------------------------------------------------------------------

export interface FounderDailyLimitExceededMeta {
  sentToday: number;
  attemptedAmount: number;
  limit: number;
}

export interface FounderRecipientLimitExceededMeta {
  recipientsToday: number;
  limit: number;
}

export interface FounderStakingDrainRiskMeta {
  stakingBalance: number;
  attemptedAmount: number;
}

export type FounderBreachMeta =
  | FounderDailyLimitExceededMeta
  | FounderRecipientLimitExceededMeta
  | FounderStakingDrainRiskMeta;

export type AbuseFlagWeights = Readonly<Record<AbuseFlag, number>>;

export const DEFAULT_ABUSE_FLAG_WEIGHTS: AbuseFlagWeights = {
  RAPID_FIRE: 20,
  ROUND_TRIP: 30,
  STRUCTURING: 35,
  VELOCITY_BREACH: 25,
  NEW_ACCOUNT_HIGH_VALUE: 20,
  FOUNDER_LIMIT_BREACH: 40,
} as const;

// -----------------------------------------------------------------------------
// Runtime guards / helpers
// -----------------------------------------------------------------------------

const ABUSE_FLAG_SET: ReadonlySet<string> = new Set<string>(ABUSE_FLAGS);
const FOUNDER_BREACH_REASON_SET: ReadonlySet<string> = new Set<string>(
  FOUNDER_BREACH_REASONS,
);

export function isAbuseFlag(value: unknown): value is AbuseFlag {
  return typeof value === 'string' && ABUSE_FLAG_SET.has(value);
}

export function isFounderBreachReason(
  value: unknown,
): value is FounderBreachReason {
  return typeof value === 'string' && FOUNDER_BREACH_REASON_SET.has(value);
}

export function normalizeAbuseFlags(value: unknown): AbuseFlag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = new Set<AbuseFlag>();

  for (const entry of value) {
    if (isAbuseFlag(entry)) {
      normalized.add(entry);
    }
  }

  return [...normalized];
}

export function clampAbuseRiskScore(value: unknown): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : 0;

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.trunc(numeric)));
}

export function createEmptyAbuseReportDetails(): AbuseReportDetails {
  return {};
}

export function createAbuseReport(input: {
  accountId: number;
  flags: AbuseFlag[];
  riskScore: number;
  details?: AbuseReportDetails;
  detectedAt?: string;
}): AbuseReport {
  return {
    accountId: input.accountId,
    flags: normalizeAbuseFlags(input.flags),
    riskScore: clampAbuseRiskScore(input.riskScore),
    details: input.details ?? {},
    detectedAt: input.detectedAt ?? new Date().toISOString(),
  };
}