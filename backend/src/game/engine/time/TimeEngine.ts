/* ============================================================================
 * FILE: backend/src/game/engine/time/TimeEngine.ts
 * POINT ZERO ONE — BACKEND ENGINE TIME
 *
 * Doctrine:
 * - backend is the authoritative simulation surface for cadence and budget consumption
 * - time executes only in STEP_02_TIME
 * - decision-window expiry, phase movement, and next-tick authority live here
 * - this engine must stay compatible with the current snapshot contract
 *   while pushing the backend closer to the frontend time doctrine
 * - forced/tutorial cadence overrides are runtime-local and fully resettable
 * - runtime-opened / runtime-closed windows must survive until snapshot commit
 * - hold usage must become durable snapshot truth, not just transient local state
 * ========================================================================== */

import {
  createEngineHealth,
  createEngineSignal,
  type EngineHealth,
  type EngineTickResult,
  type SimulationEngine,
  type TickContext,
} from '../core/EngineContracts';
import type { ModeCode, PressureTier, TimingClass } from '../core/GamePrimitives';
import type {
  RunStateSnapshot,
  RuntimeDecisionWindowSnapshot,
} from '../core/RunStateSnapshot';
import { DecisionTimer } from './DecisionTimer';
import { TickRateInterpolator } from './TickRateInterpolator';
import {
  DEFAULT_HOLD_DURATION_MS,
  DEFAULT_PHASE_TRANSITION_WINDOWS,
  resolvePhaseFromElapsedMs,
} from './types';

interface ForcedTierOverride {
  readonly tier: PressureTier;
  ticksRemaining: number;
}

interface OpenDecisionWindowOptions {
  readonly timingClass?: TimingClass;
  readonly label?: string;
  readonly source?: string;
  readonly mode?: ModeCode;
  readonly openedAtTick?: number;
  readonly openedAtMs?: number;
  readonly closesAtTick?: number | null;
  readonly exclusive?: boolean;
  readonly actorId?: string | null;
  readonly targetActorId?: string | null;
  readonly cardInstanceId?: string | null;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

function dedupeTags(
  ...parts: ReadonlyArray<readonly string[] | string | null | undefined>
): readonly string[] {
  const tags = new Set<string>();

  for (const part of parts) {
    if (part === null || part === undefined) {
      continue;
    }

    if (typeof part === 'string') {
      if (part.length > 0) {
        tags.add(part);
      }
      continue;
    }

    for (const tag of part) {
      if (tag.length > 0) {
        tags.add(tag);
      }
    }
  }

  return Object.freeze([...tags]);
}

function getWindowDurationMs(
  window: RuntimeDecisionWindowSnapshot,
  nowMs: number,
): number {
  if (window.closesAtMs === null) {
    return 0;
  }

  return Math.max(0, Math.trunc(window.closesAtMs) - Math.trunc(nowMs));
}

export class TimeEngine implements SimulationEngine {
  public readonly engineId = 'time' as const;

  private readonly interpolator = new TickRateInterpolator('T1');
  private readonly decisionTimer = new DecisionTimer();

  private forcedTierOverride: ForcedTierOverride | null = null;
  private holdConsumedThisRun = false;
  private lastResolvedTier: PressureTier = 'T1';
  private runtimeHoldCharges: number | null = null;
  private runtimeHoldEnabled = true;

  public reset(): void {
    this.interpolator.reset('T1');
    this.decisionTimer.reset();
    this.forcedTierOverride = null;
    this.holdConsumedThisRun = false;
    this.lastResolvedTier = 'T1';
    this.runtimeHoldCharges = null;
    this.runtimeHoldEnabled = true;
  }

  public canRun(snapshot: RunStateSnapshot, context: TickContext): boolean {
    return snapshot.outcome === null && context.step === 'STEP_02_TIME';
  }

