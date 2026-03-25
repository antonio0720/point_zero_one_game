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

/**
 * Cascade subsystem — chain registry, queue manager, recovery checker,
 * positive tracker, template validator, and the CascadeSubsystem wiring hub.
 *
 * Namespaced to prevent TS2308 collisions with any future top-level barrel
 * additions. All ML/DL entry points are available under this namespace:
 *
 *   import { Cascade } from '../../engine';
 *   const sub = new Cascade.CascadeSubsystem();
 *   const bundle = sub.extractMLBundle(snapshot, templates);
 *   const tensor = sub.extractDLInputTensor(snapshot, templates);
 */
export * as Cascade from './cascade';

/**
 * Chat subsystem — the authoritative backend chat lane.
 *
 * Covers: adapters (battle/run/multiplayer/economy), combat (boss fights,
 * attack windows, telegraphs, counter resolution), transcript authority,
 * rate policy, moderation, proof chain, memory, intelligence, continuity,
 * experience, and rewards.
 *
 * All ML/DL entry points for the chat lane are available under this namespace:
 *
 *   import { Chat } from '../../engine';
 *   const suite = new Chat.Adapters.AdapterSuite(opts);
 *   const projection = policy.project(request);
 */
export * as Chat from './chat';

/**
 * Core engine subsystem — the authoritative production runtime layer.
 *
 * Covers: GamePrimitives, RunStateSnapshot, RunStateFactory, Deterministic,
 * ClockSource, EventBus, EngineContracts, EngineRegistry, TickSequence,
 * DecisionWindowService, CardOverlayResolver, EngineOrchestrator,
 * EngineRuntime, EngineTickTransaction, RunStateInvariantGuard,
 * RuntimeOutcomeResolver, RuntimeCheckpointStore, TickTraceRecorder,
 * ProofSealer, ThreatRoutingService, ModeRuleCompiler.
 *
 * Also exports ML/DL wiring surfaces (CoreMLRouter, CoreSnapshotInspector,
 * CoreEventRouter) and the buildCoreEngineStack factory.
 *
 * Usage:
 *   import { Core } from '../../engine';
 *   const stack = Core.buildCoreEngineStack({ mode: 'solo', seed: 'abc' });
 *   const result = stack.orchestrator.startRun(input);
 *   const mlSummary = result.mlContext;
 */
export * as Core from './core';

/**
 * Mode subsystem — all four game mode adapters, registry, runtime director,
 * and contracts. Includes ModeSignalAdapter bridge for chat lane integration.
 *
 * Usage:
 *   import { Modes } from '../../engine';
 *   const registry = new Modes.ModeRegistry();
 *   const director = new Modes.ModeRuntimeDirector(registry);
 */
export * as Modes from './modes';

/**
 * Pressure subsystem — authoritative pressure engine, signal collector,
 * decay controller, event emitter, ML/DL extraction, trend analysis,
 * recovery forecasting, and chat adapter.
 *
 * All pressure truth flows through this namespace. The PressureEngine is
 * wired into the EngineOrchestrator at STEP_03_PRESSURE. The PressureSignalAdapter
 * is consumed by the backend chat lane for tier/band/signal→chat translation.
 *
 * Usage:
 *   import { Pressure } from '../../engine';
 *   const engine = new Pressure.PressureEngine();
 *   const result = engine.tick(snapshot, context);
 *   const mlVec = engine.getLastMLVector();
 *   const forecast = engine.computeRecoveryForecast(snapshot);
 *   const adapter = Pressure.createPressureEngine();
 */
export * as Pressure from './pressure';