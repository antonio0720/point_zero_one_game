// ═══════════════════════════════════════════════════════════════════════════════
// POINT ZERO ONE — MECHANICS BRIDGE
// pzo-web/src/engines/mechanics/MechanicsBridge.ts
//
// The translation layer between pzo_engine mechanic exec functions and
// pzo-web's EventBus + store mutation system.
//
// RESPONSIBILITIES:
//   ✦ Maintain the exec hook registry (compiled or stub functions)
//   ✦ Execute a single mechanic safely with error containment
//   ✦ Translate MechanicOutputs → EventBus events
//   ✦ Apply store mutations for income, shield, heat, cash changes
//   ✦ Read confidence from mechanicsRuntimeStore for ML weighting
//
// EXECUTION FLOW (per mechanic):
//   1. MechanicsRouter calls bridge.execute(mechanic, context)
//   2. Bridge resolves exec_hook → MechanicExecFn (from exec/index.ts)
//   3. Bridge calls the function with a safe timeout wrapper
//   4. Bridge calls translateAndEmit(result) → EventBus events
//   5. Returns MechanicExecResult to MechanicsRouter
//
// DOES NOT:
//   ✦ Import engine classes directly (uses EventBus events only)
//   ✦ Write to stores directly (emits EventBus events that store handlers receive)
//   ✦ Hold any run state (stateless per-execution)
//
// STORE MUTATION EVENTS EMITTED:
//   MECHANIC_INCOME_DELTA    → runStore.monthlyIncome += delta
//   MECHANIC_EXPENSE_DELTA   → runStore.monthlyExpenses += delta
//   MECHANIC_CASH_DELTA      → runStore.cashBalance += delta
//   MECHANIC_NET_WORTH_DELTA → runStore.netWorth += delta
//   MECHANIC_SHIELD_DELTA    → shieldEngine handles integrity update
//   MECHANIC_HEAT_DELTA      → runStore.haterHeat += delta
//   MECHANIC_PRESSURE_DELTA  → pressureEngine adjusts current score
//   MECHANIC_TENSION_DELTA   → tensionEngine adjusts tension score
//   MECHANIC_CORD_DELTA      → sovereigntyEngine credits CORD delta
//   MECHANIC_FREEZE_TICKS    → timeEngine applies freeze
//   MECHANIC_CASCADE_LINK    → cascadeEngine schedules link
//   MECHANIC_FIRED           → telemetry / sovereignty proof input
//
// Density6 LLC · Point Zero One · Mechanics Layer · Confidential
// ═══════════════════════════════════════════════════════════════════════════════

