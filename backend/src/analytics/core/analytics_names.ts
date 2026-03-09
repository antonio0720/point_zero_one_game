// backend/src/analytics/core/analytics_names.ts

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * POINT ZERO ONE — ANALYTICS CORE / CANONICAL NAMES
 * backend/src/analytics/core/analytics_names.ts
 *
 * Centralized wire-level analytics names, enums, and canonical allowlists.
 *
 * Why this file exists:
 * - removes namespace collisions (example: PROOF_STAMPED in multiple domains)
 * - standardizes event names for outbox, queues, logs, and warehousing
 * - gives runtime validation a single source of truth
 * - keeps analytics contracts aligned to Score-150 backend doctrine
 *
 * Rules:
 * - event names are lowercase dotted namespaces
 * - enums are uppercase snake-case where they mirror backend/domain contracts
 * - anything emitted off-box should come from this file, never ad hoc strings
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export const ANALYTICS_SCHEMA_VERSION = 1 as const;

// ─────────────────────────────────────────────────────────────────────────────
// Utility types
// ─────────────────────────────────────────────────────────────────────────────

type ValueOf<T> = T[keyof T];

// ─────────────────────────────────────────────────────────────────────────────
// Canonical runtime enums
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYTICS_SOURCES = {
  WEB: 'web',
  IOS: 'ios',
  ANDROID: 'android',
  BACKEND: 'backend',
  WORKER: 'worker',
  CRON: 'cron',
  UNKNOWN: 'unknown',
} as const;

export type AnalyticsSource = ValueOf<typeof ANALYTICS_SOURCES>;

export const GAME_MODES = {
  GO_ALONE: 'GO_ALONE',
  HEAD_TO_HEAD: 'HEAD_TO_HEAD',
  TEAM_UP: 'TEAM_UP',
  CHASE_A_LEGEND: 'CHASE_A_LEGEND',
} as const;

export type GameMode = ValueOf<typeof GAME_MODES>;

export const RUN_PHASES = {
  FOUNDATION: 'FOUNDATION',
  ESCALATION: 'ESCALATION',
  SOVEREIGNTY: 'SOVEREIGNTY',
} as const;

export type RunPhase = ValueOf<typeof RUN_PHASES>;

export const RUN_OUTCOMES = {
  FREEDOM: 'FREEDOM',
  TIMEOUT: 'TIMEOUT',
  BANKRUPT: 'BANKRUPT',
  ELIMINATED: 'ELIMINATED',
  ABANDONED: 'ABANDONED',
} as const;

export type RunOutcome = ValueOf<typeof RUN_OUTCOMES>;

export const INTEGRITY_STATUSES = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  QUARANTINED: 'QUARANTINED',
  FAILED: 'FAILED',
} as const;

export type IntegrityStatus = ValueOf<typeof INTEGRITY_STATUSES>;

export const VISIBILITY_SCOPES = {
  PRIVATE: 'PRIVATE',
  UNLISTED: 'UNLISTED',
  PUBLIC: 'PUBLIC',
  VERIFIED_PUBLIC: 'VERIFIED_PUBLIC',
  SEASON_PUBLIC: 'SEASON_PUBLIC',
} as const;

export type VisibilityScope = ValueOf<typeof VISIBILITY_SCOPES>;

export const VERIFIED_GRADES = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  F: 'F',
} as const;

export type VerifiedGrade = ValueOf<typeof VERIFIED_GRADES>;

export const TRUST_SURFACES = {
  AFTER_RUN: 'after_run',
  PROOF_PAGE: 'proof_page',
  SHARE_PAGE: 'share_page',
  EXPLORER: 'explorer',
  SHOWCASE: 'showcase',
  LEADERBOARD: 'leaderboard',
  INTEGRITY_PAGE: 'integrity_page',
  LEGEND_BOARD: 'legend_board',
} as const;

export type TrustSurfaceName = ValueOf<typeof TRUST_SURFACES>;

export const EXPLORER_VIEW_TYPES = {
  ASSET: 'asset',
  PROOF: 'proof',
  RUN: 'run',
  SHOWCASE: 'showcase',
  LEGEND: 'legend',
  CHALLENGER: 'challenger',
} as const;

export type ExplorerViewType = ValueOf<typeof EXPLORER_VIEW_TYPES>;

