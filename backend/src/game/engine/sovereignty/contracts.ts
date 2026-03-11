/* ========================================================================
 * POINT ZERO ONE — BACKEND SOVEREIGNTY CONTRACTS
 * /backend/src/game/engine/sovereignty/contracts.ts
 *
 * Doctrine:
 * - sovereignty contracts are the canonical bridge between raw backend
 *   simulation snapshots and all persistence/export surfaces
 * - contracts must be deterministic, serialization-safe, and DB-agnostic
 * - adapters may enrich; they must never mutate source snapshots
 * - persistence targets are injected, never hard-coded
 * ====================================================================== */

import type { RunStateSnapshot } from '../core/RunStateSnapshot';

export const SOVEREIGNTY_CONTRACT_VERSION = 'sovereignty-contract.v1' as const;
export const SOVEREIGNTY_PERSISTENCE_VERSION = 'sovereignty-persistence.v1' as const;
export const SOVEREIGNTY_EXPORT_VERSION = 'sovereignty-export.v1' as const;

export const DEFAULT_SOVEREIGNTY_CLIENT_VERSION = 'server-authoritative' as const;
export const DEFAULT_SOVEREIGNTY_ENGINE_VERSION = 'backend-sovereignty-v1' as const;

export type SovereigntyArtifactFormat = 'JSON' | 'PDF' | 'PNG';
export type SovereigntyGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type SovereigntyBadgeTier = 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';
export type SovereigntyIntegrityStatus =
  | RunStateSnapshot['sovereignty']['integrityStatus']
  | 'TAMPERED'
  | 'UNVERIFIED';

export interface SovereigntyAdapterContext {
  readonly startedAtMs?: number;
  readonly completedAtMs?: number;
  readonly clientVersion?: string;
  readonly engineVersion?: string;
  readonly playerHandle?: string;
  readonly seasonTickBudget?: number;
  readonly artifactBaseUrl?: string;
  readonly artifactFormat?: SovereigntyArtifactFormat;
  readonly extraTags?: readonly string[];
}

export interface SovereigntyDecisionSample {
  readonly tick: number;
  readonly actorId: string;
  readonly cardId: string;
  readonly latencyMs: number;
  readonly accepted: boolean;
  readonly timingClass: readonly string[];
  readonly normalizedSpeedScore: number;
}

