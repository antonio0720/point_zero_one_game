// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT NPC BARREL
 * FILE: pzo-web/src/engines/chat/npc/index.ts
 * ============================================================================
 *
 * Stable public export surface for the chat NPC lane.
 *
 * This barrel stays intentionally compile-safe for the current batch and only
 * exports modules that now exist inside /pzo-web/src/engines/chat/npc.
 * Future files such as HelperDialogueRegistry.ts, AmbientNpcRegistry.ts,
 * HaterResponsePlanner.ts, HelperResponsePlanner.ts, and NpcCadencePolicy.ts
 * can be added here without changing downstream import paths.
 *
 * Density6 LLC · Point Zero One · Sovereign Chat Runtime · Confidential
 * ============================================================================
 */

export * from './HaterDialogueRegistry';
