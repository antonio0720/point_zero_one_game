// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MECHANICS ROUTER
// pzo-web/src/engines/mechanics/MechanicsRouter.ts
//
// Per-tick mechanics dispatcher. Called at Step 12.5 of the Orchestrator
// tick sequence (after SovereigntyEngine.snapshotTick, before win/loss check).
//
// RESPONSIBILITIES:
//   ✦ Hold the active mechanic list (from MECHANICS_REGISTRY via mechanicsLoader)
//   ✦ tickRuntime(snapshot): fire all tick_engine mechanics in priority order
//   ✦ onCardPlay(event, snapshot): fire card_handler mechanics for a card event
//   ✦ aggregate outputs across all fired mechanics for the tick
//   ✦ call mechanicsRuntimeStore.recordActivation() after each fire
//   ✦ call mechanicsRuntimeStore.recordTick() at end of each tick
//
// MECHANIC ACTIVATION LOGIC:
//   tick_engine mechanics:
//     - Priority 1 first, then 2, then 3 (within each priority: batch 1 → 2 → 3)
//     - shouldFire(mechanic, snapshot): evaluates mechanic inputs against snapshot
//       to determine if conditions are met. Returns true if the mechanic should
//       attempt to execute this tick.
//     - Status 'todo' mechanics are skipped (not yet implemented)
//     - Status 'done' and 'in_progress' mechanics are active
//
//   card_handler mechanics:
//     - Only fire when a card play event is routed to them
//     - Matched by mechanic.ml_pair or mechanic.mechanic_id against cardEvent.mechanicExecHook
//     - Called directly by onCardPlay() (not during tickRuntime)
//
// TICK SEQUENCE POSITION:
//   Step 12   SovereigntyEngine.snapshotTick(snapshot)
//   Step 12.5 mechanicsRouter.tickRuntime(snapshot)   ← THIS FILE
//   Win/Loss  check (FREEDOM > BANKRUPT > TIMEOUT)
//   Step 13   EventBus.flush()
//
// Step 12.5 DESIGN RATIONALE:
//   After sovereignty (proof pipeline has LAST tick's decisions via snapshot)
//   but BEFORE flush — mechanic events travel in the same flush pass as
//   all other engine events from this tick. Win/loss check follows so
//   mechanic income/cash effects are visible to the condition evaluators.
//
// ABSOLUTE RULES:
//   ✦ Never import engine classes. Only reads RunStateSnapshot.
//   ✦ Never writes to stores directly. Uses MechanicsBridge for all mutations.
//   ✦ All execution is async — awaits MechanicsBridge.execute().
//   ✦ Any single mechanic error is contained — tick continues.
//   ✦ Total Step 12.5 budget: 100ms target, 200ms hard cap.
//
// Density6 LLC · Point Zero One · Mechanics Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { EventBus } from '../zero/EventBus';
import type { RunStateSnapshot } from '../zero/RunStateSnapshot';
import {
  MECHANICS_REGISTRY,
  getMechanicsByLayer,
  getMechanicsByStatus,
  type MechanicRecord,
  type MechanicLayer,
} from '../../data/mechanicsLoader';
import { mechanicsRuntimeStore } from '../../store/mechanicsRuntimeStore';
import { MechanicsBridge } from './MechanicsBridge';
import type {
  MechanicExecResult,
  MechanicOutputs,
  MechanicSnapshotView,
  CardPlayExecEvent,
  MechanicTickResult,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Hard cap on total Step 12.5 execution time (ms). Exceeded = warning logged. */
const STEP_12_5_HARD_CAP_MS = 200;

/**
 * Layers that the router fires during tickRuntime().
 * ui_component, season_runtime, api_endpoint, backend_service are not fired here.
 */
const TICK_RUNTIME_LAYERS: MechanicLayer[] = ['tick_engine'];

/**
 * Layers fired by onCardPlay().
 */
const CARD_HANDLER_LAYERS: MechanicLayer[] = ['card_handler'];

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATION CONDITION EVALUATOR
// Evaluates whether a tick_engine mechanic should fire this tick.
// Uses mechanic.inputs to check relevant snapshot fields.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate whether a mechanic should attempt to fire this tick.
 *
 * Strategy: parse mechanic.inputs to identify which snapshot fields
 * the mechanic watches. The mechanic fires if ANY watched field is non-trivial.
 *
 * For mechanics without meaningful inputs, fire every tick (max activation).
 * For mechanics marked status='todo', never fire.
 *
 * This is a heuristic condition layer. The actual mechanic exec function
 * performs its own fine-grained condition check and returns fired=false
 * if conditions aren't met.
 */
function shouldAttemptFire(mechanic: MechanicRecord, snap: MechanicSnapshotView): boolean {
  // Never fire todo mechanics
  if (mechanic.status === 'todo') return false;

  // Always attempt batch 1, priority 1 — foundational mechanics
  if (mechanic.batch === 1 && mechanic.priority === 1) return true;

  const inputs = mechanic.inputs;
  if (!inputs || inputs.length === 0) return true; // no filter → fire always

  // Map input field names → snapshot values
  const inputFieldMap: Record<string, number | string | boolean> = {
    // Financial
    netWorth:          snap.netWorth,
    cashBalance:       snap.cashBalance,
    monthlyIncome:     snap.monthlyIncome,
    monthlyExpenses:   snap.monthlyExpenses,
    cashflow:          snap.cashflow,
    // Time
    tickIndex:         snap.tickIndex,
    ticksRemaining:    snap.ticksRemaining,
    seasonTickBudget:  snap.seasonTickBudget,
    // Pressure
    pressureScore:     snap.pressureScore,
    pressureTier:      snap.pressureTier,
    stagnationCount:   snap.ticksWithoutIncomeGrowth,
    // Shield
    shieldIntegrity:   snap.shieldAvgIntegrityPct,
    shieldL1:          snap.shieldL1Integrity,
    shieldL2:          snap.shieldL2Integrity,
    shieldL3:          snap.shieldL3Integrity,
    shieldL4:          snap.shieldL4Integrity,
    // Battle
    haterHeat:         snap.haterHeat,
    activeBotCount:    snap.activeBotCount,
    threatCards:       snap.activeThreatCardCount,
    // Cascade
    cascadeChains:     snap.activeCascadeChains,
    // Tension
    tensionScore:      snap.tensionScore,
    queueDepth:        snap.anticipationQueueDepth,
    // Card
    decisionWindows:   snap.activeDecisionWindows,
  };

  // Fire if any declared input field has a non-zero / active value
  for (const inputKey of inputs) {
    const value = inputFieldMap[inputKey];
    if (value === undefined) continue; // unknown input key → ignore
    if (typeof value === 'number' && value !== 0) return true;
    if (typeof value === 'boolean' && value) return true;
    if (typeof value === 'string' && value !== '' && value !== 'NEUTRAL') return true;
  }

  // All checked inputs were zero/idle — skip this tick to save budget
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SNAPSHOT PROJECTION
// Build MechanicSnapshotView from RunStateSnapshot.
// ─────────────────────────────────────────────────────────────────────────────

function projectSnapshot(snapshot: RunStateSnapshot): MechanicSnapshotView {
  return {
    tickIndex:                 snapshot.tickIndex,
    ticksRemaining:            snapshot.ticksRemaining,
    seasonTickBudget:          snapshot.seasonTickBudget,
    netWorth:                  snapshot.netWorth,
    cashBalance:               snapshot.cashBalance,
    monthlyIncome:             snapshot.monthlyIncome,
    monthlyExpenses:           snapshot.monthlyExpenses,
    cashflow:                  snapshot.cashflow,
    pressureScore:             snapshot.pressureScore,
    pressureTier:              snapshot.pressureTier,
    ticksWithoutIncomeGrowth:  snapshot.ticksWithoutIncomeGrowth,
    tensionScore:              snapshot.tensionScore,
    anticipationQueueDepth:    snapshot.anticipationQueueDepth,
    threatVisibilityState:     snapshot.threatVisibilityState,
    shieldAvgIntegrityPct:     snapshot.shieldAvgIntegrityPct,
    shieldL1Integrity:         snapshot.shieldL1Integrity,
    shieldL2Integrity:         snapshot.shieldL2Integrity,
    shieldL3Integrity:         snapshot.shieldL3Integrity,
    shieldL4Integrity:         snapshot.shieldL4Integrity,
    haterHeat:                 snapshot.haterHeat,
    activeBotCount:            snapshot.activeBotCount,
    activeThreatCardCount:     snapshot.activeThreatCardCount,
    activeCascadeChains:       snapshot.activeCascadeChains,
    activeDecisionWindows:     snapshot.activeDecisionWindows,
    holdsRemaining:            snapshot.holdsRemaining,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT AGGREGATION
// Merge per-mechanic outputs into a single aggregated result for the tick.
// Numeric deltas sum. Arrays concat. Last non-null wins for strings.
// ─────────────────────────────────────────────────────────────────────────────

function aggregateOutputs(results: MechanicExecResult[]): MechanicOutputs {
  const agg: MechanicOutputs = {};

  for (const r of results) {
    if (!r.fired) continue;
    const o = r.outputs;

    if (o.incomeDelta)    agg.incomeDelta    = (agg.incomeDelta    ?? 0) + o.incomeDelta;
    if (o.expenseDelta)   agg.expenseDelta   = (agg.expenseDelta   ?? 0) + o.expenseDelta;
    if (o.cashDelta)      agg.cashDelta      = (agg.cashDelta      ?? 0) + o.cashDelta;
    if (o.netWorthDelta)  agg.netWorthDelta  = (agg.netWorthDelta  ?? 0) + o.netWorthDelta;
    if (o.heatDelta)      agg.heatDelta      = (agg.heatDelta      ?? 0) + o.heatDelta;
    if (o.pressureDelta)  agg.pressureDelta  = (agg.pressureDelta  ?? 0) + o.pressureDelta;
    if (o.tensionDelta)   agg.tensionDelta   = (agg.tensionDelta   ?? 0) + o.tensionDelta;
    if (o.cordDelta)      agg.cordDelta      = (agg.cordDelta      ?? 0) + o.cordDelta;
    if (o.freezeTicks)    agg.freezeTicks    = (agg.freezeTicks    ?? 0) + o.freezeTicks;

    if (o.shieldDelta) {
      agg.shieldDelta = agg.shieldDelta ?? {};
      for (const [layerId, delta] of Object.entries(o.shieldDelta)) {
        if (delta !== undefined) {
          (agg.shieldDelta as Record<string, number>)[layerId] =
            ((agg.shieldDelta as Record<string, number>)[layerId] ?? 0) + delta;
        }
      }
    }

    if (o.cascadeLinks && o.cascadeLinks.length > 0) {
      agg.cascadeLinks = [...(agg.cascadeLinks ?? []), ...o.cascadeLinks];
    }

    if (o.customPayload && Object.keys(o.customPayload).length > 0) {
      agg.customPayload = { ...(agg.customPayload ?? {}), ...o.customPayload };
    }
  }

  return agg;
}

// ─────────────────────────────────────────────────────────────────────────────
// MECHANICS ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export class MechanicsRouter {

  private readonly bridge: MechanicsBridge;
  private readonly eventBus: EventBus;

  // ── Active mechanic sets (built at init time, immutable per run) ────────────
  private tickMechanics:       MechanicRecord[] = [];
  private cardHandlerMechanics: MechanicRecord[] = [];

  // ── Lookup map: exec_hook → MechanicRecord (for onCardPlay routing) ─────────
  private readonly hookIndex: Map<string, MechanicRecord> = new Map();

  // ── Run state ───────────────────────────────────────────────────────────────
  private initialized: boolean = false;
  private runId: string | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────────────────

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.bridge   = new MechanicsBridge(eventBus);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INIT — called by Orchestrator.startRun() after CardEngine.startRun()
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the router for a new run.
   *
   * Builds the active mechanic sets from MECHANICS_REGISTRY.
   * Registers each mechanic in mechanicsRuntimeStore.
   * Logs registry coverage via MechanicsBridge.
   *
   * @param runId - Current run ID for logging
   */
  public init(runId: string): void {
    this.runId = runId;

    // Reset store for new run
    mechanicsRuntimeStore.getState().reset();

    // Build active sets — exclude 'todo' status from both sets
    const activeMechanics = MECHANICS_REGISTRY.filter(
      (m) => m.status !== 'todo',
    );

    // Partition by layer
    this.tickMechanics = activeMechanics
      .filter((m) => TICK_RUNTIME_LAYERS.includes(m.layer))
      .sort((a, b) => {
        // Primary: priority (1 → 2 → 3)
        if (a.priority !== b.priority) return a.priority - b.priority;
        // Secondary: batch (1 → 2 → 3)
        return a.batch - b.batch;
      });

    this.cardHandlerMechanics = activeMechanics
      .filter((m) => CARD_HANDLER_LAYERS.includes(m.layer))
      .sort((a, b) => a.priority - b.priority || a.batch - b.batch);

    // Build hook index for fast card_handler lookup
    this.hookIndex.clear();
    for (const m of [...this.tickMechanics, ...this.cardHandlerMechanics]) {
      this.hookIndex.set(m.exec_hook, m);
    }

    // Register all active mechanics in the runtime store
    const storeState = mechanicsRuntimeStore.getState();
    for (const m of activeMechanics) {
      storeState.registerMechanic(m);
    }

    // Log coverage report
    this.bridge.logRegistryStatus(activeMechanics.length);

    this.initialized = true;

    console.info(
      `[MechanicsRouter] init — runId: ${runId} ` +
      `tick_engine: ${this.tickMechanics.length} active ` +
      `card_handler: ${this.cardHandlerMechanics.length} active`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TICK RUNTIME — Step 12.5
  // Called by EngineOrchestrator.executeTick() between Step 12 and Win/Loss
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fire all active tick_engine mechanics for this tick.
   *
   * Execution order: priority 1 → 2 → 3, batch 1 → 2 → 3 within each priority.
   * Each mechanic is executed via MechanicsBridge (error-contained).
   * shouldAttemptFire() gates trivial no-op executions.
   * All EventBus events emitted during execution travel in the same flush pass.
   *
   * @param snapshot - The frozen RunStateSnapshot built before Step 1 of this tick
   * @returns MechanicTickResult with all results and aggregated outputs
   */
  public async tickRuntime(snapshot: RunStateSnapshot): Promise<MechanicTickResult> {
    if (!this.initialized) {
      console.warn('[MechanicsRouter] tickRuntime() called before init(). Skipping.');
      return this.emptyTickResult(snapshot.tickIndex);
    }

    const tickStart = performance.now();
    const snap      = projectSnapshot(snapshot);
    const results:  MechanicExecResult[] = [];
    let fired       = 0;
    let skipped     = 0;
    let errored     = 0;

    for (const mechanic of this.tickMechanics) {
      // ── Activation gate ────────────────────────────────────────────────────
      if (!shouldAttemptFire(mechanic, snap)) {
        skipped++;
        continue;
      }

      // ── Execute via bridge ─────────────────────────────────────────────────
      const result = await this.bridge.execute(mechanic, snap, undefined);
      results.push(result);

      if (result.errorMessage) {
        errored++;
      } else if (result.fired) {
        fired++;
      }

      // ── Record activation in runtime store ─────────────────────────────────
      mechanicsRuntimeStore.getState().recordActivation(result, snapshot.tickIndex);

      // ── Hard cap guard ─────────────────────────────────────────────────────
      if (performance.now() - tickStart > STEP_12_5_HARD_CAP_MS) {
        const remaining = this.tickMechanics.length - results.length - skipped;
        if (remaining > 0) {
          console.warn(
            `[MechanicsRouter] Step 12.5 exceeded ${STEP_12_5_HARD_CAP_MS}ms budget ` +
            `at tick ${snapshot.tickIndex}. ${remaining} mechanics deferred.`,
          );
          skipped += remaining;
        }
        break;
      }
    }

    const totalMs = performance.now() - tickStart;

    // ── Record tick in store (applies heat decay, updates tick counters) ──────
    mechanicsRuntimeStore.getState().recordTick(snapshot.tickIndex, fired, totalMs);

    // ── Emit MECHANICS_TICK_COMPLETE for telemetry ───────────────────────────
    this.eventBus.emit('MECHANICS_TICK_COMPLETE', {
      tickIndex:         snapshot.tickIndex,
      mechanicsFired:    fired,
      mechanicsSkipped:  skipped,
      mechanicsErrored:  errored,
      totalExecutionMs:  totalMs,
    });

    return {
      tickIndex:          snapshot.tickIndex,
      mechanicsFired:     fired,
      mechanicsSkipped:   skipped,
      mechanicsErrored:   errored,
      results,
      aggregatedOutputs:  aggregateOutputs(results),
      totalExecutionMs:   totalMs,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ON CARD PLAY — route card_handler mechanics
  // Called by Orchestrator (or CardEngine via EventBus) when a card is played
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fire card_handler mechanics triggered by a card play event.
   *
   * Matches mechanics by exec_hook against cardEvent.mechanicExecHook.
   * If no exact match, falls back to matching by mechanic_id.
   * Returns all results (empty array if no card_handler mechanics matched).
   *
   * Called from:
   *   - EngineOrchestrator.executeTick() after Step 1.5 (DecisionRecord processing)
   *   - EventBus subscriber for CARD_PLAYED events (Phase 6 bridge wiring)
   *
   * @param cardEvent - The card play event from CardEngine Step 1.5
   * @param snapshot  - The tick's RunStateSnapshot (use same frozen snapshot as Step 12.5)
   */
  public async onCardPlay(
    cardEvent: CardPlayExecEvent,
    snapshot: RunStateSnapshot,
  ): Promise<MechanicExecResult[]> {
    if (!this.initialized) return [];

    const snap    = projectSnapshot(snapshot);
    const results: MechanicExecResult[] = [];

    // Find matching card_handler mechanics
    const targetMechanic =
      this.hookIndex.get(cardEvent.mechanicExecHook) ??
      this.cardHandlerMechanics.find((m) => m.mechanic_id === cardEvent.mechanicExecHook);

    if (!targetMechanic) {
      // No card_handler registered for this card play — normal for many card types
      return results;
    }

    const result = await this.bridge.execute(targetMechanic, snap, cardEvent);
    results.push(result);
    mechanicsRuntimeStore.getState().recordActivation(result, snapshot.tickIndex);

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESET
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reset the router state between runs.
   * Called by Orchestrator.reset().
   * Does NOT re-initialize — init() must be called again for the next run.
   */
  public reset(): void {
    this.tickMechanics        = [];
    this.cardHandlerMechanics = [];
    this.hookIndex.clear();
    this.initialized          = false;
    this.runId                = null;
    mechanicsRuntimeStore.getState().reset();
    console.info('[MechanicsRouter] reset');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC READ ACCESS
  // ─────────────────────────────────────────────────────────────────────────

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getTickMechanicCount(): number {
    return this.tickMechanics.length;
  }

  public getCardHandlerMechanicCount(): number {
    return this.cardHandlerMechanics.length;
  }

  /**
   * Expose the bridge for Phase 6 runtime exec hook registration.
   * Allows ModeRouter to register mode-specific exec overrides.
   */
  public getBridge(): MechanicsBridge {
    return this.bridge;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private emptyTickResult(tickIndex: number): MechanicTickResult {
    return {
      tickIndex,
      mechanicsFired:    0,
      mechanicsSkipped:  0,
      mechanicsErrored:  0,
      results:           [],
      aggregatedOutputs: {},
      totalExecutionMs:  0,
    };
  }
}