/**
 * Transparency Report Monthly Contract
 */

export interface TransparencyReportMonthly {
  month: string; // YYYY-MM format
  total_runs_sealed: number;
  pct_verified: number;
  pct_quarantined: number;
  avg_verification_ms: number;
  top_reason_categories: string[];
  enforcement_counts: EnforcementCounts;
}

export interface EnforcementCounts {
  soft_bans: number;
  hard_bans: number;
}