export interface SovereigntyTickRecord {
  readonly contractVersion: typeof SOVEREIGNTY_CONTRACT_VERSION;
  readonly recordId: string;
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly phase: RunStateSnapshot['phase'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly tickIndex: number;
  readonly pressureScore: number;
  readonly pressureTier: RunStateSnapshot['pressure']['tier'];
  readonly pressureBand: RunStateSnapshot['pressure']['band'];
  readonly shieldAvgIntegrityPct: number;
  readonly shieldWeakestIntegrityPct: number;
  readonly netWorth: number;
  readonly haterHeat: number;
  readonly activeCascadeChains: number;
  readonly haterAttemptsThisTick: number;
  readonly haterBlockedThisTick: number;
  readonly haterDamagedThisTick: number;
  readonly cascadesTriggeredThisTick: number;
  readonly cascadesBrokenThisTick: number;
  readonly decisionsThisTick: number;
  readonly acceptedDecisionsThisTick: number;
  readonly decisionSamples: readonly SovereigntyDecisionSample[];
  readonly pendingThreats: number;
  readonly proofHash: string | null;
  readonly tickChecksum: string;
  readonly stateChecksum: string;
  readonly tickStreamPosition: number;
  readonly capturedAtMs: number;
}

export interface SovereigntyScoreBreakdown {
  readonly decisionSpeedScore: number;
  readonly shieldsMaintainedPct: number;
  readonly haterBlockRate: number;
  readonly cascadeBreakRate: number;
  readonly pressureSurvivalScore: number;
  readonly weightedDecisionSpeed: number;
  readonly weightedShieldsMaintained: number;
  readonly weightedHaterBlocks: number;
  readonly weightedCascadeBreaks: number;
  readonly weightedPressureSurvival: number;
  readonly rawScore: number;
  readonly outcomeMultiplier: number;
  readonly finalScore: number;
  readonly computedGrade: SovereigntyGrade;
}

export interface SovereigntyRunSummary {
  readonly contractVersion: typeof SOVEREIGNTY_CONTRACT_VERSION;
  readonly runId: string;
  readonly userId: string;
  readonly seed: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly tags: readonly string[];
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly durationMs: number;
  readonly clientVersion: string;
  readonly engineVersion: string;
  readonly ticksSurvived: number;
  readonly seasonTickBudget: number;
  readonly finalNetWorth: number;
  readonly haterHeatAtEnd: number;
  readonly shieldIntegralSum: number;
  readonly shieldSampleCount: number;
  readonly shieldAverageIntegrityPct: number;
  readonly totalHaterAttempts: number;
  readonly totalHaterBlocked: number;
  readonly totalHaterDamaged: number;
  readonly haterBlockRate: number;
  readonly totalCascadeChainsTriggered: number;
  readonly totalCascadeChainsBroken: number;
  readonly cascadeBreakRate: number;
  readonly activeCascadeChainsAtEnd: number;
  readonly decisionCount: number;
  readonly acceptedDecisionCount: number;
  readonly averageDecisionLatencyMs: number;
  readonly decisionSpeedScore: number;
  readonly pressureScoreAtEnd: number;
  readonly maxPressureScoreSeen: number;
  readonly highPressureTicksSurvived: number;
  readonly tickStreamChecksum: string;
  readonly proofHash: string;
  readonly integrityStatus: SovereigntyIntegrityStatus;
  readonly sovereigntyScore: number;
  readonly verifiedGrade: SovereigntyGrade;
  readonly badgeTier: SovereigntyBadgeTier;
  readonly proofBadges: readonly string[];
  readonly gapVsLegend: number;
  readonly gapClosingRate: number;
  readonly cordScore: number;
  readonly auditFlags: readonly string[];
  readonly scoreBreakdown: SovereigntyScoreBreakdown;
}

export interface SovereigntyProofCard {
  readonly contractVersion: typeof SOVEREIGNTY_EXPORT_VERSION;
  readonly runId: string;
  readonly proofHash: string;
  readonly playerHandle: string;
  readonly mode: RunStateSnapshot['mode'];
  readonly outcome: RunStateSnapshot['outcome'];
  readonly integrityStatus: SovereigntyIntegrityStatus;
  readonly grade: SovereigntyGrade;
  readonly badgeTier: SovereigntyBadgeTier;
  readonly sovereigntyScore: number;
  readonly ticksSurvived: number;
  readonly finalNetWorth: number;
  readonly shieldAverageIntegrityPct: number;
  readonly haterBlockRate: number;
  readonly cascadeBreakRate: number;
  readonly decisionSpeedScore: number;
  readonly proofBadges: readonly string[];
  readonly generatedAtMs: number;
}

export interface SovereigntyExportArtifact {
  readonly contractVersion: typeof SOVEREIGNTY_EXPORT_VERSION;
  readonly artifactId: string;
  readonly runId: string;
  readonly proofHash: string;
  readonly format: SovereigntyArtifactFormat;
  readonly mimeType: string;
  readonly fileName: string;
  readonly exportUrl?: string;
  readonly badgeTier: SovereigntyBadgeTier;
  readonly generatedAtMs: number;
  readonly checksum: string;
  readonly summary: SovereigntyProofCard;
  readonly payload: Readonly<{
    readonly run: SovereigntyRunSummary;
    readonly tickTimeline: readonly SovereigntyTickRecord[];
    readonly generatedAtMs: number;
    readonly format: SovereigntyArtifactFormat;
  }>;
}

export interface SovereigntyTickWriteRecord {
  readonly contractVersion: typeof SOVEREIGNTY_PERSISTENCE_VERSION;
  readonly persistenceId: string;
  readonly runId: string;
  readonly tickIndex: number;
  readonly createdAtMs: number;
  readonly payload: SovereigntyTickRecord;
}

export interface SovereigntyRunWriteRecord {
  readonly contractVersion: typeof SOVEREIGNTY_PERSISTENCE_VERSION;
  readonly persistenceId: string;
  readonly runId: string;
  readonly createdAtMs: number;
  readonly payload: SovereigntyRunSummary;
}

export interface SovereigntyArtifactWriteRecord {
  readonly contractVersion: typeof SOVEREIGNTY_PERSISTENCE_VERSION;
  readonly persistenceId: string;
  readonly runId: string;
  readonly createdAtMs: number;
  readonly payload: SovereigntyExportArtifact;
}

export interface SovereigntyAuditWriteRecord {
  readonly contractVersion: typeof SOVEREIGNTY_PERSISTENCE_VERSION;
  readonly persistenceId: string;
  readonly runId: string;
  readonly createdAtMs: number;
  readonly payload: Readonly<{
    readonly proofHash: string;
    readonly integrityStatus: SovereigntyIntegrityStatus;
    readonly grade: SovereigntyGrade;
    readonly score: number;
    readonly tickStreamChecksum: string;
    readonly tickCount: number;
    readonly artifactId: string;
  }>;
}

export interface SovereigntyPersistenceEnvelope {
  readonly summary: SovereigntyRunSummary;
  readonly ticks: readonly SovereigntyTickWriteRecord[];
  readonly run: SovereigntyRunWriteRecord;
  readonly artifact: SovereigntyArtifactWriteRecord;
  readonly audit: SovereigntyAuditWriteRecord;
}

export interface SovereigntyTickRepository {
  append(record: SovereigntyTickWriteRecord): Promise<void> | void;
  appendMany?(records: readonly SovereigntyTickWriteRecord[]): Promise<void> | void;
}

export interface SovereigntyRunRepository {
  upsert(record: SovereigntyRunWriteRecord): Promise<void> | void;
}

export interface SovereigntyArtifactRepository {
  upsert(record: SovereigntyArtifactWriteRecord): Promise<void> | void;
}

export interface SovereigntyAuditRepository {
  append(record: SovereigntyAuditWriteRecord): Promise<void> | void;
}

export interface SovereigntyPersistenceTarget {
  readonly tickRepository?: SovereigntyTickRepository;
  readonly runRepository?: SovereigntyRunRepository;
  readonly artifactRepository?: SovereigntyArtifactRepository;
  readonly auditRepository?: SovereigntyAuditRepository;
}

export function badgeTierForGrade(grade: SovereigntyGrade): SovereigntyBadgeTier {
  switch (grade) {
    case 'S':
      return 'PLATINUM';
    case 'A':
      return 'GOLD';
    case 'B':
      return 'SILVER';
    case 'C':
      return 'BRONZE';
    case 'D':
    case 'F':
    default:
      return 'IRON';
  }
}

export function normalizeGrade(grade: string | null | undefined): SovereigntyGrade {
  switch (grade) {
    case 'S':
    case 'A':
    case 'B':
    case 'C':
    case 'D':
    case 'F':
      return grade;
    default:
      return 'F';
  }
}

export function normalizeIntegrityStatus(
  value: string | null | undefined,
): SovereigntyIntegrityStatus {
  switch (value) {
    case 'VERIFIED':
    case 'QUARANTINED':
    case 'TAMPERED':
    case 'UNVERIFIED':
      return value;
    default:
      return 'UNVERIFIED';
  }
}

export function artifactExtensionForFormat(format: SovereigntyArtifactFormat): string {
  switch (format) {
    case 'PDF':
      return 'pdf';
    case 'PNG':
      return 'png';
    case 'JSON':
    default:
      return 'json';
  }
}

export function artifactMimeTypeForFormat(format: SovereigntyArtifactFormat): string {
  switch (format) {
    case 'PDF':
      return 'application/pdf';
    case 'PNG':
      return 'image/png';
    case 'JSON':
    default:
      return 'application/json';
  }
}