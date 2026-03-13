// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/chat/npc/index.ts

/**
 * ============================================================================
 * POINT ZERO ONE — FRONTEND CHAT NPC BARREL
 * FILE: pzo-web/src/engines/chat/npc/index.ts
 * ============================================================================
 *
 * Stable export surface for the chat NPC lane.
 *
 * This barrel now exposes:
 * - hater registry
 * - helper registry
 * - ambient/world registry
 *
 * Future planner/cadence files can be added here without changing downstream
 * import paths.
 * ============================================================================
 */

export * from './HaterDialogueRegistry';
export * from './HelperDialogueRegistry';
export * from './AmbientNpcRegistry';
