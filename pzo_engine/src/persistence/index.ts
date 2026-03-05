// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE PERSISTENCE LAYER
// pzo_engine/src/persistence/index.ts
//
// Barrel export — one import to access the full persistence layer.
//
// Usage:
//   import {
//     getRunStore, getCordStore, getSeasonStore,
//     getRunEvents, getDemoRunAdapter, getDemoReplayReader,
//     getDb, closeDb,
//   } from '../persistence';
//
// Density6 LLC · Point Zero One · Persistence Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

// ── DB connection ─────────────────────────────────────────────────────────────
export { getDb, closeDb, setDbPath, getDbPath, resetDbForTesting } from './db';

// ── Schema ────────────────────────────────────────────────────────────────────
export { applyMigrations, getSchemaVersion } from './schema';

// ── ML store (models + observations + feedback) ───────────────────────────────
export * from './ml-store';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  RunOutcome,
  RunGrade,
  IntegrityStatus,
  ArtifactFormat,
  BadgeTier,
  GameMode,
  RunPhase,
  MarketRegime,
  ViralMomentType,
  DecisionRecord,
  TickSnapshot,
  ShieldLayerSnapshot,
  ViralMomentRecord,
  SeasonStateSnapshot,
  IntelligenceSnapshot,
  EmpireRunStats,
  PredatorRunStats,
  SyndicateRunStats,
  PhantomRunStats,
  ModeSpecificStats,
  CORDScore,
  RunAccumulatorStats,
  SovereigntyScoreComponents,
  SovereigntyScore,
  RunSignature,
  RunIdentity,
  GradeReward,
  ProofArtifact,
  RunCompletedPayload,
  ProofVerificationFailedPayload,
  ProofArtifactReadyPayload,
  RunRewardDispatchedPayload,
} from './types';

export {
  SOVEREIGNTY_WEIGHTS,
  OUTCOME_MULTIPLIERS,
  GRADE_THRESHOLDS,
  CORD_GRADE_THRESHOLDS,
} from './types';

// ── Run record ────────────────────────────────────────────────────────────────
export type { Run } from './run';
export { createRunRecord, serializeRun, deserializeRunFromRow } from './run';

// ── Run store ─────────────────────────────────────────────────────────────────
export type {
  LeaderboardOptions,
  RunStoreHealth,
  ReplayResult,
} from './run-store';
export { RunStore, getRunStore, _resetRunStoreForTesting } from './run-store';

// ── Proof hash ────────────────────────────────────────────────────────────────
export type { ProofHashConfig } from './proof-hash';
export { ProofHash, resolveProofHashConfig } from './proof-hash';

// ── Audit hash ────────────────────────────────────────────────────────────────
export type { AuditHashConfig, AuditHashInput } from './audit-hash';
export { AuditHash, resolveAuditHashConfig, buildAuditHashInput } from './audit-hash';

// ── Run events ────────────────────────────────────────────────────────────────
export type { Event as RunEvent, LedgerFilter, WriteResult } from './run-events';
export { RunEvents, getRunEvents } from './run-events';

// ── CORD store ────────────────────────────────────────────────────────────────
export type {
  CORDLeaderboardEntry,
  UserCORDSummary,
  CORDLeaderboardOptions,
} from './cord-store';
export { CordStore, getCordStore } from './cord-store';

// ── Season store ──────────────────────────────────────────────────────────────
export type {
  SeasonProgressEntry,
  UserSeasonSummary,
} from './season-store';
export { SeasonStore, getSeasonStore } from './season-store';

// ── Demo run ──────────────────────────────────────────────────────────────────
export type {
  DemoIndexEntry,
  DemoTickFrame,
} from './demo-run';
export {
  createDemoAccumulator,
  DemoRunAdapter,
  DemoReplayReader,
  getDemoRunAdapter,
  getDemoReplayReader,
} from './demo-run';