// ─────────────────────────────────────────────────────────────────────────────
// Namespaced event names
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYTICS_EVENT_NAMES = {
  SEASON0: {
    JOINED: 'season0.joined',
    FOUNDER_TIER_ASSIGNED: 'season0.founder_tier_assigned',
    ARTIFACT_GRANTED: 'season0.artifact_granted',
    MEMBERSHIP_SHARED: 'season0.membership_shared',
    MEMBERSHIP_CARD_VIEWED: 'season0.membership_card_viewed',
    PROOF_CARD_MINTED: 'season0.proof_card_minted',
    PROOF_STAMPED: 'season0.proof_stamped',
    INVITE_SENT: 'season0.invite_sent',
    INVITE_ACCEPTED: 'season0.invite_accepted',
    REFERRAL_COMPLETED: 'season0.referral_completed',
    REFERRAL_REWARD_UNLOCKED: 'season0.referral_reward_unlocked',
    STREAK_UPDATED: 'season0.streak_updated',
    STREAK_GRACE_APPLIED: 'season0.streak_grace_applied',
    ARTIFACT_RECEIPT_ISSUED: 'season0.artifact_receipt_issued',
    FOUNDER_SEAL_EVOLVED: 'season0.founder_seal_evolved',
  },

  TRUST: {
    PROOF_MINTED: 'trust.proof_minted',
    PROOF_SHARED_DRAFT: 'trust.proof_shared_draft',
    PROOF_STAMPED: 'trust.proof_stamped',
    PROOF_SHARED_VERIFIED: 'trust.proof_shared_verified',
    PROOF_CARD_MINTED: 'trust.proof_card_minted',
    VERIFICATION_STATUS_CHANGED: 'trust.verification_status_changed',
    EXPLORER_VIEWED: 'trust.explorer_viewed',
    SHOWCASE_VIEWED: 'trust.showcase_viewed',
    RUN_EXPLORER_SHARED: 'trust.run_explorer_shared',
    RUN_CHALLENGED_FROM_EXPLORER: 'trust.run_challenged_from_explorer',
    LEADERBOARD_ELIGIBILITY_CHANGED: 'trust.leaderboard_eligibility_changed',
  },

  VERIFICATION: {
    QUEUED: 'verification.queued',
    STARTED: 'verification.started',
    PASSED: 'verification.passed',
    QUARANTINED: 'verification.quarantined',
    FAILED: 'verification.failed',
  },

  LEADERBOARDS: {
    LEGEND_SET: 'leaderboards.legend_set',
    CHALLENGER_CREATED: 'leaderboards.challenger_created',
    DYNASTY_ACHIEVED: 'leaderboards.dynasty_achieved',
  },

  SYSTEM: {
    OUTBOX_ENQUEUED: 'system.outbox_enqueued',
    DELIVERY_RETRIED: 'system.delivery_retried',
    DELIVERY_FAILED: 'system.delivery_failed',
  },
} as const;

export type Season0AnalyticsEventName =
  ValueOf<typeof ANALYTICS_EVENT_NAMES.SEASON0>;

export type TrustAnalyticsEventName =
  ValueOf<typeof ANALYTICS_EVENT_NAMES.TRUST>;

export type VerificationAnalyticsEventName =
  ValueOf<typeof ANALYTICS_EVENT_NAMES.VERIFICATION>;

export type LeaderboardAnalyticsEventName =
  ValueOf<typeof ANALYTICS_EVENT_NAMES.LEADERBOARDS>;

export type SystemAnalyticsEventName =
  ValueOf<typeof ANALYTICS_EVENT_NAMES.SYSTEM>;

export type AnalyticsEventName =
  | Season0AnalyticsEventName
  | TrustAnalyticsEventName
  | VerificationAnalyticsEventName
  | LeaderboardAnalyticsEventName
  | SystemAnalyticsEventName;

// ─────────────────────────────────────────────────────────────────────────────
// Flattened lists / sets for fast runtime validation
// ─────────────────────────────────────────────────────────────────────────────

function flattenEventNames<T extends Record<string, Record<string, string>>>(
  value: T,
): string[] {
  return Object.values(value).flatMap((group) => Object.values(group));
}

export const ANALYTICS_EVENT_NAME_LIST = Object.freeze(
  flattenEventNames(ANALYTICS_EVENT_NAMES),
);

export const ANALYTICS_EVENT_NAME_SET: ReadonlySet<string> = new Set(
  ANALYTICS_EVENT_NAME_LIST,
);

export const ANALYTICS_SOURCE_LIST = Object.freeze(
  Object.values(ANALYTICS_SOURCES),
);

export const ANALYTICS_SOURCE_SET: ReadonlySet<string> = new Set(
  ANALYTICS_SOURCE_LIST,
);

export const GAME_MODE_LIST = Object.freeze(Object.values(GAME_MODES));
export const GAME_MODE_SET: ReadonlySet<string> = new Set(GAME_MODE_LIST);

export const RUN_PHASE_LIST = Object.freeze(Object.values(RUN_PHASES));
export const RUN_PHASE_SET: ReadonlySet<string> = new Set(RUN_PHASE_LIST);

export const RUN_OUTCOME_LIST = Object.freeze(Object.values(RUN_OUTCOMES));
export const RUN_OUTCOME_SET: ReadonlySet<string> = new Set(RUN_OUTCOME_LIST);

export const INTEGRITY_STATUS_LIST = Object.freeze(
  Object.values(INTEGRITY_STATUSES),
);
export const INTEGRITY_STATUS_SET: ReadonlySet<string> = new Set(
  INTEGRITY_STATUS_LIST,
);

export const VISIBILITY_SCOPE_LIST = Object.freeze(
  Object.values(VISIBILITY_SCOPES),
);
export const VISIBILITY_SCOPE_SET: ReadonlySet<string> = new Set(
  VISIBILITY_SCOPE_LIST,
);

export const VERIFIED_GRADE_LIST = Object.freeze(
  Object.values(VERIFIED_GRADES),
);
export const VERIFIED_GRADE_SET: ReadonlySet<string> = new Set(
  VERIFIED_GRADE_LIST,
);

export const TRUST_SURFACE_LIST = Object.freeze(Object.values(TRUST_SURFACES));
export const TRUST_SURFACE_SET: ReadonlySet<string> = new Set(
  TRUST_SURFACE_LIST,
);

export const EXPLORER_VIEW_TYPE_LIST = Object.freeze(
  Object.values(EXPLORER_VIEW_TYPES),
);
export const EXPLORER_VIEW_TYPE_SET: ReadonlySet<string> = new Set(
  EXPLORER_VIEW_TYPE_LIST,
);