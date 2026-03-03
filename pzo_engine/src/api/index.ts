// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — API LAYER — BARREL
// pzo_engine/src/api/index.ts
//
// Entry point for the API layer.
// Import server.ts directly to boot the HTTP server.
// Import types from this file for type-safe client code in pzo-web.
//
// Density6 LLC · Point Zero One · API Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  ApiSuccess,
  ApiError,
  ApiResponse,
  ApiErrorCode,
  SubmitRunRequest,
  SubmitRunResponse,
  GetRunResponse,
  LeaderboardQuery,
  LeaderboardEntry,
  LeaderboardResponse,
  ReplayVerificationResponse,
  ProofArtifactResponse,
  CatalogStatsResponse,
  HealthResponse,
  UserRunsResponse,
} from './types';