/**
 * Enumeration for Verification Statuses in Point Zero One Digital.
 */

export enum VerificationStatus {
  PENDING = "Pending",
  VERIFIED = "Verified",
  QUARANTINED = "Quarantined",
  APPEAL_RESOLVED = "Appeal Resolved"
}

/**
 * UI Label and Chip Color Tokens for VerificationStatus Enum.
 */

export type PendingLabel = "Pending";
export const PENDING_CHIP_COLOR: string = "#FFD700";

export type VerifiedLabel = "Verified";
export const VERIFIED_CHIP_COLOR: string = "#2ECC40";

export type QuarantinedLabel = "Quarantined";
export const QUARANTINED_CHIP_COLOR: string = "#F1C40F";

export type AppealResolvedLabel = "Appeal Resolved";
export const APPEAL_RESOLVED_CHIP_COLOR: string = "#689F38";
