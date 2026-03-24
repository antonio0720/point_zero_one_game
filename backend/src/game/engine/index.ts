/**
 * backend/src/game/engine/index.ts
 *
 * Canonical public barrel for backend engine surfaces.
 *
 * Why this shape:
 * - Prevents TS2308 ambiguous re-export collisions.
 * - Keeps core engine contracts available at the top level.
 * - Exposes determinism/runtime surfaces required by engine tests.
 * - Moves overlap-heavy modules behind namespaces so their internal
 *   symbols can coexist without poisoning the barrel.
 */

export * from './after_action_generator';
export * from './card_types';
export * from './mode_overlay_engine';
export * from './card_registry';
export * from './deck_manager';
export * from './deterministic_rng';
export * from './replay_engine';
export * from './run_runtime';
export * from './seed_generator';
export * from './core/ProofSealer';
export * from './core/ThreatRoutingService';
export * from './core/ModeRuleCompiler';
export * as TurnResolver from './turn_resolver';

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

/**
 * Cards engine sub-system — compiler, executor, legality, registry,
 * targeting, timing, overlay, and deck composition all live here.
 *
 * Namespaced to prevent TS2308 collisions with the legacy card_types /
 * card_registry / card_effects_executor exports already in this barrel.
 *
 * Usage:
 *   import { Cards } from '../../engine';
 *   const compiler = new Cards.CardEffectCompiler(overlay);
 *   const service  = new Cards.CardLegalityService(registry);
 */
export * as Cards from './cards';