//Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/zero/EngineOrchestrator.ts

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
//   ✦ Tick sequencing: 13 steps, immutable order, per-step error boundaries
//   ✦ Snapshot assembly: buildRunStateSnapshot() once per tick before Step 1
//   ✦ Win/loss check: after Step 12, before Step 13 flush
//   ✦ Engine wiring: constructs all 7 engines, injects reader interfaces
//   ✦ Error containment: step errors logged + engine health updated, tick continues
//   ✦ Abort logic: 5 consecutive tick errors → ABANDONED outcome
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

import { EventBus, sharedEventBus } from './EventBus';
import { EngineRegistry }           from './EngineRegistry';
import { RunStateSnapshot }         from './RunStateSnapshot';
import {
  EngineId,
  EngineHealth,
  type EngineInitParams,
  type RunLifecycleState,
  type RunOutcome,
  type TickResult,
  type AttackEvent,
  type DamageResult,
  type CascadeEffect,
  type RecoveryResult,
  type RunStateSnapshotFields,
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
  private readonly timeEngine:        TimeEngine;
  private readonly pressureEngine:    PressureEngine;
  private readonly tensionEngine:     TensionEngine;
  private readonly shieldEngine:      ShieldEngine;
  private readonly battleEngine:      BattleEngine;
  private readonly cascadeEngine:     CascadeEngine;
  private readonly sovereigntyEngine: SovereigntyEngine;

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

    // ── Instantiate all 7 engines ────────────────────────────────────────────
    this.timeEngine        = new TimeEngine(this.eventBus);
    this.pressureEngine    = new PressureEngine(this.eventBus);
    this.tensionEngine     = new TensionEngine(this.eventBus);
    this.shieldEngine      = new ShieldEngine(this.eventBus);
    this.battleEngine      = new BattleEngine(this.eventBus);
    this.cascadeEngine     = new CascadeEngine(this.eventBus);
    this.sovereigntyEngine = new SovereigntyEngine(this.eventBus);

    // ── Register all 7 engines ────────────────────────────────────────────────
    this.registry.register(this.timeEngine);
    this.registry.register(this.pressureEngine);
    this.registry.register(this.tensionEngine);
    this.registry.register(this.shieldEngine);
    this.registry.register(this.battleEngine);
    this.registry.register(this.cascadeEngine);
    this.registry.register(this.sovereigntyEngine);

    // ── Inject reader interfaces (cross-engine read contracts) ────────────────
    // Stable references — wired once at construction, not per-run.
    this.timeEngine.setPressureReader(this.pressureEngine);
    this.pressureEngine.setShieldReader(this.shieldEngine);
    this.pressureEngine.setCascadeReader(this.cascadeEngine);
    this.battleEngine.setShieldReader(this.shieldEngine);
    this.battleEngine.setTensionReader(this.tensionEngine);
    this.shieldEngine.setTensionReader(this.tensionEngine);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN LIFECYCLE — startRun
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a new run.
   *
   * Initializes all engines, resets the event bus, validates readiness,
   * and emits RUN_STARTED. Must be called from IDLE state only.
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

    // Clear any stale queued events from a previous run.
    // clearQueue() preserves all subscribers (React store wiring, UI hooks, telemetry).
    // Full eventBus.reset() — which wipes subscribers — belongs ONLY in orchestrator.reset().
    this.eventBus.clearQueue();

    // Initialize all 7 engines
    const initParams: EngineInitParams = {
      runId:            params.runId,
      userId:           params.userId,
      seed:             params.seed,
      seasonTickBudget: params.seasonTickBudget,
      freedomThreshold: params.freedomThreshold,
      clientVersion:    params.clientVersion,
      engineVersion:    params.engineVersion,
    };
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
   * Executes the Sovereignty pipeline (async), writes the run record,
   * emits RUN_ENDED, and transitions to ENDED state.
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
   * Reset the Orchestrator and all engines to IDLE state.
   * Call after endRun() before starting a new run.
   */
  public reset(): void {
    this.registry.resetAll();
    this.eventBus.reset();
    this.currentRunId     = null;
    this.currentUserId    = null;
    this.currentSeed      = null;
    this.freedomThreshold = 0;
    this.tickErrorCount   = 0;
    this.lifecycleState   = 'IDLE';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTE TICK — 13-step sequence
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single full tick.
   *
   * Called by TickScheduler every tick interval.
   * Implements the 13-step sequence with per-step error boundaries.
   * Returns TickResult with all intermediate outputs, or null if not ACTIVE.
   *
   * STEP ORDER (immutable):
   *   Pre  buildRunStateSnapshot()
   *   1    TimeEngine.advanceTick(snapshot)
   *   2    PressureEngine.computeScore(snapshot)                → pressureScore
   *   3    TensionEngine.updateQueue(snapshot)
   *   4    ShieldEngine.applyPassiveDecay(snapshot)
   *   5    BattleEngine.evaluateBotStates(snapshot)
   *   6    BattleEngine.executeAttacks(snapshot)                → attackEvents[]
   *   7    ShieldEngine.applyAttacks(attacks, snapshot)         → damageResults[]
   *   8    CascadeEngine.executeScheduledLinks(snapshot, dmg)   → cascadeEffects[]
   *   9    CascadeEngine.checkRecoveryConditions(snapshot)      → recoveryResults[]
   *   10   PressureEngine.recomputePostActions(snap, fx, rec)   → postActionPressure
   *   11   TimeEngine.setTierFromPressure(postActionPressure)
   *   12   SovereigntyEngine.snapshotTick(snapshot)
   *   Win/loss check (FREEDOM > BANKRUPT > TIMEOUT)
   *   13   EventBus.flush()
   */
  public async executeTick(): Promise<TickResult | null> {
    if (this.lifecycleState !== 'ACTIVE') return null;

    const tickStart = performance.now();
    this.lifecycleState = 'TICK_LOCKED';

    // ── PRE-TICK: Build frozen snapshot ─────────────────────────────────────
    const snapshot = this.buildRunStateSnapshot();
    this.eventBus.setTickContext(snapshot.tickIndex);

    // TICK_START fires immediately — not deferred
    this.eventBus.emit('TICK_START', {
      tickIndex:      snapshot.tickIndex,
      tickDurationMs: snapshot.currentTickDurationMs,
    });

    // Working variables — outputs threaded from step to step
    let pressureScore:      number           = snapshot.pressureScore;
    let postActionPressure: number           = snapshot.pressureScore;
    let attackEvents:       AttackEvent[]    = [];
    let damageResults:      DamageResult[]   = [];
    let cascadeEffects:     CascadeEffect[]  = [];
    let recoveryResults:    RecoveryResult[] = [];
    let tickOutcome:        RunOutcome | null = null;

    // ── STEP 1: TimeEngine.advanceTick ───────────────────────────────────────
    try { this.timeEngine.advanceTick(snapshot); }
    catch (err) { this.handleStepError(1, EngineId.TIME, err); }

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
    try { this.sovereigntyEngine.snapshotTick(snapshot); }
    catch (err) { this.handleStepError(12, EngineId.SOVEREIGNTY, err); }

    // ── WIN / LOSS CHECK ─────────────────────────────────────────────────────
    // Priority contract: FREEDOM > BANKRUPT > TIMEOUT.
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

    return {
      tickIndex:          snapshot.tickIndex,
      pressureScore,
      postActionPressure,
      attacksFired:       attackEvents,
      damageResults,
      cascadeEffects,
      recoveryResults,
      runOutcome:         tickOutcome,
      tickDurationMs,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SNAPSHOT BUILDER — private, called at most TWICE per tick
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Assemble the RunStateSnapshot for this tick.
   *
   * Reads from:
   *   (a) runStore.getState() — financial state, haterHeat, activeThreatCardCount
   *   (b) Each engine's public read-only getters
   *
   * Called ONCE before Step 1.
   * Called a SECOND time after Step 12 for win/loss condition evaluation.
   * NEVER called between steps 1–12.
   */
  private buildRunStateSnapshot(): RunStateSnapshot {
    const store = runStore.getState();

    const time     = this.timeEngine;
    const pressure = this.pressureEngine;
    const tension  = this.tensionEngine;
    const shield   = this.shieldEngine;
    const battle   = this.battleEngine;
    const cascade  = this.cascadeEngine;

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
      activeDecisionWindows: time.getDecisionWindowsActive(),
      holdsRemaining:        time.getHoldsRemaining(),

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

      // ── Battle Engine (haterHeat + activeThreatCardCount from runStore) ────
      haterHeat:             store.haterHeat,
      activeBotCount:        battle.getActiveBotCount(),
      haterAttemptsThisTick: 0,   // resets per tick — populated during Step 6
      haterBlockedThisTick:  0,
      haterDamagedThisTick:  0,
      activeThreatCardCount: store.activeThreatCardCount,

      // ── Cascade Engine ─────────────────────────────────────────────────────
      activeCascadeChains:       cascade.getActiveChainCount(),
      cascadesTriggeredThisTick: 0,
      cascadesBrokenThisTick:    0,

      // ── Decision tracking — populated by DecisionTimer during Step 1 ───────
      decisionsThisTick: [],
    };

    return new RunStateSnapshot(fields);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE: DB WRITE (STUB)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Write the completed run record to the backend.
   * POST to pzo-server /runs/complete.
   * Body: { runId, userId, outcome, proofHash, grade, sovereigntyScore, integrityStatus }
   * This stub is a placeholder — backend implementation is separate.
   */
  private async writeRunRecord(identity: any, outcome: RunOutcome): Promise<void> {
    void identity;
    void outcome;
    // TODO: POST to pzo-server /runs/complete
  }
}

// =============================================================================
// SINGLETON EXPORT
// Shared instance consumed by ModeRouter, LobbyScreen (via ModeRouter),
// and the engines/core/EngineOrchestrator shim.
// =============================================================================

export const orchestrator = new EngineOrchestrator();