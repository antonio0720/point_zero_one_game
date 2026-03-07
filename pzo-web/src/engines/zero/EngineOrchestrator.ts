// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — ENGINE 0 ENGINE ORCHESTRATOR
// pzo-web/src/engines/zero/EngineOrchestrator.ts
//
// THE MOST CRITICAL FILE IN THE CODEBASE.
//
// The Orchestrator is the conductor. It sequences. It wires. It protects.
// It does NOT think, decide, simulate, or perform game logic.
//
// RESPONSIBILITIES:
//   ✦ Run lifecycle: startRun() → tick loop → endRun() → reset()
//   ✦ Tick sequencing: 14 steps (13 + Step 1.5), immutable order, per-step error boundaries
//   ✦ Snapshot assembly: buildRunStateSnapshot() once per tick before Step 1
//   ✦ Win/loss check: after Step 12, before Step 13 flush
//   ✦ Engine wiring: constructs all 8 engines, injects reader interfaces
//   ✦ Error containment: step errors logged + engine health updated, tick continues
//   ✦ Abort logic: 5 consecutive tick errors → ABANDONED outcome
//
// TICK SEQUENCE (immutable order):
//   Pre   buildRunStateSnapshot()               — frozen state for all steps
//   1     TimeEngine.advanceTick(snapshot)
//   1.5   CardEngine.tick(snapshot.tickIndex)   ← Phase 1: new step
//   2     PressureEngine.computeScore(snapshot)
//   3     TensionEngine.updateQueue(snapshot)
//   4     ShieldEngine.applyPassiveDecay(snapshot)
//   5     BattleEngine.evaluateBotStates(snapshot)
//   6     BattleEngine.executeAttacks(snapshot)
//   7     ShieldEngine.applyAttacks(attacks, snapshot)
//   8     CascadeEngine.executeScheduledLinks(snapshot, dmg)
//   9     CascadeEngine.checkRecoveryConditions(snapshot)
//   10    PressureEngine.recomputePostActions(snap, fx, rec)
//   11    TimeEngine.setTierFromPressure(postActionPressure)
//   12    SovereigntyEngine.snapshotTick(snapshot)
//   12.5  MechanicsRouter.tickRuntime(snapshot)        ← Phase 5: new step
//   Win/loss check (FREEDOM > BANKRUPT > TIMEOUT)
//   13    EventBus.flush()
//
// PHASE 1 CHANGES:
//   ✦ CardEngine imported and instantiated in constructor.
//   ✦ CardEngineAdapter registered with EngineRegistry as 8th engine.
//   ✦ Step 1.5: cardEngineAdapter.tick() called after TimeEngine.advanceTick,
//     before PressureEngine.computeScore.
//   ✦ decisionsThisTick threaded: stored in this.pendingDecisions after Step 1.5.
//     Used by buildRunStateSnapshot() so the NEXT tick's snapshot carries these
//     decisions. Also exposed in TickResult.decisionsThisTick for the same tick.
//   ✦ CardReader wired: cardEngineAdapter.getReader() injected into engines that
//     need card state without directly coupling to CardEngine. Currently used by
//     buildRunStateSnapshot() to read activeThreatCardCount and decision window
//     counts from the card layer rather than from runStore.
//   ✦ cardEngineAdapter.startRun() called after initializeAll() in startRun().
//   ✦ cardEngineAdapter.endRun() called at the start of endRun().
//
// PHASE 5 CHANGES:
//   ✦ MechanicsRouter imported and instantiated in constructor.
//   ✦ initMechanicsRouter() called in startRun() after cardEngineAdapter.startRun()
//     so the router initialises with the correct run ID and active mechanic set.
//   ✦ Step 12.5: mechanicsRouter.tickRuntime(snapshot) called after
//     SovereigntyEngine.snapshotTick, before Win/Loss check.
//     All mechanic EventBus events travel in the same flush pass as
//     all other engine events from this tick.
//   ✦ mechanicsRouter.reset() called in reset() alongside registry.resetAll().
//   ✦ MechanicTickResult is returned in TickResult.mechanicsResult (optional).
//
// ABSOLUTE RULES:
//   ✦ Only this file imports engine classes.
//   ✦ Only this file calls flush().
//   ✦ buildRunStateSnapshot() is called ONCE per tick — never between steps.
//   ✦ TICK_COMPLETE is emitted BEFORE flush so it travels in the same flush pass.
//   ✦ Win/loss check: FREEDOM > BANKRUPT > TIMEOUT.
//   ✦ tickErrorCount resets to 0 on a clean tick.
//
// SINGLETON:
//   A shared `orchestrator` instance is exported for ModeRouter and LobbyScreen.
//   Do NOT construct additional EngineOrchestrator instances outside tests.
//
// Density6 LLC · Point Zero One · Engine 0 · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import { EventBus, sharedEventBus } from '../core/EventBus';
import { EngineRegistry }           from './EngineRegistry';
import { RunStateSnapshot }         from './RunStateSnapshot';
import {
  EngineId,
  EngineHealth,
  type CardReader,
  type EngineInitParams,
  type RunLifecycleState,
  type RunOutcome,
  type TickResult,
  type AttackEvent,
  type DamageResult,
  type CascadeEffect,
  type RecoveryResult,
  type RunStateSnapshotFields,
  type DecisionRecordField,
  ShieldLayerId,
} from './types';

