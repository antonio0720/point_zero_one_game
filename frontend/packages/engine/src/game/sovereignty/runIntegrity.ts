// ═══════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — game/sovereignty/runIntegrity.ts
// Sprint 8 — Run Integrity + Verified Record System
// Density6 LLC · Confidential · All Rights Reserved
//
// Split from proofHash.ts (Sprint 7 had these combined — now separated).
//
// Responsibilities:
//   · VerifiedRunRecord — the canonical DB record for a completed, verified run
//   · RunIntegrityCheck — result of ReplayIntegrityChecker.verify()
//   · buildVerifiedRunRecord() — construct from sovereignty pipeline output
//   · Leaderboard entry types for all 4 modes
//   · formatNetWorth() for display (uses DM Mono font token)
//
// Import rules:
//   · imports from proofHash.ts (RunGrade, BadgeTier, RunOutcome, gradeToBadgeTier)
//   · imports from cordCalculator.ts (CordTier, cordTier, cordTierColor)
//   · NEVER imports from engine modules
//
// Font contract:
//   · All numeric display: DM Mono
//   · All label display: Barlow Condensed
//   · All colors: WCAG AA+ on C.panel (#0D0D1E)
// ═══════════════════════════════════════════════════════════════════════════

import type {
  RunGrade, BadgeTier, RunOutcome, ProofHashVersion,
} from './proofHash';
import {
  gradeToBadgeTier, gradeColor, outcomeColor, outcomeLabel,
  PROOF_HASH_VERSION, buildBadgeSvg,
} from './proofHash';
import type { CordTier } from './cordCalculator';
import { cordTier, cordTierColor, cordTierIcon } from './cordCalculator';

// ── Integrity check result ─────────────────────────────────────────────────────

export type IntegrityStatus = 'VERIFIED' | 'TAMPERED' | 'UNVERIFIED';

export interface RunIntegrityCheck {
  runId:         string;
  proofHash:     string;
  status:        IntegrityStatus;
  validatedAt:   number;   // Unix ms
  hashVersion:   ProofHashVersion;
  anomalyScore?: number;   // 0.0–1.0 — populated by ReplayIntegrityChecker
  failureReason?: string;  // populated when status !== 'VERIFIED'
}

// ── Verified run record (canonical DB shape) ──────────────────────────────────

/**
 * The full record written to DB when a run completes sovereignty pipeline.
 * FIXED: Now includes `mode`, `cordTier` (CORD-scale), and `badgeTier` as
 * separate typed fields. Old record mixed RunGrade (A/B/C/D/F) and CORD tier
 * (BRONZE/SILVER/GOLD/PLATINUM/SOVEREIGN) with no type distinction.
 */
export interface VerifiedRunRecord {
  // Identity
  runId:          string;
  userId:         string;
  displayName:    string;
  mode:           string;   // 'EMPIRE' | 'PREDATOR' | 'SYNDICATE' | 'PHANTOM'

  // Seed + timing
  seed:           number;
  finalTick:      number;
  verifiedAt:     number;   // Unix ms

  // Financials
  finalCash:      number;
  finalNetWorth:  number;
  finalIncome:    number;

  // Sovereignty score (RunGradeAssigner output — 0.0–1.5)
  sovereigntyScore:  number;
  /** RunGrade: A | B | C | D | F — from GRADE_THRESHOLDS brackets */
  grade:             RunGrade;
  badgeTier:         BadgeTier;

  // CORD score (cordCalculator output — 0.0–1.0)
  cordScore:         number;
  /** CordTier: UNRANKED | BRONZE | SILVER | GOLD | PLATINUM | SOVEREIGN */
  cordTierLabel:     CordTier;

  // Proof
  proofHash:      string;   // SHA-256 hex, 64 chars
  shortHash:      string;   // first 12 chars for display
  hashVersion:    ProofHashVersion;
  integrityStatus: IntegrityStatus;

  // Legend eligibility (Phantom mode)
  isLegend:       boolean;

  // Telemetry
  eventCount:     number;
}

// ── Builder ────────────────────────────────────────────────────────────────────

