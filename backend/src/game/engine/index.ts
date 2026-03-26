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

/**
 * Shield subsystem — authoritative attack routing, breach cascade resolution,
 * layer management, repair queue, UX bridge, and ShieldEngine ML/DL pipeline.
 *
 * Covers: AttackRouter (doctrine-based L1–L4 routing for all eight
 * ShieldDoctrineAttackTypes), BreachCascadeResolver (ghost L3 + L4 cascade
 * chains, sovereignty fatality), ShieldLayerManager (CASH_RESERVE / CREDIT_LINE /
 * INCOME_BASE / NETWORK_CORE integrity state, 32-feature ML vector, 40×6 DL tensor,
 * trend analysis, resilience forecasting, annotation bundles, session analytics —
 * companions: MLExtractor, DLBuilder, TrendAnalyzer, ResilienceForecaster, Annotator,
 * Inspector, Analytics), ShieldRepairQueue (repair scheduling), ShieldUXBridge
 * (UX translation), and ShieldEngine (full ML/DL extraction, trend analysis,
 * resilience forecasting).
 *
 * All shield truth flows through this namespace. The ShieldSignalAdapter is
 * consumed by the backend chat lane for attack/cascade → chat translation.
 * Sovereignty L4 fatality signals are CRITICAL and never suppressed.
 *
 * Usage:
 *   import { Shield } from '../../engine';
 *   const router = new Shield.AttackRouter();
 *   const resolver = new Shield.BreachCascadeResolver();
 *   const ensemble = Shield.createBreachCascadeResolverWithAnalytics();
 *   const modeProfile = Shield.buildAttackRouterModeProfile('ghost');
 *   const layerManager = new Shield.ShieldLayerManager();
 */
export * as Shield from './shield';

/**
 * Sovereignty subsystem — authoritative proof generation, integrity verification,
 * CORD scoring, grade assignment, badge computation, and run finalization.
 *
 * Covers: SovereigntyEngine (SimulationEngine at STEP_10), ProofGenerator
 * (deterministic SHA-256 proof hashing), ReplayIntegrityChecker (structural +
 * state + proof hash validation), RunGradeAssigner (CORD-weighted S/A/B/C/D/F
 * grading), SovereigntySnapshotAdapter (snapshot→record conversion),
 * SovereigntyExportAdapter (JSON/PDF/PNG artifact projection),
 * SovereigntyPersistenceWriter (DB write orchestration), and full contract
 * types for ticks, runs, artifacts, and audit trails.
 *
 * All sovereignty truth flows through this namespace. The sovereignty.completed
 * event is emitted on run finalization and is consumed by the chat lane.
 *
 * Usage:
 *   import { Sovereignty } from '../../engine';
 *   const engine = new Sovereignty.SovereigntyEngine();
 *   const adapter = new Sovereignty.SovereigntySnapshotAdapter();
 *   const grade = Sovereignty.normalizeGrade(snapshot.sovereignty.verifiedGrade);
 */
export * as Sovereignty from './sovereignty';

/**
 * Tension subsystem — authoritative anticipation queue, threat visibility,
 * tension score accumulation/decay, ML/DL feature extraction, UX narrative
 * generation, trend analysis, recovery forecasting, resilience scoring,
 * and the TensionEngine (SimulationEngine at STEP_04_TENSION).
 *
 * Covers: TensionEngine (core orchestrator with 32-dim ML vector, 48×8 DL
 * tensor, UX narrative, trend snapshot, queue analytics, visibility analytics,
 * session analytics, resilience scoring, ghost penalty analysis, pulse analytics,
 * pressure-tension correlation, queue simulation, mitigation recommendations,
 * decay scenario simulation, and complete export bundles), AnticipationQueue
 * (threat scheduling and lifecycle), ThreatVisibilityManager (information
 * exposure control by pressure tier), TensionDecayController (score math),
 * TensionThreatProjector (queue→ThreatEnvelope projection), TensionUXBridge
 * (EventBus broadcasting), TensionThreatSourceAdapter (snapshot→threat
 * discovery), TensionMetricsCollector (higher-order operational metrics),
 * TensionPolicyResolver (centralized policy decisions), and
 * TensionSnapshotAdapter (runtime→RunStateSnapshot bridge).
 *
 * All tension truth flows through this namespace. The TensionEngine reads
 * threat state and pressure tier; it NEVER writes to game state directly.
 * All outbound signals flow through TensionUXBridge → EventBus.emit().
 *
 * Usage:
 *   import { Tension } from '../../engine';
 *   const engine = new Tension.TensionEngine();
 *   const snapshot = engine.getRuntimeSnapshot();
 *   const mlVec = engine.extractMLVector();
 *   const narrative = engine.generateNarrative();
 *   const forecast = engine.computeRecoveryForecast();
 *   const recommendations = engine.computeMitigationRecommendations();
 */
export * as Tension from './tension';