// ── Engine class imports — ONLY this file is allowed to do this ───────────────
import { TimeEngine }        from '../time/TimeEngine';
import { PressureEngine }    from '../pressure/PressureEngine';
import { TensionEngine }     from '../tension/TensionEngine';
import { ShieldEngine }      from '../shield/ShieldEngine';
import { BattleEngine }      from '../battle/BattleEngine';
import { CascadeEngine }     from '../cascade/CascadeEngine';
import { SovereigntyEngine } from '../sovereignty/SovereigntyEngine';

// ── Phase 1: CardEngine imports ───────────────────────────────────────────────
// CardEngine is the inner implementation class. CardEngineAdapter wraps it and
// implements IEngine so it can be registered in the EngineRegistry.
// The Orchestrator holds both references:
//   - cardEngine      → for direct tick() and getReader() calls
//   - cardEngineAdapter → for registry participation (implements IEngine)
import { CardEngine }        from '../cards/CardEngine';
import { CardEngineAdapter } from '../cards/CardEngineAdapter';
import type { DecisionRecord } from '../cards/types';

// ── Phase 5: MechanicsRouter — Step 12.5 mechanics dispatcher ────────────────
// Instantiated in constructor, init() called in startRun(), reset() in reset(),
// tickRuntime() called at Step 12.5 of executeTick().
import { MechanicsRouter }  from '../mechanics/MechanicsRouter';
import { initMechanicsRouter } from '../../data/mechanicsLoader';
import type { MechanicTickResult } from '../mechanics/types';

// ── Phase 5: NOTE — zero/types.ts TickResult must add the mechanicsResult field ──
// Add to TickResult interface in zero/types.ts:
//   mechanicsResult?: MechanicTickResult | null;  // Phase 5 — Step 12.5 output
// Import MechanicTickResult from '../mechanics/types' in zero/types.ts.

// ── Game store — only used to read financial state + hater_heat for snapshot ──
// runStore (non-hook) is used here because Orchestrator runs outside React.
import { runStore } from '../../store/runStore';

// ── startRun() parameter shape ─────────────────────────────────────────────────
export interface StartRunParams {
  runId:            string;
  userId:           string;
  seed:             string;
  seasonTickBudget: number;
  freedomThreshold: number;
  clientVersion:    string;
  engineVersion:    string;
}

// =============================================================================
// ENGINE ORCHESTRATOR
// =============================================================================

export class EngineOrchestrator {

  // ── Core infrastructure ────────────────────────────────────────────────────
  private readonly eventBus: EventBus;
  private readonly registry: EngineRegistry;

  // ── Engine instances — only the Orchestrator holds these references ─────────
  // Original seven engines: direct class references for typed method access.
  private readonly timeEngine:        TimeEngine;
  private readonly pressureEngine:    PressureEngine;
  private readonly tensionEngine:     TensionEngine;
  private readonly shieldEngine:      ShieldEngine;
  private readonly battleEngine:      BattleEngine;
  private readonly cascadeEngine:     CascadeEngine;
  private readonly sovereigntyEngine: SovereigntyEngine;

  // Phase 1: CardEngine (inner) + CardEngineAdapter (registry-registered wrapper).
  // cardEngine   → used directly for tick() and getReader() calls.
  // cardEngineAdapter → registered with EngineRegistry; implements IEngine.
  //
  // Both are held as separate references so:
  //   (a) The registry sees a clean IEngine — it has no knowledge of CardEngine.
  //   (b) The Orchestrator can call typed CardEngine methods without casting.
  private readonly cardEngine:        CardEngine;
  private readonly cardEngineAdapter: CardEngineAdapter;

  // ── Phase 1: CardReader ───────────────────────────────────────────────────
  // Stable reference built after CardEngine is constructed.
  // Injected into EngineInitParams.cardReader at init time.
  // Also used directly in buildRunStateSnapshot() for card-derived fields.
  private readonly cardReader: CardReader;

  // ── Phase 5: MechanicsRouter ─────────────────────────────────────────────
  // Holds reference to the MechanicsRouter instance.
  // Initialized in constructor, init() called per-run, reset() per-reset.
  private readonly mechanicsRouter: MechanicsRouter;

  // ── Phase 1: decisions from Step 1.5 ─────────────────────────────────────
  // Populated by cardEngine.tick() at Step 1.5 of each tick.
  // Stored here and projected into DecisionRecordField[] for the NEXT tick's
  // snapshot (so all 12 engines in that tick can see last tick's decisions).
  // Also written into TickResult.decisionsThisTick for the CURRENT tick.
  private pendingDecisions: DecisionRecord[] = [];

  // ── Run lifecycle state ────────────────────────────────────────────────────
  private lifecycleState:   RunLifecycleState = 'IDLE';
  private currentRunId:     string | null     = null;
  private currentUserId:    string | null     = null;
  private currentSeed:      string | null     = null;
  private freedomThreshold: number            = 0;

