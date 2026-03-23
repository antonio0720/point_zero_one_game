/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT SOCIAL AUTHORITY BARREL
 * FILE: backend/src/game/engine/chat/social/index.ts
 * VERSION: 2026.03.23-social-barrel.v1
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative export surface for the chat social pressure lane.
 * This barrel bundles four distinct social subsystems into a single coherent
 * authority module that the rest of the backend imports as ChatSocialModule.
 *
 * Subsystems
 * ----------
 * 1. AudienceHeatLedger   — tracks per-channel heat, witness pressure, and
 *                            audience decay across the run lifecycle.
 * 2. ReputationResolver   — resolves actor reputation from event history and
 *                            applies cross-channel reputation propagation rules.
 * 3. CrowdSynthesisEngine — synthesises crowd reaction candidates from heat
 *                            and reputation state, producing authored crowd
 *                            behavior sequences for the run.
 * 4. SwarmReactionPlanner — plans swarm pressure waves from crowd inputs,
 *                            driving escalation, aftershock, and decay steps.
 *
 * Design doctrine
 * ---------------
 * - No UI ownership. No socket ownership. Backend authority only.
 * - All four subsystems are independently importable and composable.
 * - AudienceHeatLedger and ReputationResolver share internal Json* primitives;
 *   to avoid flat-export conflicts they are exposed as namespaces only.
 * - CrowdSynthesisEngine and SwarmReactionPlanner are also flat-exported so
 *   their types and functions are accessible at the social barrel surface.
 * - ChatSocialModule provides the single frozen authority object used by
 *   chat/index.ts to expose the social lane to the rest of the backend.
 * ============================================================================
 */

// ============================================================================
// MARK: Namespace imports — all four subsystems
// ============================================================================

import * as AudienceHeatLedger from './AudienceHeatLedger';
import * as ReputationResolver from './ReputationResolver';
import * as CrowdSynthesisEngine from './CrowdSynthesisEngine';
import * as SwarmReactionPlanner from './SwarmReactionPlanner';

// ============================================================================
// MARK: Flat re-exports — CrowdSynthesisEngine (no name conflicts)
// ============================================================================

export * from './CrowdSynthesisEngine';

// ============================================================================
// MARK: Flat re-exports — SwarmReactionPlanner (no name conflicts)
// ============================================================================

export * from './SwarmReactionPlanner';

// ============================================================================
// MARK: Namespace re-exports
// AudienceHeatLedger and ReputationResolver share JsonPrimitive / JsonValue /
// JsonObject / filterEntriesByReason — exported as namespaces only to avoid
// ambiguous re-export errors.
// ============================================================================

export { AudienceHeatLedger, ReputationResolver, CrowdSynthesisEngine, SwarmReactionPlanner };

// ============================================================================
// MARK: Convenience class surface
// ============================================================================

/** The heat tracking authority for a single run's channels. */
export const AudienceHeatLedgerClass = AudienceHeatLedger.AudienceHeatLedger;

/** Resolves actor reputation from run history and propagates cross-channel. */
export const ReputationResolverClass = ReputationResolver.ReputationResolver;

/** Synthesises authored crowd reaction candidates from heat + reputation. */
export const CrowdSynthesisEngineClass = CrowdSynthesisEngine.CrowdSynthesisEngine;

/** Plans swarm pressure wave steps from crowd synthesis inputs. */
export const SwarmReactionPlannerClass = SwarmReactionPlanner.SwarmReactionPlanner;

// ============================================================================
// MARK: Convenience factory surface
// ============================================================================

export const createAudienceHeatLedger = AudienceHeatLedger.createAudienceHeatLedger;
export const createReputationResolver = ReputationResolver.createReputationResolver;
export const createCrowdSynthesisEngine = CrowdSynthesisEngine.createCrowdSynthesisEngine;
export const createSwarmReactionPlanner = SwarmReactionPlanner.createSwarmReactionPlanner;

// ============================================================================
// MARK: Social barrel version
// ============================================================================

export const CHAT_SOCIAL_BARREL_VERSION = '2026.03.23-social-barrel.v1' as const;
export const CHAT_SOCIAL_AUTHORITY = 'BACKEND' as const;

export interface ChatSocialBarrelMeta {
  readonly version: typeof CHAT_SOCIAL_BARREL_VERSION;
  readonly authority: typeof CHAT_SOCIAL_AUTHORITY;
  readonly subsystems: readonly ['AudienceHeatLedger', 'ReputationResolver', 'CrowdSynthesisEngine', 'SwarmReactionPlanner'];
}

export const CHAT_SOCIAL_BARREL_META: ChatSocialBarrelMeta = Object.freeze({
  version: CHAT_SOCIAL_BARREL_VERSION,
  authority: CHAT_SOCIAL_AUTHORITY,
  subsystems: ['AudienceHeatLedger', 'ReputationResolver', 'CrowdSynthesisEngine', 'SwarmReactionPlanner'] as const,
});

// ============================================================================
// MARK: ChatSocialModule — unified frozen authority object
// Consumed by chat/index.ts as the ChatSocialModule lane export.
// ============================================================================

export const ChatSocialModule = Object.freeze({
  /** Version string for the social barrel surface. */
  version: CHAT_SOCIAL_BARREL_VERSION,

  /** AudienceHeatLedger namespace — heat tracking, witness pressure, decay. */
  AudienceHeatLedger,

  /** ReputationResolver namespace — actor rep, cross-channel propagation. */
  ReputationResolver,

  /** CrowdSynthesisEngine namespace — authored crowd reaction synthesis. */
  CrowdSynthesisEngine,

  /** SwarmReactionPlanner namespace — swarm pressure wave planning. */
  SwarmReactionPlanner,

  // Convenience class references
  AudienceHeatLedgerClass,
  ReputationResolverClass,
  CrowdSynthesisEngineClass,
  SwarmReactionPlannerClass,

  // Convenience factory references
  createAudienceHeatLedger,
  createReputationResolver,
  createCrowdSynthesisEngine,
  createSwarmReactionPlanner,

  // Sub-module authority bundles (each file's own frozen module object)
  CrowdSynthesisEngineModule: CrowdSynthesisEngine.ChatCrowdSynthesisEngineModule,
  CrowdSynthesisEngineProfileModule: CrowdSynthesisEngine.ChatCrowdSynthesisEngineProfileModule,
  SwarmPlannerModule: SwarmReactionPlanner.ChatSwarmReactionPlannerModule,
  SwarmPlannerProfileModule: SwarmReactionPlanner.ChatSwarmReactionPlannerProfileModule,

  // Barrel meta
  meta: CHAT_SOCIAL_BARREL_META,
});
