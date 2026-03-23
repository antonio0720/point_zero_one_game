/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT REWARDS BARREL INDEX
 * FILE: backend/src/game/engine/chat/rewards/index.ts
 * VERSION: 2026.03.23-rewards-index.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative public entry surface for the backend chat rewards subsystem.
 * This barrel is the canonical import boundary for all consumers of the rewards
 * lane — `chat/index.ts`, server handlers, post-run pipelines, and test suites.
 *
 * Rewards subsystem owns:
 * - When a legend moment is authoritative and what prestige lifecycle it carries
 * - How replay artifacts are cross-indexed against legend moments
 * - How legend records are converted into authoritative reward grants
 * - Cooldown law, deduplication, inventory snapshots, and grant journaling
 *
 * Three subsystems compose this lane:
 *
 *   LegendMomentLedger
 *   ──────────────────
 *   Authoritative backend prestige memory. Admits legend events, manages
 *   provisional/confirmed/granted lifecycle, tracks room prestige state,
 *   links replay artifacts and proof chains, and stages reward queues.
 *   Profiles (STANDARD, COMPACT, CINEMATIC, FORENSIC, HIGH_VOLUME) tune
 *   retention windows and index density.
 *   Produces LegendMomentRecord, LegendMomentLedgerSnapshot, room prestige.
 *
 *   ReplayMomentIndexer
 *   ───────────────────
 *   Cross-index authority binding replay artifacts to prestige moments.
 *   Resolves primary/secondary/anchor/sequence replay relationships, builds
 *   transport bundles, audits coverage, and supports density/heat analysis.
 *   Profiles (STANDARD, CINEMATIC, FORENSIC, MINIMAL, DENSE) tune index limits.
 *   Produces ReplayMomentIndexRecord, transport bundles, coverage reports.
 *
 *   RewardGrantResolver
 *   ───────────────────
 *   Backend law for reward candidate extraction, eligibility, deduplication,
 *   cooldown enforcement, cap management, grant journaling, and revocation.
 *   Profiles (BALANCED, CONSERVATIVE, AGGRESSIVE, PRESTIGE_FIRST, MINIMAL)
 *   tune threshold and cooldown parameters.
 *   Produces RewardGrantRecord, RewardGrantResolution, inventory snapshots.
 *
 * Module objects
 * ──────────────
 * - ChatLegendMomentLedgerModule      — ledger bundle (re-exported from ledger file)
 * - ChatReplayMomentIndexerModule     — indexer bundle (re-exported from indexer file)
 * - ChatRewardGrantResolverModule     — resolver bundle (re-exported from resolver file)
 * - ChatRewardsModule                 — combined bundle (defined in this barrel)
 * ============================================================================
 */

// ============================================================================
// MARK: Full passthrough re-exports
// ============================================================================

export * from './LegendMomentLedger';
export * from './ReplayMomentIndexer';
export * from './RewardGrantResolver';

// ============================================================================
// MARK: Namespace imports for combined module bundle
// ============================================================================

import * as LegendMomentLedgerNS from './LegendMomentLedger';
import * as ReplayMomentIndexerNS from './ReplayMomentIndexer';
import * as RewardGrantResolverNS from './RewardGrantResolver';

// ============================================================================
// MARK: Combined barrel module object
// ============================================================================

/**
 * Combined namespace object exposing all three rewards subsystems
 * under a single import handle:
 *
 *   import { ChatRewardsModule } from './rewards';
 *   ChatRewardsModule.ledger.createCinematic();
 *   ChatRewardsModule.indexer.createForensic();
 *   ChatRewardsModule.resolver.createPrestigeFirst();
 */
export const ChatRewardsModule = Object.freeze({
  ledger: LegendMomentLedgerNS.ChatLegendMomentLedgerModule,
  ledgerProfiles: LegendMomentLedgerNS.ChatLegendMomentLedgerProfileModule,
  indexer: ReplayMomentIndexerNS.ChatReplayMomentIndexerModule,
  indexerProfiles: ReplayMomentIndexerNS.ChatReplayMomentIndexerProfileModule,
  resolver: RewardGrantResolverNS.ChatRewardGrantResolverModule,
  resolverProfiles: RewardGrantResolverNS.ChatRewardGrantResolverProfileModule,
} as const);