  // ── Error tracking — 5 consecutive errors force ABANDONED ──────────────────
  private tickErrorCount:              number = 0;
  private static readonly MAX_TICK_ERRORS     = 5;

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  constructor() {
    this.eventBus = sharedEventBus;
    this.registry = new EngineRegistry(this.eventBus);

    // ── Instantiate engines ──────────────────────────────────────────────────
    this.timeEngine        = new TimeEngine(this.eventBus);
    this.pressureEngine    = new PressureEngine(this.eventBus);
    this.tensionEngine     = new TensionEngine(this.eventBus);
    this.shieldEngine      = new ShieldEngine(this.eventBus);

    // BattleEngine and CascadeEngine now require the core compatibility EventBus
    // plus a ShieldReader. ShieldEngine satisfies the ShieldReader contract.
    this.battleEngine      = new BattleEngine(this.eventBus, this.shieldEngine);
    this.cascadeEngine     = new CascadeEngine(this.eventBus, this.shieldEngine);
    this.sovereigntyEngine = new SovereigntyEngine(this.eventBus);

    // ── Phase 1: Instantiate CardEngine + adapter ─────────────────────────────
    this.cardEngine        = new CardEngine(this.eventBus);
    this.cardEngineAdapter = new CardEngineAdapter(this.cardEngine, this.eventBus);

    // ── Phase 5: Instantiate MechanicsRouter ────────────────────────────────
    this.mechanicsRouter = new MechanicsRouter(this.eventBus);

    // ── Phase 1: Build CardReader immediately after CardEngine construction ───
    this.cardReader = this.cardEngine.getReader();

    // ── Register all 8 engines ────────────────────────────────────────────────
    this.registry.register(this.timeEngine);
    this.registry.register(this.pressureEngine);
    this.registry.register(this.tensionEngine);
    this.registry.register(this.shieldEngine);
    this.registry.register(this.battleEngine);
    this.registry.register(this.cascadeEngine);
    this.registry.register(this.sovereigntyEngine);
    this.registry.register(this.cardEngineAdapter);  // Phase 1: 8th engine

    // ── Inject reader interfaces (cross-engine read contracts) ────────────────
    // Stable references — wired once at construction, not per-run.
    // BattleEngine and CascadeEngine receive their ShieldReader via constructor
    // args (above), so no setShieldReader/setTensionReader calls needed for them.
    this.timeEngine.setPressureReader(this.pressureEngine);
    this.pressureEngine.setShieldReader(this.shieldEngine);
    this.pressureEngine.setCascadeReader(this.cascadeEngine);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — startRun
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a new run.
   *
   * Initializes all 8 engines, resets the event bus, validates readiness,
   * and emits RUN_STARTED. Must be called from IDLE state only.
   *
   * Phase 1: cardEngineAdapter.startRun() is called after initializeAll()
   * succeeds. This fills the initial hand and opens the first decision windows.
   *
   * @throws If called in any state other than IDLE.
   * @throws If any required engine fails to initialize.
   */
  public startRun(params: StartRunParams): void {
    if (this.lifecycleState !== 'IDLE') {
      throw new Error(
        `[Orchestrator] startRun() called in state '${this.lifecycleState}'. ` +
        `Call reset() first to return to IDLE.`,
      );
    }

    this.lifecycleState   = 'STARTING';
    this.currentRunId     = params.runId;
    this.currentUserId    = params.userId;
    this.currentSeed      = params.seed;
    this.freedomThreshold = params.freedomThreshold;
    this.tickErrorCount   = 0;
    this.pendingDecisions = [];

    // Clear any stale queued events from a previous run.
    // clearQueue() preserves all subscribers (React store wiring, UI hooks, telemetry).
    // Full eventBus.reset() — which wipes subscribers — belongs ONLY in orchestrator.reset().
    this.eventBus.clearQueue();

    // Build EngineInitParams — shared across all 8 engines.
    // Phase 1: cardReader is included so engines that need cross-engine card reads
    // can consume it without importing CardEngine directly.
    const initParams: EngineInitParams = {
      runId:            params.runId,
      userId:           params.userId,
      seed:             params.seed,
      seasonTickBudget: params.seasonTickBudget,
      freedomThreshold: params.freedomThreshold,
      clientVersion:    params.clientVersion,
      engineVersion:    params.engineVersion,
      cardReader:       this.cardReader,
    };

    // Initialize all 8 engines (continues on failure — returns complete health report)
    this.registry.initializeAll(initParams);

    // Validate — every engine must be INITIALIZED before the tick loop starts
    if (!this.registry.allEnginesReady()) {
      const missing = this.registry.getMissingEngines();
      this.lifecycleState = 'IDLE';
      throw new Error(
        `[Orchestrator] Cannot start run — engines not ready: [${missing.join(', ')}]. ` +
        `Check health report for individual failure reasons.`,
      );
    }

    // Phase 1: Start the card engine run (fills initial hand, opens first windows).
    // Called AFTER initializeAll() so CardEngine is fully initialized before
    // startRun() is invoked on it.
    try {
      this.cardEngineAdapter.startRun();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.registry.setHealth(EngineId.CARD, EngineHealth.ERROR, error);
      this.lifecycleState = 'IDLE';
      throw new Error(
        `[Orchestrator] CardEngine.startRun() failed: ${error}. Run aborted.`,
      );
    }

    // ── Phase 5: Initialize MechanicsRouter for this run ─────────────────────
    // init() must run after cardEngineAdapter.startRun() so the card engine is
    // fully started before the mechanics layer initializes. The router builds
    // its active mechanic set from MECHANICS_REGISTRY and registers all mechanics
    // in mechanicsRuntimeStore.
    initMechanicsRouter(
      params.runId,
      (runId) => this.mechanicsRouter.init(runId),
    );

    this.lifecycleState = 'ACTIVE';

    // Emit RUN_STARTED — immediately flushed so store wiring fires before first tick
    this.eventBus.emit('RUN_STARTED', {
      runId:      params.runId,
      userId:     params.userId,
      seed:       params.seed,
      tickBudget: params.seasonTickBudget,
    });
    this.eventBus.flush();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — endRun
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * End the current run with the given outcome.
   *
   * Phase 1: cardEngineAdapter.endRun() is called first to tear down
   * ForcedCardQueue subscribers and window state before emitting RUN_ENDED.
   *
   * Safe to call from ACTIVE or TICK_LOCKED states (e.g. mid-tick ABANDONED).
   */
  public async endRun(outcome: RunOutcome): Promise<void> {
    if (this.lifecycleState !== 'ACTIVE' && this.lifecycleState !== 'TICK_LOCKED') {
      console.warn(
        `[Orchestrator] endRun() called in state '${this.lifecycleState}'. ` +
        `Ignoring — run may already be ending.`,
      );
      return;
    }

    this.lifecycleState = 'ENDING';

    // Phase 1: Tear down CardEngine run state before emitting RUN_ENDED.
    // This destroys ForcedCardQueue subscriptions, closes windows, and prevents
    // any further card events from entering the queue after the run ends.
    try {
      this.cardEngineAdapter.endRun();
    } catch (err) {
      console.error('[Orchestrator] CardEngine.endRun() threw (non-fatal):', err);
    }

    const store = runStore.getState();

    this.eventBus.emit('RUN_ENDED', {
      runId:         this.currentRunId!,
      outcome,
      finalNetWorth: store.netWorth,
    });

    // Execute Sovereignty pipeline
    let identity: any = null;
    try {
      identity = await this.sovereigntyEngine.completeRun({
        outcome,
        finalNetWorth: store.netWorth,
      });
    } catch (err) {
      console.error('[Orchestrator] Sovereignty pipeline error:', err);
    }

    await this.writeRunRecord(identity, outcome);

    // Flush final events (RUN_ENDED travels here)
    this.eventBus.flush();

    this.lifecycleState = 'ENDED';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — reset
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Reset the Orchestrator and all 8 engines to IDLE state.
   * Call after endRun() before starting a new run.
   */
  public reset(): void {
    this.registry.resetAll();
    this.eventBus.reset();
    // Phase 5: Reset mechanics router — clears active mechanic sets and
    // mechanicsRuntimeStore. init() must be called again on next startRun().
    this.mechanicsRouter.reset();
    this.currentRunId     = null;
    this.currentUserId    = null;
    this.currentSeed      = null;
    this.freedomThreshold = 0;
    this.tickErrorCount   = 0;
    this.pendingDecisions = [];
    this.lifecycleState   = 'IDLE';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTE TICK — 14-step sequence (13 + Step 1.5)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single full tick.
   *
   * Called by TickScheduler every tick interval.
   * Implements the 14-step sequence with per-step error boundaries.
   * Returns TickResult with all intermediate outputs, or null if not ACTIVE.
   *
   * STEP ORDER (immutable):
   *   Pre   buildRunStateSnapshot()
   *   1     TimeEngine.advanceTick(snapshot)
   *   1.5   CardEngine.tick(snapshot.tickIndex)             → decisionsThisTick []
   *   2     PressureEngine.computeScore(snapshot)           → pressureScore
   *   3     TensionEngine.updateQueue(snapshot)
   *   4     ShieldEngine.applyPassiveDecay(snapshot)
   *   5     BattleEngine.evaluateBotStates(snapshot)
   *   6     BattleEngine.executeAttacks(snapshot)           → attackEvents []
   *   7     ShieldEngine.applyAttacks(attacks, snapshot)    → damageResults []
   *   8     CascadeEngine.executeScheduledLinks(snap, dmg)  → cascadeEffects []
   *   9     CascadeEngine.checkRecoveryConditions(snapshot) → recoveryResults []
   *   10    PressureEngine.recomputePostActions(snap,fx,rec)→ postActionPressure
   *   11    TimeEngine.setTierFromPressure(postActionPressure)
   *   12    SovereigntyEngine.snapshotTick(snapshot)
   *   Win/loss check (FREEDOM > BANKRUPT > TIMEOUT)
   *   13    EventBus.flush()
   *
   * PHASE 1 NOTE ON decisionsThisTick TIMING:
   *   The main snapshot is frozen before Step 1 and carries LAST tick's decisions
   *   in snapshot.decisionsThisTick (from this.pendingDecisions). Step 1.5 runs
   *   the card engine and produces THIS tick's decisions. They are stored in
   *   this.pendingDecisions for the next snapshot and returned in TickResult.
   *   SovereigntyEngine at Step 12 sees last tick's decisions via the snapshot —
   *   this is by design (proof pipeline processes decisions one tick behind).
   */
  public async executeTick(): Promise<TickResult | null> {
    if (this.lifecycleState !== 'ACTIVE') return null;

    const tickStart = performance.now();
    this.lifecycleState = 'TICK_LOCKED';

    // ── PRE-TICK: Build frozen snapshot ─────────────────────────────────────
    // Carries this.pendingDecisions from Step 1.5 of the PREVIOUS tick as
    // snapshot.decisionsThisTick. On tick 0, pendingDecisions is empty.
    const snapshot = this.buildRunStateSnapshot();
    this.eventBus.setTickContext(snapshot.tickIndex);

    // TICK_START fires immediately — not deferred
    this.eventBus.emit('TICK_START', {
      tickIndex:      snapshot.tickIndex,
      tickDurationMs: snapshot.currentTickDurationMs,
    });

    // Working variables — outputs threaded from step to step
    let pressureScore:         number           = snapshot.pressureScore;
    let postActionPressure:    number           = snapshot.pressureScore;
    let attackEvents:          AttackEvent[]    = [];
    let damageResults:         DamageResult[]   = [];
    let cascadeEffects:        CascadeEffect[]  = [];
    let recoveryResults:       RecoveryResult[] = [];
    let tickOutcome:           RunOutcome | null = null;
    let decisionsThisTick:     DecisionRecord[] = [];

    // ── STEP 1: TimeEngine.advanceTick ───────────────────────────────────────
    try { this.timeEngine.advanceTick(snapshot); }
    catch (err) { this.handleStepError(1, EngineId.TIME, err); }

    // ── STEP 1.5: CardEngine.tick ─────────────────────────────────────────────
    // Phase 1: Cards draw, decision windows open, plays resolve, effects fire.
    // Runs AFTER TimeEngine.advanceTick (tick is now advanced, decision windows
    // have the correct tick context) and BEFORE PressureEngine.computeScore
    // (card plays may affect income/expense state that feeds pressure scoring).
    //
    // Returns: DecisionRecord[] — all decisions resolved this tick.
    // Stored in this.pendingDecisions for NEXT tick's snapshot assembly.
    // Also threaded directly into TickResult.decisionsThisTick.
    try {
      decisionsThisTick     = this.cardEngineAdapter.tick(snapshot.tickIndex);
      this.pendingDecisions = decisionsThisTick; // stored for next snapshot
    } catch (err) {
      this.handleStepError(1.5, EngineId.CARD, err);
      decisionsThisTick     = [];
      this.pendingDecisions = [];
    }

    // ── STEP 2: PressureEngine.computeScore ──────────────────────────────────
    try { pressureScore = this.pressureEngine.computeScore(snapshot); }
    catch (err) {
      this.handleStepError(2, EngineId.PRESSURE, err);
      // pressureScore falls back to snapshot.pressureScore (initialized above)
    }

    // ── STEP 3: TensionEngine.updateQueue ────────────────────────────────────
    try { this.tensionEngine.updateQueue(snapshot); }
    catch (err) { this.handleStepError(3, EngineId.TENSION, err); }

    // ── STEP 4: ShieldEngine.applyPassiveDecay ────────────────────────────────
    // Passive regen BEFORE attacks — intentional design.
    try { this.shieldEngine.applyPassiveDecay(snapshot); }
    catch (err) { this.handleStepError(4, EngineId.SHIELD, err); }

    // ── STEP 5: BattleEngine.evaluateBotStates ───────────────────────────────
    // Evaluation only — attacks fire at Step 6.
    try { this.battleEngine.evaluateBotStates(snapshot); }
    catch (err) { this.handleStepError(5, EngineId.BATTLE, err); }

    // ── STEP 6: BattleEngine.executeAttacks ──────────────────────────────────
    try { attackEvents = this.battleEngine.executeAttacks(snapshot); }
    catch (err) {
      this.handleStepError(6, EngineId.BATTLE, err);
      attackEvents = []; // ShieldEngine handles empty array gracefully
    }

    // ── STEP 7: ShieldEngine.applyAttacks ────────────────────────────────────
    // Always called even if attackEvents is empty — never conditionally skipped.
    try { damageResults = this.shieldEngine.applyAttacks(attackEvents, snapshot); }
    catch (err) {
      this.handleStepError(7, EngineId.SHIELD, err);
      damageResults = [];
    }

    // ── STEP 8: CascadeEngine.executeScheduledLinks ──────────────────────────
    try { cascadeEffects = this.cascadeEngine.executeScheduledLinks(snapshot, damageResults); }
    catch (err) {
      this.handleStepError(8, EngineId.CASCADE, err);
      cascadeEffects = [];
    }

    // ── STEP 9: CascadeEngine.checkRecoveryConditions ────────────────────────
    try { recoveryResults = this.cascadeEngine.checkRecoveryConditions(snapshot); }
    catch (err) {
      this.handleStepError(9, EngineId.CASCADE, err);
      recoveryResults = [];
    }

    // ── STEP 10: PressureEngine.recomputePostActions ─────────────────────────
    try {
      postActionPressure = this.pressureEngine.recomputePostActions(
        snapshot,
        cascadeEffects,
        recoveryResults,
      );
    } catch (err) {
      this.handleStepError(10, EngineId.PRESSURE, err);
      postActionPressure = pressureScore; // fallback to pre-action score
    }

    // ── STEP 11: TimeEngine.setTierFromPressure ──────────────────────────────
    // Tier change takes effect on the NEXT tick.
    try { this.timeEngine.setTierFromPressure(postActionPressure); }
    catch (err) { this.handleStepError(11, EngineId.TIME, err); }

    // ── STEP 12: SovereigntyEngine.snapshotTick ──────────────────────────────
    // snapshot.decisionsThisTick contains LAST tick's decisions (by design).
    // Phase 2+ may wire current decisions directly here if proof pipeline needs them.
    try { this.sovereigntyEngine.snapshotTick(snapshot); }
    catch (err) { this.handleStepError(12, EngineId.SOVEREIGNTY, err); }

    // ── STEP 12.5: MechanicsRouter.tickRuntime ────────────────────────────────
    // Phase 5: Fire all active tick_engine mechanics.
    //
    // Position in sequence (immutable contract):
    //   After Step 12  — sovereignty proof pipeline already snapshotted this tick.
    //   Before Win/Loss — mechanic income/cash/netWorth effects are visible to the
    //                     condition evaluators (hasCrossedFreedomThreshold etc.)
    //   Before flush    — all mechanic EventBus events travel in the same flush pass
    //                     as all other engine events from this tick.
    //
    // Error containment: MechanicsRouter contains per-mechanic errors internally.
    // If the entire router throws (should never happen), tick continues.
    // mechanicsResult is null in that case — not populated in TickResult.
    let mechanicsResult: MechanicTickResult | null = null;
    try {
      mechanicsResult = await this.mechanicsRouter.tickRuntime(snapshot);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] Step 12.5 (MechanicsRouter) fatal error: ${error}`);
      this.eventBus.emit('TICK_STEP_ERROR', { step: 12.5, engineId: 'mechanics', error });
      // Non-fatal — tick continues without mechanics effects this tick.
    }

    // ── WIN / LOSS CHECK ─────────────────────────────────────────────────────
    // Priority contract: FREEDOM > BANKRUPT > TIMEOUT.
    // Second snapshot call — only for win/loss state evaluation.
    const postStepSnapshot = this.buildRunStateSnapshot();
    if      (postStepSnapshot.hasCrossedFreedomThreshold) tickOutcome = 'FREEDOM';
    else if (postStepSnapshot.isBankrupt)                 tickOutcome = 'BANKRUPT';
    else if (postStepSnapshot.isTimedOut)                 tickOutcome = 'TIMEOUT';

    const tickDurationMs = performance.now() - tickStart;

    // ── STEP 13: TICK_COMPLETE + EventBus.flush ───────────────────────────────
    // TICK_COMPLETE must be emitted BEFORE flush so it travels in the same pass.
    this.eventBus.emit('TICK_COMPLETE', {
      tickIndex:      snapshot.tickIndex,
      tickDurationMs,
      outcome:        tickOutcome,
    });
    this.eventBus.flush();

    // ── POST-TICK LIFECYCLE ───────────────────────────────────────────────────
    if (tickOutcome) {
      this.lifecycleState = 'ACTIVE';
      await this.endRun(tickOutcome);
    } else {
      this.lifecycleState = 'ACTIVE';
      this.tickErrorCount = 0; // Clean tick — reset consecutive error counter
    }

    // Project DecisionRecord[] → DecisionRecordField[] for the TickResult.
    // The full DecisionRecord carries extra fields (cordDelta, missedStreak, etc.)
    // not needed by external consumers of TickResult. DecisionRecordField is the
    // cross-module projection defined in zero/types.ts.
    const decisionFields = this.projectDecisionRecords(decisionsThisTick);

    return {
      tickIndex:          snapshot.tickIndex,
      pressureScore,
      postActionPressure,
      attacksFired:       attackEvents,
      damageResults,
      cascadeEffects,
      recoveryResults,
      decisionsThisTick:  decisionFields,
      runOutcome:         tickOutcome,
      tickDurationMs,
      // Phase 5: mechanics tick result (null if MechanicsRouter threw or not initialized)
      mechanicsResult,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT BUILDER — private, called at most TWICE per tick
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Assemble the RunStateSnapshot for this tick.
   *
   * Reads from:
   *   (a) runStore.getState() — financial state, haterHeat
   *   (b) Each engine's public read-only getters
   *   (c) this.cardReader — card-layer state (Phase 1)
   *   (d) this.pendingDecisions — projected decisions from last tick's Step 1.5
   *
   * Called ONCE before Step 1.
   * Called a SECOND time after Step 12 for win/loss condition evaluation.
   * NEVER called between steps 1–12.
   *
   * Phase 1 changes:
   *   - activeThreatCardCount now reads from cardReader (not store)
   *   - activeDecisionWindows now reads from cardReader (card layer is authoritative)
   *   - holdsRemaining now reads from cardReader (card layer tracks hold slot)
   *   - decisionsThisTick populated from this.pendingDecisions (projected)
   */
  private buildRunStateSnapshot(): RunStateSnapshot {
    const store = runStore.getState();

    const time     = this.timeEngine;
    const pressure = this.pressureEngine;
    const tension  = this.tensionEngine;
    const shield   = this.shieldEngine;
    const battle   = this.battleEngine;
    const cascade  = this.cascadeEngine;
    const card     = this.cardReader; // Phase 1: card-layer reader

    // Project pending decisions → DecisionRecordField[] for the snapshot.
    // On tick 0, this.pendingDecisions is empty — snapshot carries empty array.
    const decisionsThisTick = this.projectDecisionRecords(this.pendingDecisions);

    const fields: RunStateSnapshotFields = {
      // ── Tick metadata ──────────────────────────────────────────────────────
      runId:            this.currentRunId!,
      userId:           this.currentUserId!,
      seed:             this.currentSeed!,
      tickIndex:        time.getTicksElapsed(),
      seasonTickBudget: time.getSeasonTickBudget(),
      ticksRemaining:   time.getTicksRemaining(),
      freedomThreshold: this.freedomThreshold,

      // ── Financial state (from runStore) ───────────────────────────────────
      netWorth:        store.netWorth,
      cashBalance:     store.cashBalance,
      monthlyIncome:   store.monthlyIncome,
      monthlyExpenses: store.monthlyExpenses,
      cashflow:        store.monthlyIncome - store.monthlyExpenses,

      // ── Time Engine ────────────────────────────────────────────────────────
      currentTickTier:       time.getCurrentTier(),
      currentTickDurationMs: time.getCurrentTickDurationMs(),
      // Phase 1: CardEngine is authoritative for decision window count.
      // card.getDecisionWindowsActive() counts windows across all card types
      // (standard, forced, phase-boundary). Replaces time.getDecisionWindowsActive().
      activeDecisionWindows: card.getDecisionWindowsActive(),
      // Phase 1: CardEngine tracks the hold slot (Empire mode).
      // Replaces time.getHoldsRemaining().
      holdsRemaining:        card.getHoldsRemaining(),

      // ── Pressure Engine ────────────────────────────────────────────────────
      pressureScore:            pressure.getCurrentScore(),
      pressureTier:             pressure.getCurrentTier(),
      ticksWithoutIncomeGrowth: pressure.getStagnationCount(),

      // ── Tension Engine ─────────────────────────────────────────────────────
      tensionScore:           tension.getCurrentTensionScore(),
      anticipationQueueDepth: tension.getQueueDepth(),
      threatVisibilityState:  tension.getVisibilityState(),

      // ── Shield Engine ──────────────────────────────────────────────────────
      shieldAvgIntegrityPct: shield.getOverallIntegrityPct(),
      shieldL1Integrity:     shield.getLayerIntegrity(ShieldLayerId.LIQUIDITY_BUFFER),
      shieldL2Integrity:     shield.getLayerIntegrity(ShieldLayerId.CREDIT_LINE),
      shieldL3Integrity:     shield.getLayerIntegrity(ShieldLayerId.ASSET_FLOOR),
      shieldL4Integrity:     shield.getLayerIntegrity(ShieldLayerId.NETWORK_CORE),
      shieldL1Max:           100,
      shieldL2Max:           80,
      shieldL3Max:           60,
      shieldL4Max:           40,

      // ── Battle Engine ──────────────────────────────────────────────────────
      haterHeat:             store.haterHeat,
      activeBotCount:        battle.getActiveBotCount(),
      haterAttemptsThisTick: 0,   // resets per tick — populated during Step 6
      haterBlockedThisTick:  0,
      haterDamagedThisTick:  0,
      // Phase 1: Read activeThreatCardCount from CardEngine (authoritative).
      // Previously read from store.activeThreatCardCount which required
      // a separate store write from ForcedCardQueue. CardEngine tracks this
      // internally and exposes it via CardReader.
      activeThreatCardCount: card.getActiveThreatCardCount(),

      // ── Cascade Engine ─────────────────────────────────────────────────────
      activeCascadeChains:       cascade.getActiveChainCount(),
      cascadesTriggeredThisTick: 0,
      cascadesBrokenThisTick:    0,

      // ── Decision tracking ──────────────────────────────────────────────────
      // Phase 1: Populated from this.pendingDecisions (decisions from LAST tick's
      // Step 1.5). SovereigntyEngine uses this for proof scoring. On tick 0, empty.
      decisionsThisTick,
    };

    return new RunStateSnapshot(fields);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJECTION: DecisionRecord → DecisionRecordField
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Projects the card layer's DecisionRecord[] into zero/types.ts DecisionRecordField[].
   *
   * DecisionRecord (from engines/cards/types.ts) carries full scorer output:
   * cordDelta, handContext, instanceId, etc. DecisionRecordField is the
   * cross-module subset needed by engines and the sovereignty proof pipeline.
   *
   * This projection isolates zero/types.ts from the cards/ module shape —
   * if cards/types.ts DecisionRecord evolves, only this method needs updating.
   */
  private projectDecisionRecords(records: DecisionRecord[]): DecisionRecordField[] {
    if (records.length === 0) return [];
    return records.map((r) => ({
      cardId:           r.cardId,
      decisionWindowMs: r.decisionWindowMs,
      resolvedInMs:     r.resolvedInMs,
      wasAutoResolved:  r.wasAutoResolved,
      wasOptimalChoice: r.wasOptimalChoice,
      speedScore:       r.speedScore,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Handle an error thrown during a specific tick step.
   *
   * Logs, marks engine ERROR, emits immediate TICK_STEP_ERROR safety event,
   * increments consecutive error counter. At MAX_TICK_ERRORS forces ABANDONED.
   * Does NOT throw — the tick continues with remaining steps.
   *
   * Phase 1: Accepts step 1.5 (number) for CardEngine error identification.
   */
  private handleStepError(step: number, engineId: EngineId, err: unknown): void {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Orchestrator] Step ${step} (${engineId}) error: ${error}`);

    // Immediate safety event — bypasses queue, fires right now
    this.eventBus.emit('TICK_STEP_ERROR', { step, engineId, error });

    try {
      this.registry.setHealth(engineId, EngineHealth.ERROR, error);
    } catch {
      // Registry may itself be bad — don't let that crash the handler
    }

    this.tickErrorCount += 1;
    if (this.tickErrorCount >= EngineOrchestrator.MAX_TICK_ERRORS) {
      console.error(
        `[Orchestrator] MAX_TICK_ERRORS (${EngineOrchestrator.MAX_TICK_ERRORS}) ` +
        `reached — forcing ABANDONED. Last failing step: ${step}.`,
      );
      this.endRun('ABANDONED').catch((e) =>
        console.error('[Orchestrator] endRun(ABANDONED) threw:', e),
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC READ-ONLY ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  public getLifecycleState(): RunLifecycleState {
    return this.lifecycleState;
  }

  public isRunActive(): boolean {
    return this.lifecycleState === 'ACTIVE';
  }

  public getHealthReport(): Record<EngineId, EngineHealth> {
    return this.registry.getHealthReport();
  }

  public getCurrentRunId(): string | null {
    return this.currentRunId;
  }

  /**
   * Phase 1: Expose CardReader for consumers outside the Orchestrator
   * (e.g. ModeRouter, game screen hooks) that need live card state reads
   * without holding a direct reference to CardEngine.
   */
  public getCardReader(): CardReader {
    return this.cardReader;
  }

  /**
   * Phase 1: Allow external callers to queue a card play into the CardEngine.
   * This is the single external entry point for player card play input.
   * Called by UI hooks / ModeRouter when the player selects a card choice.
   *
   * @param request - CardPlayRequest from cards/types.ts
   */
  public queueCardPlay(request: Parameters<CardEngineAdapter['queuePlay']>[0]): void {
    this.cardEngineAdapter.queuePlay(request);
  }

  /**
   * Phase 1: Allow external callers to hold a card (Empire mode only).
   */
  public holdCard(instanceId: string): boolean {
    return this.cardEngineAdapter.holdCard(instanceId);
  }

  /**
   * Phase 1: Release the held card (Empire mode only).
   */
  public releaseHold(): unknown {
    return this.cardEngineAdapter.releaseHold();
  }

  /**
   * Phase 1: Get the current hand snapshot for UI rendering.
   * Returns CardInHand[] from the CardEngine's HandManager.
   */
  public getHandSnapshot(): ReturnType<CardEngineAdapter['getHandSnapshot']> {
    return this.cardEngineAdapter.getHandSnapshot();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: DB WRITE (STUB)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Write the completed run record to the backend.
   * POST to pzo-server /runs/complete.
   * Body: { runId, userId, outcome, proofHash, grade, sovereigntyScore, integrityStatus }
   * Implementation is in pzo-server — this stub is the client-side call site.
   */
  private async writeRunRecord(identity: any, outcome: RunOutcome): Promise<void> {
    void identity;
    void outcome;
    // Phase 6: POST to pzo-server /runs/complete
  }
}

// =============================================================================
// SINGLETON EXPORT
// Shared instance consumed by ModeRouter, LobbyScreen (via ModeRouter),
// and the engines/core/EngineOrchestrator shim.
// =============================================================================

export const orchestrator = new EngineOrchestrator();