/**
 * backend/src/game/engine/index.ts
 *
 * Canonical public barrel for backend engine surfaces.
 *
 * Why this shape:
 * - Prevents TS2308 ambiguous re-export collisions.
 * - Keeps core engine contracts available at the top level.
 * - Moves overlap-heavy modules behind namespaces so their internal
 *   symbols can coexist without poisoning the barrel.
 *
 * Notes:
 * - `card_types` remains a top-level export because it appears to be the
 *   canonical source of shared engine contracts.
 * - `timing_validator` is exported as a namespace because it overlaps with
 *   `card_types` on types like AppliedEffect, CardEffectOp, CardEffectResult,
 *   CardEffectSpec, CardInHand, CardOverlaySnapshot, CardPlayRequest,
 *   CardTag, CurrencyType, DeckType, ExecutionContext, GameMode,
 *   ModeOverlay, ResourceDelta, Targeting, TimingClass, and
 *   TimingValidationResult.
 * - Game mode modules are exported as namespaces because they overlap on
 *   action names such as AdvanceTickAction and RecordFreedomAction.
 */

export * from './after_action_generator';
export * from './card_types';
export * from './mode_overlay_engine';
export * from './card_registry';
export * as CardEffectsExecutor from './card_effects_executor';

/**
 * Collision-prone modules are namespaced intentionally.
 * Consumers should import from:
 * - Engine.TimingValidator.*
 * - Engine.HeadToHeadMode.*
 * - Engine.TeamUpMode.*
 * - Engine.ChaseALegendMode.*
 */
export * as TimingValidator from './timing_validator';
export * as HeadToHeadMode from '../modes/head_to_head_mode';
export * as TeamUpMode from '../modes/team_up_mode';
export * as ChaseALegendMode from '../modes/chase_a_legend_mode';