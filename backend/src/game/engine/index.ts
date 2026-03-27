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

/**
 * Time subsystem — authoritative backend time lane.
 *
 * Covers: TimeEngine (Engine 1/7, STEP_02_TIME), TickScheduler (cadence shell),
 * TickTierPolicy (tier→duration resolution), TickRateInterpolator (smooth tier
 * transitions), DecisionExpiryResolver (forced-card expiry), DecisionTimer
 * (countdown driver), HoldActionLedger (hold freeze management),
 * RunTimeoutGuard (season budget enforcement), SeasonClock (real-world calendar),
 * TimeBudgetService (budget arithmetic), TimeSnapshotProjector (snapshot advance),
 * TimeTelemetryProjector (telemetry append), TimeEventEmitter (event publication),
 * and the full contracts surface (cadence resolution, ML 28-dim vector, DL 40×6
 * tensor, chat bridge signals, risk assessment, decision batch analysis, and
 * runtime summary projection).
 *
 * All time truth flows through this namespace. The TimeEngine is wired into the
 * EngineOrchestrator at STEP_02_TIME. TimeContractChatSignal is consumed by
 * the chat lane's LIVEOPS_SIGNAL adapter.
 *
 * Usage:
 *   import { Time } from '../../engine';
 *   const engine = new Time.TimeEngine(deps);
 *   const cadence = engine.resolveCadence(snapshot);
 *   const mlVec = Time.extractTimeContractMLVector(...);
 *   const chatSignal = Time.buildTimeContractChatSignal(...);
 */
export * as Time from './time';

