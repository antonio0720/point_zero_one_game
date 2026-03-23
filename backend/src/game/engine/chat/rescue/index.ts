/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT RESCUE BARREL INDEX
 * FILE: backend/src/game/engine/chat/rescue/index.ts
 * VERSION: 2026.03.23-rescue-index.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative public entry surface for the backend chat rescue subsystem.
 * This barrel is the canonical import boundary for all consumers of the rescue
 * lane — `chat/index.ts`, server handlers, and test suites.
 *
 * Rescue subsystem owns:
 * - When a player is drifting toward disengagement and what urgency band applies
 * - How rescue suppression law is applied based on public/private risk
 * - How rescue windows, recovery plans, and predicted outcomes are orchestrated
 * - How downstream recovery state, reinforcement, relapse, and cohorts are tracked
 *
 * Three subsystems compose this lane:
 *
 *   ChurnRescuePolicy
 *   ─────────────────
 *   Backend law for churn-risk scoring, suppression decisions, urgency/style
 *   selection, helper eligibility, channel strategy, and window timing.
 *   Profiles (BALANCED, HATER_HEAVY, HELPER_PRIORITY, NEGOTIATION_FOCUS,
 *   LIVEOPS_RESPONSIVE, SHADOW_HEAVY) tune threshold and window parameters.
 *   Produces ChurnRescuePolicyDecision with full risk snapshot, rescue plan,
 *   recovery plan, predicted outcome, and reason trail.
 *
 *   RescueInterventionPlanner
 *   ─────────────────────────
 *   Backend rescue orchestration authority. Opens rescue windows, persists
 *   active rescue state, expires stale offers, resolves recovery outcomes.
 *   Profiles (STANDARD, RAPID, PATIENT, CINEMATIC, FORENSIC, MINIMAL) tune
 *   active rescue density and ledger retention.
 *   Produces RescueInterventionPlannerResult with opened/suppressed state,
 *   active intervention, rescue digest, and recovery digest.
 *
 *   RecoveryOutcomeTracker
 *   ──────────────────────
 *   Downstream durability and analytics surface for post-rescue recovery state.
 *   Tracks accepted options, timeout/abandonment, lift vectors, reinforcement
 *   cohorts, and replay-safe ledger projections.
 *   Profiles (STANDARD, CINEMATIC, AGGRESSIVE, PATIENT, ANALYTICS, MINIMAL)
 *   tune retention windows and decay rates.
 *   Produces RecoveryOutcomeTrackerRoomLedger, projections, and summaries.
 *
 * Module objects
 * ──────────────
 * - ChurnRescuePolicyModule          — policy bundle (re-exported from policy file)
 * - RescueInterventionPlannerModule  — planner bundle (re-exported from planner file)
 * - RecoveryOutcomeTrackerModule     — tracker bundle (re-exported from tracker file)
 * - ChatRescueModule                 — combined bundle (defined in this barrel)
 * ============================================================================
 */

// ============================================================================
// MARK: Full passthrough re-exports
// ============================================================================

export * from './ChurnRescuePolicy';
export * from './RescueInterventionPlanner';
export { RecoveryOutcomeTrackerNS };

// ============================================================================
// MARK: Namespace imports for combined module bundle
// ============================================================================

import * as ChurnRescuePolicyNS from './ChurnRescuePolicy';
import * as RescueInterventionPlannerNS from './RescueInterventionPlanner';
import * as RecoveryOutcomeTrackerNS from './RecoveryOutcomeTracker';

// ============================================================================
// MARK: Combined barrel module object
// ============================================================================

/**
 * Combined namespace object exposing all three rescue subsystems
 * under a single import handle:
 *
 *   import { ChatRescueModule } from './rescue';
 *   ChatRescueModule.churnPolicy.createBalanced();
 *   ChatRescueModule.planner.createCinematic();
 *   ChatRescueModule.tracker.createPatient();
 */
export const ChatRescueModule = Object.freeze({
  churnPolicy: ChurnRescuePolicyNS.ChurnRescuePolicyModule,
  planner: RescueInterventionPlannerNS.RescueInterventionPlannerModule,
  tracker: RecoveryOutcomeTrackerNS.RecoveryOutcomeTrackerModule,
} as const);