export function buildVerifiedRunRecord(
  runId:        string,
  userId:       string,
  displayName:  string,
  mode:         string,
  input: {
    seed:              number;
    finalTick:         number;
    finalCash:         number;
    finalNetWorth:     number;
    finalIncome:       number;
    sovereigntyScore:  number;
    grade:             RunGrade;
    outcome:           RunOutcome;
    cordScore:         number;
    proofHash:         string;
    hashVersion?:      string;
    integrityStatus:   IntegrityStatus;
    isLegend:          boolean;
    eventCount:        number;
  },
): VerifiedRunRecord {
  return {
    runId,
    userId,
    displayName,
    mode,
    seed:             input.seed,
    finalTick:        input.finalTick,
    verifiedAt:       Date.now(),
    finalCash:        input.finalCash,
    finalNetWorth:    input.finalNetWorth,
    finalIncome:      input.finalIncome,
    sovereigntyScore: input.sovereigntyScore,
    grade:            input.grade,
    badgeTier:        gradeToBadgeTier(input.grade, input.outcome),
    cordScore:        input.cordScore,
    cordTierLabel:    cordTier(input.cordScore),
    proofHash:        input.proofHash,
    shortHash:        input.proofHash.slice(0, 12),
    hashVersion:      (input.hashVersion ?? PROOF_HASH_VERSION) as ProofHashVersion,
    integrityStatus:  input.integrityStatus,
    isLegend:         input.isLegend,
    eventCount:       input.eventCount,
  };
}

// ── Leaderboard entry types ────────────────────────────────────────────────────

/**
 * Universal leaderboard entry — used for all 4 modes.
 * Rendered in ClubUI.tsx and LeagueUI.tsx.
 *
 * Visual contract:
 *   · rank:       Barlow Condensed Bold, #F0F0FF on panel
 *   · handle:     DM Mono 500, C.textSub
 *   · score:      DM Mono 600, mode accent color
 *   · tier badge: 20px inline SVG via buildBadgeSvg()
 */
export interface LeaderboardEntry {
  rank:           number;
  userId:         string;
  displayName:    string;
  mode:           string;
  cordScore:      number;
  cordTierLabel:  CordTier;
  cordTierColor:  string;
  cordTierIcon:   string;
  grade:          RunGrade;
  gradeColor:     string;
  badgeTier:      BadgeTier;
  finalNetWorth:  number;
  shortHash:      string;
  verifiedAt:     number;
  isLegend:       boolean;
  /** Inline SVG for badge — pre-built for list rendering performance */
  badgeSvgSmall:  string;  // 24px
}

export function buildLeaderboardEntry(record: VerifiedRunRecord, rank: number): LeaderboardEntry {
  return {
    rank,
    userId:        record.userId,
    displayName:   record.displayName,
    mode:          record.mode,
    cordScore:     record.cordScore,
    cordTierLabel: record.cordTierLabel,
    cordTierColor: cordTierColor(record.cordTierLabel),
    cordTierIcon:  cordTierIcon(record.cordTierLabel),
    grade:         record.grade,
    gradeColor:    gradeColor(record.grade),
    badgeTier:     record.badgeTier,
    finalNetWorth: record.finalNetWorth,
    shortHash:     record.shortHash,
    verifiedAt:    record.verifiedAt,
    isLegend:      record.isLegend,
    badgeSvgSmall: buildBadgeSvg(record.badgeTier, 24),
  };
}

// ── Net worth display formatter ────────────────────────────────────────────────

/**
 * Format net worth for display in DM Mono.
 * Matches fmtMoney() from core/format.ts for consistency.
 * Included here so sovereignty module doesn't import from core.
 */
export function formatNetWorth(n: number): string {
  const sign = n < 0 ? '−' : '';
  const v    = Math.abs(n);
  if (v >= 1_000_000_000) return `${sign}$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1_000_000)     return `${sign}$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1_000)         return `${sign}$${(v / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(v).toLocaleString()}`;
}

// ── Integrity status display ───────────────────────────────────────────────────

export function integrityStatusColor(status: IntegrityStatus): string {
  switch (status) {
    case 'VERIFIED':   return '#2EE89A';   // C.green
    case 'TAMPERED':   return '#FF4D4D';   // C.red
    case 'UNVERIFIED': return '#FF9B2F';   // C.orange
  }
}

export function integrityStatusLabel(status: IntegrityStatus): string {
  switch (status) {
    case 'VERIFIED':   return '✓ VERIFIED';
    case 'TAMPERED':   return '⚠ TAMPERED';
    case 'UNVERIFIED': return '? UNVERIFIED';
  }
}

export function integrityStatusIcon(status: IntegrityStatus): string {
  switch (status) {
    case 'VERIFIED':   return '🛡️';
    case 'TAMPERED':   return '⚠️';
    case 'UNVERIFIED': return '❓';
  }
}