import type { EventBus } from '../zero/EventBus';
import type { MechanicRecord } from '../data/mechanicsLoader';
import {
  getExecFn,
  hasCompiledExec,
  getCompiledExecCount,
} from './exec/index';
import {
  mechanicsRuntimeStore,
  getConfidenceSync,
} from '../store/mechanicsRuntimeStore';
import type {
  MechanicExecContext,
  MechanicExecResult,
  MechanicExecFn,
  MechanicOutputs,
  CardPlayExecEvent,
  MechanicSnapshotView,
  CascadeLinkSpec,
  ExecHookEntry,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Max milliseconds allowed for a synchronous mechanic exec. */
const SYNC_EXEC_TIMEOUT_MS = 50;

/** Max milliseconds allowed for an async (ML) mechanic exec. */
const ASYNC_EXEC_TIMEOUT_MS = 200;

/** Minimum non-zero magnitude to emit a delta event (avoids noise). */
const DELTA_EMIT_THRESHOLD = 0.001;

// ─────────────────────────────────────────────────────────────────────────────
// MECHANICS BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

export class MechanicsBridge {

  private readonly eventBus: EventBus;

  /**
   * Override registry — allows runtime registration of exec functions
   * that supplement or replace entries from exec/index.ts.
   * Used by Phase 6 hot-reload and test harnesses.
   */
  private readonly overrides: Map<string, ExecHookEntry> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // INIT
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Log the registry state at run start.
   * Called by MechanicsRouter.init() after registering all mechanics.
   */
  public logRegistryStatus(mechanicCount: number): void {
    const compiled = getCompiledExecCount() + this.overrides.size;
    const coverage = mechanicCount > 0 ? ((compiled / mechanicCount) * 100).toFixed(1) : '0';
    console.info(
      `[MechanicsBridge] Registry: ${compiled}/${mechanicCount} compiled (${coverage}% coverage). ` +
      `${mechanicCount - compiled} stubs active. Run build:mechanics to compile remainder.`,
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // EXEC HOOK REGISTRATION (runtime overrides / test harness)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Register or override an exec function at runtime.
   * Override takes priority over exec/index.ts registry entries.
   *
   * @param mechanicId - MechanicRecord.mechanic_id (e.g. "M01")
   * @param execHook   - MechanicRecord.exec_hook (e.g. "m01_run_seed_deterministic_replay")
   * @param fn         - The exec function to register
   * @param isStub     - Mark as stub (for logging purposes)
   */
  public registerExecOverride(
    mechanicId: string,
    execHook: string,
    fn: MechanicExecFn,
    isStub = false,
  ): void {
    this.overrides.set(execHook, { mechanicId, execHook, fn, isStub });
  }

  /**
   * Check whether this exec_hook has a compiled (non-stub) implementation.
   */
  public isCompiled(execHook: string): boolean {
    const override = this.overrides.get(execHook);
    if (override) return !override.isStub;
    return hasCompiledExec(execHook);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // EXECUTE — primary entry point called by MechanicsRouter
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Execute a single mechanic safely.
   *
   * Resolves the exec function, builds the execution context, calls the
   * function with timeout protection, translates outputs to EventBus events,
   * and returns the full result.
   *
   * Errors are contained — never thrown out. Returns errorMessage in result.
   *
   * @param mechanic   - The MechanicRecord to execute
   * @param snapshot   - Frozen snapshot view for this tick
   * @param cardEvent  - Card play event (card_handler mechanics only)
   */
  public async execute(
    mechanic: MechanicRecord,
    snapshot: MechanicSnapshotView,
    cardEvent?: CardPlayExecEvent,
  ): Promise<MechanicExecResult> {
    const startMs = performance.now();

    // ── Resolve exec function ───────────────────────────────────────────────
    const execFn = this.resolveExecFn(mechanic.exec_hook, mechanic.mechanic_id);

    // ── Build execution context ─────────────────────────────────────────────
    const ctx: MechanicExecContext = {
      snapshot,
      mechanic,
      eventBusEmit: this.buildTelemetryEmitter(mechanic.mechanic_id),
      cardEvent,
    };

    // ── Execute with error containment ──────────────────────────────────────
    let result: MechanicExecResult;
    try {
      const rawResult = execFn(ctx);
      if (rawResult instanceof Promise) {
        result = await this.raceWithTimeout(rawResult, ASYNC_EXEC_TIMEOUT_MS, mechanic.mechanic_id);
      } else {
        result = rawResult as MechanicExecResult;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[MechanicsBridge] exec error — mechanic ${mechanic.mechanic_id} (${mechanic.exec_hook}): ${errorMessage}`);
      result = {
        mechanicId:      mechanic.mechanic_id,
        execHook:        mechanic.exec_hook,
        fired:           false,
        outputs:         {},
        telemetryEvents: [],
        errorMessage,
        executionMs:     performance.now() - startMs,
      };
      return result;
    }

    // ── Stamp execution time ────────────────────────────────────────────────
    result = { ...result, executionMs: performance.now() - startMs };

    // ── Translate outputs → EventBus events ─────────────────────────────────
    if (result.fired) {
      this.translateAndEmit(result, mechanic, snapshot.tickIndex);
    }

    return result;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // OUTPUT TRANSLATION — MechanicOutputs → EventBus events
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Translate a fired mechanic's outputs into EventBus events.
   * Each event type maps to a store handler or engine mutation.
   * Only emits events for fields with meaningful magnitude.
   */
  private translateAndEmit(
    result: MechanicExecResult,
    mechanic: MechanicRecord,
    tickIndex: number,
  ): void {
    const out = result.outputs;
    const meta = { mechanicId: mechanic.mechanic_id, execHook: mechanic.exec_hook, tickIndex };

    // ── Income delta → runStore.monthlyIncome ────────────────────────────────
    if (out.incomeDelta !== undefined && Math.abs(out.incomeDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_INCOME_DELTA', { ...meta, delta: out.incomeDelta });
    }

    // ── Expense delta → runStore.monthlyExpenses ─────────────────────────────
    if (out.expenseDelta !== undefined && Math.abs(out.expenseDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_EXPENSE_DELTA', { ...meta, delta: out.expenseDelta });
    }

    // ── Cash delta → runStore.cashBalance ────────────────────────────────────
    if (out.cashDelta !== undefined && Math.abs(out.cashDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_CASH_DELTA', { ...meta, delta: out.cashDelta });
    }

    // ── Net worth delta → runStore.netWorth ──────────────────────────────────
    if (out.netWorthDelta !== undefined && Math.abs(out.netWorthDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_NET_WORTH_DELTA', { ...meta, delta: out.netWorthDelta });
    }

    // ── Shield delta → ShieldEngine integrity update per layer ───────────────
    if (out.shieldDelta && Object.keys(out.shieldDelta).length > 0) {
      for (const [layerId, delta] of Object.entries(out.shieldDelta)) {
        if (delta !== undefined && Math.abs(delta) >= DELTA_EMIT_THRESHOLD) {
          this.eventBus.emit('MECHANIC_SHIELD_DELTA', {
            ...meta,
            layerId,
            delta,
          });
        }
      }
    }

    // ── Heat delta → runStore.haterHeat ──────────────────────────────────────
    if (out.heatDelta !== undefined && Math.abs(out.heatDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_HEAT_DELTA', { ...meta, delta: out.heatDelta });
    }

    // ── Pressure delta → PressureEngine supplemental adjustment ─────────────
    if (out.pressureDelta !== undefined && Math.abs(out.pressureDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_PRESSURE_DELTA', { ...meta, delta: out.pressureDelta });
    }

    // ── Tension delta → TensionEngine score adjustment ───────────────────────
    if (out.tensionDelta !== undefined && Math.abs(out.tensionDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_TENSION_DELTA', { ...meta, delta: out.tensionDelta });
    }

    // ── CORD delta → SovereigntyEngine proof input ───────────────────────────
    if (out.cordDelta !== undefined && Math.abs(out.cordDelta) >= DELTA_EMIT_THRESHOLD) {
      this.eventBus.emit('MECHANIC_CORD_DELTA', { ...meta, delta: out.cordDelta });
    }

    // ── Freeze ticks → TimeEngine ────────────────────────────────────────────
    if (out.freezeTicks !== undefined && out.freezeTicks > 0) {
      this.eventBus.emit('MECHANIC_FREEZE_TICKS', { ...meta, ticks: Math.floor(out.freezeTicks) });
    }

    // ── Cascade links → CascadeEngine.scheduleLink ───────────────────────────
    if (out.cascadeLinks && out.cascadeLinks.length > 0) {
      for (const link of out.cascadeLinks) {
        this.emitCascadeLink(link, meta);
      }
    }

    // ── Custom payload → mechanic-specific handler ───────────────────────────
    if (out.customPayload && Object.keys(out.customPayload).length > 0) {
      this.eventBus.emit('MECHANIC_CUSTOM_PAYLOAD', { ...meta, payload: out.customPayload });
    }

    // ── MECHANIC_FIRED — always emitted for any fired mechanic ───────────────
    // Consumed by: SovereigntyEngine proof pipeline, DevPanel, telemetry.
    this.eventBus.emit('MECHANIC_FIRED', {
      ...meta,
      priority:  mechanic.priority,
      batch:     mechanic.batch,
      layer:     mechanic.layer,
      family:    mechanic.family,
      kind:      mechanic.kind,
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ML MECHANIC CONFIDENCE WEIGHTING
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Read the current confidence level for a mechanic.
   * ML mechanics use this to weight their own signal before returning outputs.
   * Bridge exposes this so MechanicsRouter can pass it into ML exec contexts.
   */
  public getConfidence(mechanicId: string): number {
    return getConfidenceSync(mechanicId);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  private resolveExecFn(execHook: string, mechanicId: string): MechanicExecFn {
    const override = this.overrides.get(execHook);
    if (override) return override.fn;
    return getExecFn(execHook, mechanicId);
  }

  private buildTelemetryEmitter(mechanicId: string) {
    return (event: string, payload: Record<string, unknown>) => {
      this.eventBus.emit(event, { mechanicId, ...payload });
    };
  }

  private emitCascadeLink(link: CascadeLinkSpec, meta: Record<string, unknown>): void {
    this.eventBus.emit('MECHANIC_CASCADE_LINK', {
      ...meta,
      linkId:     link.linkId,
      delayTicks: link.delayTicks,
      magnitude:  link.magnitude,
      chainType:  link.chainType,
    });
  }

  /**
   * Race a Promise against a timeout.
   * Returns a failed-state result if the mechanic exceeds ASYNC_EXEC_TIMEOUT_MS.
   */
  private async raceWithTimeout(
    promise: Promise<MechanicExecResult>,
    timeoutMs: number,
    mechanicId: string,
  ): Promise<MechanicExecResult> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({
          mechanicId,
          execHook:        '',
          fired:           false,
          outputs:         {},
          telemetryEvents: [],
          errorMessage:    `Timeout after ${timeoutMs}ms`,
          executionMs:     timeoutMs,
        });
      }, timeoutMs);

      promise.then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err) => {
          clearTimeout(timer);
          resolve({
            mechanicId,
            execHook:        '',
            fired:           false,
            outputs:         {},
            telemetryEvents: [],
            errorMessage:    err instanceof Error ? err.message : String(err),
            executionMs:     timeoutMs,
          });
        },
      );
    });
  }
}