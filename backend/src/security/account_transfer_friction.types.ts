/**
 * Account Transfer Friction — Shared Types
 * backend/src/security/account_transfer_friction.types.ts
 *
 * Shared domain types used by both the Account entity and the
 * AccountTransferFrictionService. This file exists to prevent
 * entity ↔ service coupling and circular imports.
 */

export type AbuseFlag =
  | 'RAPID_FIRE'
  | 'ROUND_TRIP'
  | 'STRUCTURING'
  | 'VELOCITY_BREACH'
  | 'NEW_ACCOUNT_HIGH_VALUE'
  | 'FOUNDER_LIMIT_BREACH';

export type AbuseReportDetails = Partial<Record<AbuseFlag, string>>;

export interface AbuseReport {
  accountId: number;
  flags: AbuseFlag[];
  riskScore: number;
  details: AbuseReportDetails;
  detectedAt: string;
}

export interface DeviceFingerprint {
  ipAddress: string;
  userAgent: string;
  acceptLanguage: string;
  fingerprint: string;
}

export type FounderBreachReason =
  | 'FOUNDER_DAILY_LIMIT_EXCEEDED'
  | 'FOUNDER_RECIPIENT_LIMIT_EXCEEDED'
  | 'FOUNDER_STAKING_DRAIN_RISK';