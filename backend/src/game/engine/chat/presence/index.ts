/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND CHAT PRESENCE BARREL INDEX
 * FILE: backend/src/game/engine/chat/presence/index.ts
 * VERSION: 2026.03.23-presence-index.v1
 * AUTHORSHIP: Antonio T. Smith Jr.
 * LICENSE: Internal / Proprietary / All Rights Reserved
 * ============================================================================
 *
 * Purpose
 * -------
 * Authoritative public entry surface for the backend chat presence subsystem.
 * This barrel is the canonical import boundary for all consumers of the
 * presence lane — `chat/index.ts`, server handlers, and test suites.
 *
 * Presence subsystem owns:
 * - Which presence style variant an NPC adopts in a given room/channel context
 * - How read receipts are delayed, hidden, batched, or weaponized
 * - How typing theater is planned: bursts, pauses, lurk windows, fakes
 * - How stare windows and negotiation read sequences are orchestrated
 * - How scene-level timing is previewed before full simulation
 *
 * Three subsystems compose this lane:
 *
 *   PresenceStyleResolver
 *   ─────────────────────
 *   Resolves the canonical presence style variant for an NPC turn. Profiles
 *   (BALANCED, HATER_HEAVY, HELPER_PRIORITY, NEGOTIATION_FOCUS,
 *   LIVEOPS_RESPONSIVE, SHADOW_HEAVY) tune signal thresholds and variant
 *   scoring. Produces PresenceStyleResolution containing the variant key,
 *   behavior flags, read policy, and signal vector.
 *
 *   ReadReceiptPolicy
 *   ─────────────────
 *   Decides when read receipts should exist, whether the player can see them,
 *   how long the delay should be, and when leaving a message unread is the
 *   stronger gameplay move. Profiles (BALANCED, NEGOTIATION_HEAVY,
 *   HATER_WEAPONIZED, HELPER_VISIBLE, SHADOW_SILENT, BATCHED_PRESSURE) tune
 *   threshold and window parameters. Supports stare window planning,
 *   negotiation read sequencing, and batch pressure aggregation.
 *
 *   TypingSimulationEngine
 *   ──────────────────────
 *   Turns presence style, latency law, silence windows, and read-delay policy
 *   into actual typing theater plans. Profiles (STANDARD, AGGRESSIVE_HATER,
 *   PATIENT_HELPER, NEGOTIATION_STALL, SHADOW_MINIMAL, LIVEOPS_RAPID,
 *   CINEMATIC) tune timing windows, burst structure, and scene sequencing.
 *   Produces TypingSimulationResult containing the typing plan, cue, fake
 *   start/stop windows, read receipt, and full audit surface.
 *
 * Module objects
 * ──────────────
 * - ChatPresenceStyleResolverModule  — resolver bundle (re-exported from resolver file)
 * - ChatReadReceiptPolicyModule      — policy bundle (re-exported from policy file)
 * - ChatTypingSimulationEngineModule — engine bundle (re-exported from engine file)
 * - ChatPresenceModule               — combined bundle (defined in this barrel)
 * ============================================================================
 */

// ============================================================================
// MARK: Full passthrough re-exports
// ============================================================================

export * from './PresenceStyleResolver';
export * from './ReadReceiptPolicy';
export * from './TypingSimulationEngine';

// ============================================================================
// MARK: Namespace imports for combined module bundle
// ============================================================================

import * as PresenceStyleResolverNS from './PresenceStyleResolver';
import * as ReadReceiptPolicyNS from './ReadReceiptPolicy';
import * as TypingSimulationEngineNS from './TypingSimulationEngine';

// ============================================================================
// MARK: Combined barrel module object
// ============================================================================

/**
 * Combined namespace object exposing all three presence subsystems
 * under a single import handle:
 *
 *   import { ChatPresenceModule } from './presence';
 *   ChatPresenceModule.styleResolver.createBalancedPresenceStyleResolver();
 *   ChatPresenceModule.readReceipt.createNegotiationHeavyReadReceiptPolicy();
 *   ChatPresenceModule.typingEngine.createCinematicTypingEngine();
 */
export const ChatPresenceModule = Object.freeze({
  styleResolver: PresenceStyleResolverNS.ChatPresenceStyleResolverModule,
  readReceipt: ReadReceiptPolicyNS.ChatReadReceiptPolicyModule,
  typingEngine: TypingSimulationEngineNS.ChatTypingSimulationEngineModule,
} as const);