  public tick(snapshot: RunStateSnapshot, context: TickContext): EngineTickResult {
    const nowMs = Math.trunc(context.nowMs);
    const nextTick = snapshot.tick + 1;

    this.syncRuntimeHoldLedger(snapshot);

    const syncResult = this.decisionTimer.syncFromSnapshot(
      snapshot.timers.activeDecisionWindows,
      snapshot.timers.frozenWindowIds,
      nowMs,
    );

    for (const windowId of syncResult.openedWindowIds) {
      const windowSnapshot = snapshot.timers.activeDecisionWindows[windowId];

      if (windowSnapshot !== undefined) {
        context.bus.emit(
          'decision.window.opened',
          {
            windowId,
            tick: nextTick,
            durationMs: getWindowDurationMs(windowSnapshot, nowMs),
            actorId: windowSnapshot.actorId ?? undefined,
          },
          {
            emittedAtTick: nextTick,
            tags: ['engine:time', 'decision:opened'],
          },
        );
      }
    }

    const effectiveTier = this.resolveCadenceTier(snapshot);
    const priorTier = this.interpolator.getCurrentTier() ?? this.lastResolvedTier;

    this.lastResolvedTier = effectiveTier;

    const durationMs = this.interpolator.resolveDurationMs(effectiveTier);
    const effectiveNowMs = nowMs + durationMs;
    const elapsedMs = snapshot.timers.elapsedMs + durationMs;

    const phase = resolvePhaseFromElapsedMs(elapsedMs);
    const phaseChanged = phase !== snapshot.phase;
    const tierChangedThisTick = priorTier !== effectiveTier;

    const phaseBoundaryWindowsRemaining = phaseChanged
      ? DEFAULT_PHASE_TRANSITION_WINDOWS
      : Math.max(0, snapshot.modeState.phaseBoundaryWindowsRemaining - 1);

    const expiredWindowIds = this.decisionTimer.closeExpired(effectiveNowMs);

    for (const windowId of expiredWindowIds) {
      const expiredSnapshot = snapshot.timers.activeDecisionWindows[windowId];

      context.bus.emit(
        'decision.window.closed',
        {
          windowId,
          tick: nextTick,
          accepted: false,
          actorId: expiredSnapshot?.actorId ?? undefined,
        },
        {
          emittedAtTick: nextTick,
          tags: ['engine:time', 'decision:expired'],
        },
      );
    }

    const totalBudgetMs =
      snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs;

    const timeoutReached =
      snapshot.outcome === null && elapsedMs >= totalBudgetMs;

    const nextOutcome = timeoutReached ? 'TIMEOUT' : snapshot.outcome;
    const nextWarnings = timeoutReached
      ? [
          ...new Set([
            ...snapshot.telemetry.warnings,
            'Season budget exhausted.',
          ]),
        ]
      : snapshot.telemetry.warnings;

    const nextHoldCharges = snapshot.modeState.holdEnabled
      ? this.resolveRuntimeHoldCharges(snapshot)
      : 0;

    const holdConsumedThisTick = nextHoldCharges < snapshot.timers.holdCharges;

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
        nextTickAtMs: timeoutReached ? null : effectiveNowMs,
        holdCharges: nextHoldCharges,
        activeDecisionWindows: this.decisionTimer.snapshot(),
        frozenWindowIds: this.decisionTimer.frozenIds(effectiveNowMs),
        lastTierChangeTick: tierChangedThisTick
          ? nextTick
          : snapshot.timers.lastTierChangeTick,
        tierInterpolationRemainingTicks:
          this.interpolator.getRemainingTransitionTicks(),
        forcedTierOverride: this.forcedTierOverride?.tier ?? null,
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
        tierChangedThisTick ? `time:tier:${effectiveTier.toLowerCase()}` : null,
        expiredWindowIds.length > 0 ? 'decision_window:expired' : null,
        holdConsumedThisTick ? 'time:hold-consumed' : null,
        timeoutReached ? 'run:timeout' : null,
        this.interpolator.isTransitioning() ? 'time:interpolating' : null,
        this.forcedTierOverride !== null ? 'time:forced-tier' : null,
      ),
    };

    this.runtimeHoldCharges = nextHoldCharges;
    this.runtimeHoldEnabled = snapshot.modeState.holdEnabled;

    const signals = [
      ...(
        phaseChanged
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
          : []
      ),
      ...(
        tierChangedThisTick
          ? [
              createEngineSignal(
                this.engineId,
                'INFO',
                'TIME_TIER_CHANGED',
                `Cadence tier changed from ${priorTier} to ${effectiveTier}.`,
                nextTick,
                ['tier-change', `from:${priorTier}`, `to:${effectiveTier}`],
              ),
            ]
          : []
      ),
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
      ...(
        holdConsumedThisTick
          ? [
              createEngineSignal(
                this.engineId,
                'INFO',
                'TIME_HOLD_CONSUMED',
                'A hold charge was consumed and persisted into timer state.',
                nextTick,
                ['hold', `remaining:${nextHoldCharges}`],
              ),
            ]
          : []
      ),
      ...(
        timeoutReached
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
          : []
      ),
      ...(
        this.forcedTierOverride !== null
          ? [
              createEngineSignal(
                this.engineId,
                'INFO',
                'TIME_FORCED_TIER_ACTIVE',
                `Forced cadence tier ${this.forcedTierOverride.tier} remains active for ${this.forcedTierOverride.ticksRemaining} more tick(s).`,
                nextTick,
                ['time', 'forced-tier'],
              ),
            ]
          : []
      ),
    ];