/**
 * Zero subsystem — Engine 0: the foundation layer.
 *
 * Covers: ZeroEngine (the conductor that orchestrates all 7 sovereign engines
 * through the 13-step tick sequence), EngineOrchestrator (live tick runner),
 * TickPlan (step planning and validation), DependencyBinder (reader wiring
 * with 32-dim ML vector, 6×8 DL tensor, health monitoring, timeline tracking,
 * telemetry extraction, and chat signal construction — all available at Zero.*),
 * TickExecutor (13-step execution), TickStateLock (mutation guards),
 * OutcomeGate (terminal outcome resolution), EventFlushCoordinator (tick-boundary
 * flush with 32-dim ML vector, 40×8 DL tensor, FlushChatSignal→LIVEOPS routing,
 * MerkleChain seal chaining, fault detection, narrative generation, trend and
 * recovery forecasting — consumed by EventFlushSignalAdapter in chat adapter suite;
 * entry points: createEventFlushCoordinatorWithAnalytics, DEFAULT_EVENT_FLUSH_COORDINATOR,
 * extractEventFlushMLVector, buildEventFlushDLTensor, verifyFlushResultSeal),
 * event dispatch), OrchestratorConfig (profile-based configuration),
 * OrchestratorDiagnostics (runtime observer with 32-dim ML vector, 13×8 DL tensor,
 * DiagnosticsChatSignal, trend analysis, session analytics, recovery forecast,
 * narrative generation, step drill-down, error analysis, and run summary — all
 * available at Zero.*; key entry points: createOrchestratorDiagnosticsWithAnalytics,
 * extractDiagnosticsMLVector, buildDiagnosticsDLTensor, buildDiagnosticsChatSignal,
 * computeDiagnosticsRecoveryForecast, generateDiagnosticsNarrative,
 * ZERO_DIAGNOSTICS_TREND_ANALYZER, ZERO_DIAGNOSTICS_SESSION_ANALYTICS,
 * ZERO_DEFAULT_DIAGNOSTICS_ML_VECTOR, ZERO_DEFAULT_DIAGNOSTICS_DL_TENSOR,
 * ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL), OrchestratorHealthReport
 * (health aggregation), OrchestratorTelemetry (telemetry collection with
 * 32-dim ML vector, 8×4 DL tensor, TelemetryChatSignal, trend analysis,
 * session tracking, annotation bundles, event log, and run summary),
 * RuntimeCheckpointCoordinator (snapshot checkpoints), RunCommandGateway
 * (command surface), RunQueryService (query surface), StepTracePublisher
 * (trace publication), RunBootstrapPipeline (run start), RunShutdownPipeline
 * (run end), ErrorBoundary (error isolation), RunLifecycleCoordinator
 * (lifecycle facade), and all zero.types orchestration contracts.
 *
 * ZeroEngine is the primary entry point. It wraps the orchestrator with
 * 96-dimensional ML feature extraction, 16×128 DL tensor construction,
 * chat signal emission, snapshot projections, trend analysis, recovery
 * forecasting, narrative generation, quarantine management, and full
 * lifecycle history tracking.
 *
 * ErrorBoundary entry points (all under Zero.*):\n *   const boundary = Zero.createErrorBoundaryWithAnalytics('system');\n *   const result = boundary.boundary.capture(meta, execute, fallback);\n *   const mlVec  = boundary.extractMLVector(tick);\n *   const tensor = boundary.buildDLTensor(tick);\n *   const signal = boundary.buildChatSignal();\n *   const trend  = boundary.getTrend();\n *   const fore   = boundary.getRecoveryForecast();\n *   const sess   = boundary.getSessionReport();\n *   // Singletons: Zero.ENGINE_ZERO_BOUNDARY, Zero.MODE_BOUNDARY,\n *   //             Zero.DETERMINISM_BOUNDARY, Zero.RESOURCE_BOUNDARY\n *\n * DependencyBinder ML/DL entry points (all under Zero.*):
 *   const vec = Zero.extractDependencyBindingMLVector(session);   // 32-dim
 *   const tsr = Zero.extractDependencyBindingDLTensor(session);   // 6×8
 *   const sig = Zero.buildDependencyBindingChatSignal(session);
 *   const tel = Zero.extractDependencyBindingTelemetry(session);
 *   const { binder, monitor, timeline } =
 *     Zero.createDependencyBinderWithMonitor();
 *
 * EventFlushCoordinator entry points (all under Zero.*):
 *   const { coordinator, sessionId } =
 *     Zero.createEventFlushCoordinatorWithAnalytics('solo');
 *   const result = coordinator.flush(snapshot, bus);
 *   const mlVec  = coordinator.extractMLVector();   // 32-dim
 *   const tensor = coordinator.buildDLTensor();     // 40×8
 *   const signal = coordinator.buildChatSignal();   // FlushChatSignal
 *   const trend  = coordinator.getTrend();          // FlushTrendSnapshot
 *   const fore   = coordinator.getRecoveryForecast();
 *   const report = coordinator.getSessionReport();
 *   const merkle = coordinator.getMerkleRoot();
 *   // Singleton: Zero.DEFAULT_EVENT_FLUSH_COORDINATOR
 *   // Utility:   Zero.verifyFlushResultSeal(result)
 *   // Utility:   Zero.formatFlushSummary(result)
 *
 * OrchestratorDiagnostics entry points (all under Zero.*):
 *   const bundle = Zero.createOrchestratorDiagnosticsWithAnalytics(deps);
 *   bundle.diagnostics.recordTickSummary(summary);    // called by TickExecutor
 *   bundle.diagnostics.recordError(error);            // called by TickExecutor
 *   const snap   = bundle.captureAndRecord();         // snapshot + trend + session
 *   const result = bundle.captureAndInspect();        // full inspection bundle
 *   const mlVec  = bundle.extractMLVector();          // 32-dim
 *   const tensor = bundle.buildDLTensor();            // 13×8
 *   const signal = bundle.buildChatSignal();          // DiagnosticsChatSignal
 *   const trend  = bundle.getTrend();                 // DiagnosticsTrendSnapshot
 *   const report = bundle.getSessionReport();         // DiagnosticsSessionReport
 *   // Singletons: Zero.ZERO_DIAGNOSTICS_TREND_ANALYZER
 *   //             Zero.ZERO_DIAGNOSTICS_SESSION_ANALYTICS
 *   //             Zero.ZERO_DEFAULT_DIAGNOSTICS_ML_VECTOR
 *   //             Zero.ZERO_DEFAULT_DIAGNOSTICS_DL_TENSOR
 *   //             Zero.ZERO_DEFAULT_DIAGNOSTICS_CHAT_SIGNAL
 *   // Utilities:  Zero.extractDiagnosticsMLVector(snap)
 *   //             Zero.buildDiagnosticsDLTensor(snap)
 *   //             Zero.buildDiagnosticsChatSignal(snap)
 *   //             Zero.computeDiagnosticsRecoveryForecast(snap)
 *   //             Zero.generateDiagnosticsNarrative(snap)
 *   //             Zero.inspectDiagnosticsSnapshot(snap)
 *   //             Zero.drillDownStep(snap, step)
 *   //             Zero.drillDownAllSteps(snap)
 *   //             Zero.analyzeErrors(snap)
 *   //             Zero.buildDiagnosticsRunSummary(snap)
 *
 * OrchestratorHealthReport entry points (all under Zero.*):
 *   const bundle = Zero.createOrchestratorHealthReportWithAnalytics(deps);
 *   const snap   = bundle.captureAndRecord();         // snapshot + trend + session
 *   const result = bundle.captureAndInspect();        // full export bundle
 *   const mlVec  = bundle.extractMLVector();          // 32-dim (7 engines × health features)
 *   const tensor = bundle.buildDLTensor();            // 7×8 (engine × feature matrix)
 *   const signal = bundle.buildChatSignal();          // OrchestratorHealthChatSignal
 *   const trend  = bundle.getTrend();                 // OrchestratorHealthTrendSnapshot
 *   const report = bundle.getSessionReport();         // OrchestratorHealthSessionReport
 *   const annot  = bundle.buildAnnotations();         // OrchestratorHealthAnnotationBundle
 *   const runSum = bundle.buildRunSummary();          // OrchestratorHealthRunSummary
 *   const full   = bundle.exportBundle();             // OrchestratorHealthExportBundle
 *   // Singleton: Zero.ZERO_DEFAULT_HEALTH_CHAT_SIGNAL
 *   // Constants: Zero.HEALTH_ML_FEATURE_LABELS (32), Zero.HEALTH_DL_ENGINE_ORDER (7)
 *   //            Zero.HEALTH_STATUS_NUMERIC_SCORE, Zero.HEALTH_STATUS_DL_ENCODING
 *   //            Zero.HEALTH_STATUS_URGENCY_WEIGHT, Zero.HEALTH_STATUS_SCORE_PENALTY
 *   // Utilities: Zero.extractHealthMLVector(snap)
 *   //            Zero.buildHealthDLTensor(snap, nowMs)
 *   //            Zero.buildHealthAnnotations(snap)
 *   //            Zero.validateHealthMLVector(vec)
 *   //            Zero.validateHealthDLTensor(tensor)
 *   //            Zero.computeHealthMLSimilarity(a, b)
 *   //            Zero.getTopUrgentHealthFeatures(vec, topN)
 *   //            Zero.flattenHealthDLTensor(tensor)
 *   //            Zero.buildHealthMLNamedMap(vec)
 *   //            Zero.extractHealthDLColumn(tensor, colIndex)
 *   //            Zero.getMostUrgentHealthEngine(tensor)
 *   //            Zero.scoreEngineHealth(entry)
 *   //            Zero.classifyEngineStatusSeverity(status)
 *   //            Zero.isTerminalEngineStatus(status)
 *   //            Zero.isImpairedEngineStatus(status)
 *
 * OrchestratorTelemetry entry points (all under Zero.*):
 *   const bundle = Zero.createOrchestratorTelemetryWithAnalytics({ sessionId });
 *   bundle.telemetry.recordTick({ snapshot, tickDurationMs, capturedAtMs });
 *   bundle.telemetry.recordStepTrace(record);
 *   bundle.telemetry.recordEngineHealth(health);
 *   const snap    = bundle.telemetry.snapshot();         // OrchestratorTelemetrySnapshot
 *   const export_ = bundle.captureAndRecord();           // TelemetryExportBundle
 *   const signal  = bundle.captureAndSignal();           // TelemetryChatSignal
 *   const mlVec   = bundle.extractMLVector();            // 32-dim TelemetryMLVector
 *   const tensor  = bundle.buildDLTensor();              // 8×4 TelemetryDLTensor
 *   const trend   = bundle.getTrend();                   // TelemetryTrendSnapshot | null
 *   const report  = bundle.getSessionReport();           // TelemetrySessionReport
 *   const runSum  = bundle.buildRunSummary();            // TelemetryRunSummary
 *   // Singletons: Zero.ZERO_TELEMETRY_ML_EXTRACTOR
 *   //             Zero.ZERO_TELEMETRY_DL_BUILDER
 *   //             Zero.ZERO_TELEMETRY_ANNOTATOR
 *   //             Zero.ZERO_TELEMETRY_INSPECTOR
 *   //             Zero.ZERO_DEFAULT_TELEMETRY_ML_VECTOR
 *   //             Zero.ZERO_DEFAULT_TELEMETRY_DL_TENSOR
 *   //             Zero.ZERO_DEFAULT_TELEMETRY_CHAT_SIGNAL
 *   // Constants:  Zero.TELEMETRY_ML_FEATURE_LABELS (32)
 *   //             Zero.TELEMETRY_TICK_STEP_ORDER (13 steps)
 *   //             Zero.ENGINE_SIGNAL_SEVERITY_SCORE
 *   //             Zero.ENGINE_SIGNAL_SEVERITY_WEIGHT
 *   //             Zero.ENGINE_HEALTH_STATUS_SCORE
 *   //             Zero.ENGINE_HEALTH_STATUS_URGENCY_WEIGHT
 *   // Utilities:  Zero.extractTelemetryMLVector(snap)
 *   //             Zero.buildTelemetryDLTensor(snap)
 *   //             Zero.buildTelemetryChatSignal(snap)
 *   //             Zero.buildTelemetryAnnotations(snap)
 *   //             Zero.classifyTelemetrySeverity(snap)
 *   //             Zero.validateTelemetryMLVector(vec)
 *   //             Zero.flattenTelemetryDLTensor(tensor)
 *   //             Zero.buildTelemetryMLNamedMap(vec)
 *   //             Zero.extractTelemetryDLColumn(tensor, col)
 *   //             Zero.computeTelemetryMLSimilarity(a, b)
 *   //             Zero.getTopTelemetryFeatures(vec, topN)
 *   //             Zero.scoreTelemetryEngineHealth(entry)
 *   //             Zero.getTelemetryEngineHealthSeverityLabel(entry)
 *   //             Zero.getTelemetrySignalSeverityWeight(severity)
 *   //             Zero.isTelemetryEnginePhaseStep(step)
 *   //             Zero.getTelemetryStepBudgetMs(step)
 *
 * Usage:
 *   import { Zero } from '../../engine';
 *   const engine = Zero.createZeroEngine();
 *   const result = engine.startRun({ userId: 'u1', mode: 'solo' });
 *   const mlVec = engine.extractMLVector();
 *   const projection = engine.projectSnapshot();
 *   const narrative = engine.generateNarrative();
 *   const chatSignals = engine.emitChatSignals();
 */
export * as Zero from './zero';