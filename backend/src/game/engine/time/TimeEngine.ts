/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeEngine.ts
 *
 * Doctrine:
 * - backend is the authoritative simulation surface for cadence and budget consumption
 * - time executes only in STEP_02_TIME
 * - decision-window expiry, phase movement, and next-tick authority live here
 * - this engine must stay compatible with the current snapshot contract
 *   while pushing the backend closer to the frontend time doctrine
 */

import {
  createEngineHealth,
  createEngineSignal,
  type EngineHealth,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import { DecisionTimer } from './DecisionTimer';
import { TickRateInterpolator } from './TickRateInterpolator';
import {
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  dedupeTags,
  resolvePhaseFromElapsedMs,
} from './types';

export class TimeEngine implements SimulationEngine {
  public readonly engineId = 'time' as const;

  private readonly interpolator = new TickRateInterpolator();
  private readonly decisionTimer = new DecisionTimer();

  public reset(): void {
    this.interpolator.reset('T1');
    this.decisionTimer.reset();
  }

  public canRun(snapshot: RunStateSnapshot, context: TickContext): boolean {
    return snapshot.outcome === null && context.step === 'STEP_02_TIME';
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): EngineTickResult {
    const nowMs = Math.trunc(context.nowMs);
    const nextTick = snapshot.tick + 1;

    const syncResult = this.decisionTimer.syncFromSnapshot(
      snapshot.timers.activeDecisionWindows,
      snapshot.timers.frozenWindowIds,
      nowMs,
    );

    for (const windowId of syncResult.openedWindowIds) {
      const deadlineMs = snapshot.timers.activeDecisionWindows[windowId];

      if (deadlineMs !== undefined) {
        context.bus.emit(
          'decision.window.opened',
          {
            windowId,
            tick: nextTick,
            durationMs: Math.max(0, deadlineMs - nowMs),
          },
          {
            emittedAtTick: nextTick,
            tags: ['engine:time', 'decision:opened'],
          },
        );
      }
    }

    const durationMs = this.interpolator.resolveDurationMs(snapshot.pressure.tier);
    const elapsedMs = snapshot.timers.elapsedMs + durationMs;
    const phase = resolvePhaseFromElapsedMs(elapsedMs);
    const phaseChanged = phase !== snapshot.phase;

    const phaseBoundaryWindowsRemaining = phaseChanged
      ? DEFAULT_PHASE_TRANSITION_WINDOWS
      : Math.max(0, snapshot.modeState.phaseBoundaryWindowsRemaining - 1);

    const expiredWindowIds = this.decisionTimer.closeExpired(nowMs);

    for (const windowId of expiredWindowIds) {
      context.bus.emit(
        'decision.window.closed',
        {
          windowId,
          tick: nextTick,
          accepted: false,
        },
        {
          emittedAtTick: nextTick,
          tags: ['engine:time', 'decision:expired'],
        },
      );
    }

    const totalBudgetMs = snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;
    const timeoutReached = snapshot.outcome === null && elapsedMs >= totalBudgetMs;
    const nextOutcome = timeoutReached ? 'TIMEOUT' : snapshot.outcome;

    const nextWarnings = timeoutReached
      ? [...new Set([...snapshot.telemetry.warnings, 'Season budget exhausted.'])]
      : snapshot.telemetry.warnings;

    const nextSnapshot: RunStateSnapshot = {
      ...snapshot,
      tick: nextTick,
      phase,
      outcome: nextOutcome,
      modeState: {
        ...snapshot.modeState,
        phaseBoundaryWindowsRemaining,
      },
      timers: {
        ...snapshot.timers,
        elapsedMs,
        currentTickDurationMs: durationMs,
        nextTickAtMs: timeoutReached ? null : nowMs + durationMs,
        holdCharges: snapshot.modeState.holdEnabled ? snapshot.timers.holdCharges : 0,
        activeDecisionWindows: this.decisionTimer.snapshot(),
        frozenWindowIds: this.decisionTimer.frozenIds(nowMs),
      },
      telemetry: {
        ...snapshot.telemetry,
        outcomeReason: timeoutReached
          ? 'Season budget exhausted before financial freedom was achieved.'
          : snapshot.telemetry.outcomeReason,
        outcomeReasonCode: timeoutReached
          ? 'SEASON_BUDGET_EXHAUSTED'
          : snapshot.telemetry.outcomeReasonCode,
        warnings: nextWarnings,
      },
      tags: dedupeTags(
        snapshot.tags,
        phaseChanged ? `phase:${phase.toLowerCase()}:entered` : null,
        expiredWindowIds.length > 0 ? 'decision_window:expired' : null,
        timeoutReached ? 'run:timeout' : null,
        this.interpolator.isTransitioning() ? 'time:interpolating' : null,
      ),
    };

    const signals = [
      ...(phaseChanged
        ? [
            createEngineSignal(
              this.engineId,
              'INFO',
              'TIME_PHASE_ADVANCED',
              `Run phase advanced from ${snapshot.phase} to ${phase}.`,
              nextTick,
              ['phase-change'],
            ),
          ]
        : []),
      ...expiredWindowIds.map((windowId) =>
        createEngineSignal(
          this.engineId,
          'WARN',
          'TIME_DECISION_WINDOW_EXPIRED',
          `Decision window ${windowId} expired before resolution.`,
          nextTick,
          ['decision-window', 'expired'],
        ),
      ),
      ...(timeoutReached
        ? [
            createEngineSignal(
              this.engineId,
              'WARN',
              'TIME_SEASON_BUDGET_EXHAUSTED',
              'Run timed out because the season time budget was exhausted.',
              nextTick,
              ['timeout', 'terminal'],
            ),
          ]
        : []),
    ];

    return {
      snapshot: nextSnapshot,
      signals,
    };
  }

  public getHealth(): EngineHealth {
    return createEngineHealth(
      this.engineId,
      'HEALTHY',
      Date.now(),
      [
        `currentDurationMs=${this.interpolator.getCurrentDurationMs()}`,
        `transitioning=${this.interpolator.isTransitioning()}`,
        `activeDecisionWindows=${this.decisionTimer.activeCount()}`,
      ],
    );
  }

  /**
   * External integration points for card / mode / admin surfaces.
   * These do not change orchestration ownership; they only mutate
   * this engine's local runtime ledger.
   */
  public openDecisionWindow(windowId: string, deadlineMs: number): void {
    this.decisionTimer.open(windowId, deadlineMs);
  }

  public resolveDecisionWindow(windowId: string): boolean {
    return this.decisionTimer.resolve(windowId);
  }

  public nullifyDecisionWindow(windowId: string): boolean {
    return this.decisionTimer.nullify(windowId);
  }

  public applyHold(
    windowId: string,
    nowMs: number,
    holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  ): boolean {
    return this.decisionTimer.freeze(windowId, nowMs, holdDurationMs);
  }

  public releaseHold(windowId: string): boolean {
    return this.decisionTimer.unfreeze(windowId);
  }
}