    this.consumeForcedOverrideTick();

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
        `lastResolvedTier=${this.lastResolvedTier}`,
        `forcedTier=${this.forcedTierOverride?.tier ?? 'none'}`,
        `forcedTicksRemaining=${this.forcedTierOverride?.ticksRemaining ?? 0}`,
        `holdConsumedThisRun=${this.holdConsumedThisRun}`,
        `runtimeHoldEnabled=${this.runtimeHoldEnabled}`,
        `runtimeHoldCharges=${this.runtimeHoldCharges ?? 'unknown'}`,
      ],
    );
  }

  /**
   * External integration points for card / mode / admin surfaces.
   * These do not change orchestration ownership; they only mutate
   * this engine's local runtime ledger.
   */
  public openDecisionWindow(
    windowId: string,
    closesAtMs: number,
    options: OpenDecisionWindowOptions = {},
  ): void {
    this.decisionTimer.open(windowId, closesAtMs, {
      timingClass: options.timingClass ?? 'FATE',
      label: options.label ?? windowId,
      source: options.source ?? 'time-engine',
      mode: options.mode ?? 'solo',
      openedAtTick: options.openedAtTick ?? 0,
      openedAtMs: options.openedAtMs,
      closesAtTick: options.closesAtTick ?? null,
      exclusive: options.exclusive ?? false,
      actorId: options.actorId ?? null,
      targetActorId: options.targetActorId ?? null,
      cardInstanceId: options.cardInstanceId ?? null,
      metadata: options.metadata,
    });
  }

  public resolveDecisionWindow(windowId: string): boolean {
    return this.decisionTimer.resolve(windowId);
  }

  public nullifyDecisionWindow(windowId: string): boolean {
    return this.decisionTimer.nullify(windowId);
  }

  /**
   * Exactly one hold is available per run from this engine's runtime perspective.
   * The persisted snapshot also carries hold charges, and this method now updates
   * the runtime ledger so the next tick persists the consumed charge durably.
   */
  public applyHold(
    windowId: string,
    nowMs: number,
    holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  ): boolean {
    if (!this.runtimeHoldEnabled || this.holdConsumedThisRun) {
      return false;
    }

    const availableHoldCharges = this.runtimeHoldCharges ?? 1;

    if (availableHoldCharges <= 0) {
      return false;
    }

    const applied = this.decisionTimer.freeze(
      windowId,
      Math.trunc(nowMs),
      holdDurationMs,
    );

    if (applied) {
      this.holdConsumedThisRun = true;
      this.runtimeHoldCharges = Math.max(0, availableHoldCharges - 1);
    }

    return applied;
  }

  public releaseHold(windowId: string): boolean {
    return this.decisionTimer.unfreeze(windowId);
  }

  /**
   * Forces a specific cadence tier for a fixed number of backend time steps.
   * This is a hard jump, not an interpolation.
   */
  public forceTickTier(tier: PressureTier, durationTicks: number): void {
    const normalizedDurationTicks = Math.max(0, Math.trunc(durationTicks));

    if (normalizedDurationTicks <= 0) {
      this.forcedTierOverride = null;
      return;
    }

    this.forcedTierOverride = {
      tier,
      ticksRemaining: normalizedDurationTicks,
    };

    this.lastResolvedTier = tier;
    this.interpolator.forceTier(tier);
  }

  private resolveCadenceTier(snapshot: RunStateSnapshot): PressureTier {
    if (
      this.forcedTierOverride !== null &&
      this.forcedTierOverride.ticksRemaining > 0
    ) {
      return this.forcedTierOverride.tier;
    }

    return snapshot.pressure.tier;
  }

  private consumeForcedOverrideTick(): void {
    if (this.forcedTierOverride === null) {
      return;
    }

    this.forcedTierOverride.ticksRemaining -= 1;

    if (this.forcedTierOverride.ticksRemaining <= 0) {
      this.forcedTierOverride = null;
    }
  }

  private syncRuntimeHoldLedger(snapshot: RunStateSnapshot): void {
    if (!snapshot.modeState.holdEnabled) {
      this.runtimeHoldEnabled = false;
      this.runtimeHoldCharges = 0;
      return;
    }

    this.runtimeHoldEnabled = true;

    const snapshotHoldCharges = Math.max(0, Math.trunc(snapshot.timers.holdCharges));

    if (this.runtimeHoldCharges === null) {
      this.runtimeHoldCharges = snapshotHoldCharges;
      return;
    }

    this.runtimeHoldCharges = Math.min(this.runtimeHoldCharges, snapshotHoldCharges);
  }

  private resolveRuntimeHoldCharges(snapshot: RunStateSnapshot): number {
    if (!snapshot.modeState.holdEnabled) {
      return 0;
    }

    if (this.runtimeHoldCharges === null) {
      return Math.max(0, Math.trunc(snapshot.timers.holdCharges));
    }

    return Math.max(0, Math.trunc(this.runtimeHoldCharges));
  }
}