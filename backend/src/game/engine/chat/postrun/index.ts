/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT POST-RUN BARREL INDEX
 * FILE: backend/src/game/engine/chat/postrun/index.ts
 * VERSION: 2026.03.23-postrun-index.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative public entry surface for the backend chat post-run ritual
 * subsystem. This barrel is the canonical import boundary for all consumers
 * of the post-run lane — `chat/index.ts`, server handlers, and test suites.
 *
 * Post-run ritual owns:
 * - What kind of closure rite this room receives
 * - Which turning point owns the narrative interpretation of the run
 * - How blame, directive, and foreshadow are shaped
 * - Which witness lines survive into the authoritative plan
 * - Which beats are visible, shadow, replayable, or archivable
 * - What summary/archive/ledger bundle downstream transport uses
 * - Whether the run is eligible for legend escalation, world echo, or replay
 *
 * Three subsystems compose this lane:
 *
 *   PostRunNarrativeEngine
 *   ──────────────────────
 *   Top-level authority. Composes the full post-run evaluation by wiring the
 *   turning point resolver and foreshadow planner. Produces the canonical
 *   PostRunNarrativeEvaluation containing plan, archive entry, digest, ledger
 *   entry, runtime state, and structured reasoning.
 *
 *   Engine profiles (CINEMATIC, DEBRIEF, COLD_CLOSE, GRIEF,
 *   SOVEREIGN_CEREMONY, LEGEND_CEREMONY, RAPID) tune delays, witness
 *   composition, beat selection, and emotional stances.
 *
 *   TurningPointResolver
 *   ─────────────────────
 *   Ranks and selects the canonical turning point from a set of candidates.
 *   Weight profiles (DEFAULT, NARRATIVE, COMBAT, EMOTIONAL, SOCIAL, ECONOMIC,
 *   LEGEND) tune the scoring surface. Supports diagnostics, audit, diff,
 *   stats, serialization, and batch resolution.
 *
 *   ForeshadowPlanner
 *   ──────────────────
 *   Plans foreshadow seeds and next-run directives from post-run evidence,
 *   blame vectors, and moments. Profiles (BALANCED, CONSERVATIVE, AGGRESSIVE,
 *   LEGEND_ORIENTED, WORLD_ECHO_PRIORITY, SHADOW_ONLY) tune foreshadow
 *   density and kind priority. Produces witness seeds for the narrative engine.
 *
 * Module objects
 * ──────────────
 * - ChatPostRunNarrativeEngineModule  — engine bundle (re-exported from engine file)
 * - ChatTurningPointResolverModule    — resolver bundle (re-exported from resolver file)
 * - ChatForeshadowPlannerModule       — planner bundle (re-exported from planner file)
 * - ChatPostRunModule                 — combined bundle (defined in this barrel)
 * ============================================================================
 */

// ============================================================================
// MARK: Full passthrough re-exports
// ============================================================================

export * from './PostRunNarrativeEngine';
export * from './TurningPointResolver';
export * from './ForeshadowPlanner';

// ============================================================================
// MARK: Namespace imports for combined module bundle
// ============================================================================

import * as NarrativeEngineNS from './PostRunNarrativeEngine';
import * as TurningPointResolverNS from './TurningPointResolver';
import * as ForeshadowPlannerNS from './ForeshadowPlanner';

// ============================================================================
// MARK: Combined barrel module object
// ============================================================================

/**
 * Combined namespace object exposing all three post-run subsystems
 * under a single import handle:
 *
 *   import { ChatPostRunModule } from './postrun';
 *   ChatPostRunModule.engine.create();
 *   ChatPostRunModule.turningPoint.createNarrative();
 *   ChatPostRunModule.foreshadow.createAggressive();
 */
export const ChatPostRunModule = Object.freeze({
  engine: NarrativeEngineNS.ChatPostRunNarrativeEngineModule,
  turningPoint: TurningPointResolverNS.ChatTurningPointResolverModule,
  foreshadow: ForeshadowPlannerNS.ChatForeshadowPlannerModule,
} as const);
