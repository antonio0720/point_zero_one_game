// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API LAYER TYPES
// pzo_engine/src/api/types.ts
//
// Transport contracts for all API request/response payloads.
// These are NOT game types — they are HTTP boundary types only.
//
// Ground truth for game types:
//   pzo_engine/src/persistence/types.ts         → RunOutcome, RunGrade, etc.
//   pzo_engine/src/persistence/run-store.ts     → RunStore, LeaderboardOptions
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  RunOutcome,
  RunGrade,
  IntegrityStatus,
  RunAccumulatorStats,
  RunIdentity,
} from '../persistence/types';

// =============================================================================
// SECTION 1 — SHARED RESPONSE ENVELOPE
// =============================================================================

export interface ApiSuccess<T> {
  ok:   true;
  data: T;
  ts:   number;  // Unix ms — when the response was built
}

export interface ApiError {
  ok:      false;
  error:   string;
  code:    ApiErrorCode;
  ts:      number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'INTEGRITY_VIOLATION'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// =============================================================================
// SECTION 2 — POST /runs — Submit a completed run
// =============================================================================

export interface SubmitRunRequest {
  accumulator: RunAccumulatorStats;
  identity:    RunIdentity;
}

export interface SubmitRunResponse {
  runId:           string;
  proofHash:       string;
  auditHash:       string;
  grade:           RunGrade;
  sovereigntyScore: number;
  integrityStatus: IntegrityStatus;
  outcome:         RunOutcome;
  finalNetWorth:   number;
  completedAt:     number;
}

// =============================================================================
// SECTION 3 — GET /runs/:id — Fetch a single run
// =============================================================================

export interface GetRunResponse {
  runId:           string;
  userId:          string;
  proofHash:       string;
  auditHash:       string;
  grade:           RunGrade;
  outcome:         RunOutcome;
  sovereigntyScore: number;
  integrityStatus: IntegrityStatus;
  finalNetWorth:   number;
  ticksSurvived:   number;
  completedAt:     number;
  seed:            string;
  mode:            string;
  clientVersion:   string;
  engineVersion:   string;
}

// =============================================================================
// SECTION 4 — GET /leaderboard — Ranked run list
// =============================================================================

export interface LeaderboardQuery {
  limit?:    string;   // query string — parsed to number (default 10, max 100)
  outcome?:  RunOutcome;
  minGrade?: RunGrade;
  userId?:   string;
  mode?:     string;
}

export interface LeaderboardEntry {
  rank:            number;
  runId:           string;
  userId:          string;
  grade:           RunGrade;
  outcome:         RunOutcome;
  sovereigntyScore: number;
  integrityStatus: IntegrityStatus;
  finalNetWorth:   number;
  ticksSurvived:   number;
  completedAt:     number;
  proofHash:       string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total:   number;
  limit:   number;
  filters: {
    outcome?:  RunOutcome;
    minGrade?: RunGrade;
    userId?:   string;
    mode?:     string;
  };
}

// =============================================================================
// SECTION 5 — GET /runs/:id/replay — Integrity re-verification
// =============================================================================

export interface ReplayVerificationResponse {
  runId:             string;
  seed:              string;
  tickCount:         number;
  integrityMatch:    boolean;
  firstDivergenceAt: number | null;
  replayedProofHash: string;
  storedProofHash:   string;
  proofHashMatch:    boolean;
  verifiedAt:        number;
}

// =============================================================================
// SECTION 6 — GET /runs/:id/proof — Proof artifact retrieval
// =============================================================================

export interface ProofArtifactResponse {
  runId:            string;
  proofHash:        string;
  grade:            RunGrade;
  sovereigntyScore: number;
  badgeTier:        string;
  playerHandle:     string;
  outcome:          RunOutcome;
  ticksSurvived:    number;
  finalNetWorth:    number;
  generatedAt:      number;
  format:           'PDF' | 'PNG';
  exportUrl?:       string;
}

// =============================================================================
// SECTION 7 — GET /catalog — Card catalog snapshot
// =============================================================================

export interface CatalogStatsResponse {
  totalCards:     number;
  byDeck:         Record<string, number>;
  version:        string;
  generatedAt:    string;
}

// =============================================================================
// SECTION 8 — GET /health — Service health
// =============================================================================

export interface HealthResponse {
  status:            'ok' | 'degraded' | 'down';
  uptime:            number;     // process uptime in seconds
  totalRunsSaved:    number;
  totalRunsFailed:   number;
  retryQueueDepth:   number;
  serverConnected:   boolean;
  lastSaveAt:        number | null;
  lastFailureAt:     number | null;
  lastFailureReason: string | null;
  mlEnabled:         boolean;
  auditEnabled:      boolean;
  version:           string;
  engineVersion:     string;
}

// =============================================================================
// SECTION 9 — GET /runs/user/:userId — All runs for a user
// =============================================================================

export interface UserRunsResponse {
  userId:  string;
  runs:    GetRunResponse[];
  total:   number;
}