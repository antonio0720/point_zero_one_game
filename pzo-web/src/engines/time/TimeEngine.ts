/**
 * TimeEngine.ts — PZO Engine 1 of 7: Time & Tick Management
 * ─────────────────────────────────────────────────────────────────────────────
 * Governs tick progression, tick tier (speed), and season budget.
 *
 * Called by EngineOrchestrator at:
 *   Step 1:  advanceTick(snapshot)       — increment tick, emit tick lifecycle
 *   Step 11: setTierFromPressure(score)  — adjust tick speed based on pressure
 *
 * Tick Tier Ladder:
 *   T0 SOVEREIGN          3000ms  ×1.0 pressure — slow, decisive
 *   T1 STABLE             2000ms  ×1.0 pressure — normal cadence
 *   T2 COMPRESSED         1500ms  ×1.4 pressure — building tension
 *   T3 CRISIS             1000ms  ×1.9 pressure — fast, stressful
 *   T4 COLLAPSE_IMMINENT   700ms  ×2.6 pressure — maximum speed
 *
 * Density6 LLC · Point Zero One · Confidential
 */

import type { PressureReader } from '../pressure/types';
import {
  createEmptyDecisionWindowLifecycleMetrics,
  createEmptyRunTimeoutFlags,
  type TelemetryEnvelopeV2,
  type TickBudget,
  type TierTransitionRecord,
  type TimeEngineStateSnapshot,
} from './types';

export enum TickTier {
  SOVEREIGN = 'T0',
  STABLE = 'T1',
  COMPRESSED = 'T2',
  CRISIS = 'T3',
  COLLAPSE_IMMINENT = 'T4',
}

interface TierConfig {
  tier: TickTier;
  durationMs: number;
  pressureMultiplier: number;
  enterAbove: number;
  exitBelow: number;
}

const TIER_CONFIGS: TierConfig[] = [
  { tier: TickTier.SOVEREIGN, durationMs: 3000, pressureMultiplier: 1.0, enterAbove: 0.0, exitBelow: 0.0 },
  { tier: TickTier.STABLE, durationMs: 2000, pressureMultiplier: 1.0, enterAbove: 0.0, exitBelow: 0.0 },
  { tier: TickTier.COMPRESSED, durationMs: 1500, pressureMultiplier: 1.4, enterAbove: 0.35, exitBelow: 0.25 },
  { tier: TickTier.CRISIS, durationMs: 1000, pressureMultiplier: 1.9, enterAbove: 0.60, exitBelow: 0.50 },
  { tier: TickTier.COLLAPSE_IMMINENT, durationMs: 700, pressureMultiplier: 2.6, enterAbove: 0.85, exitBelow: 0.75 },
];

interface IEventBus {
  emit(event: string, payload?: unknown): void;
}

interface TimeEngineSnapshot {
  readonly tick: number;
  readonly pressureScore: number;
  readonly tickTier: string;
  [key: string]: unknown;
}

export class TimeEngine {
  private readonly eventBus: IEventBus;
  private pressureReader: PressureReader | null = null;

  private tickIndex = 0;
  private currentTier: TickTier = TickTier.STABLE;
  private tickDurationMs = 2000;
  private seasonBudget = 720;
  private ticksRemaining = 720;
  private timeoutImminent = false;
  private decisionWindows = 0;

  private readonly tierTransitions: TierTransitionRecord[] = [];

  private tierDwellTicks: Record<TickTier, number> = {
    [TickTier.SOVEREIGN]: 0,
    [TickTier.STABLE]: 0,
    [TickTier.COMPRESSED]: 0,
    [TickTier.CRISIS]: 0,
    [TickTier.COLLAPSE_IMMINENT]: 0,
  };

  private startedAtMs: number | null = null;
  private completedAtMs: number | null = null;
  private completionReason: 'TIMEOUT' | 'RUN_ENDED' | 'ABANDONED' | 'UNKNOWN' | null = null;

  public constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  public setPressureReader(reader: PressureReader): void {
    this.pressureReader = reader;
  }

  public advanceTick(_snapshot: TimeEngineSnapshot): void {
    const isFirstTickOfRun = this.tickIndex === 0;

    this.tickIndex += 1;
    this.ticksRemaining = Math.max(0, this.seasonBudget - this.tickIndex);
    this.timeoutImminent = this.ticksRemaining <= 20;
    this.tierDwellTicks[this.currentTier] += 1;

    if (isFirstTickOfRun) {
      this.startedAtMs = Date.now();
      this.completedAtMs = null;
      this.completionReason = null;

      this.eventBus.emit('TIME_ENGINE_START', {
        tickIndex: this.tickIndex,
        initialTier: this.currentTier,
        tickTier: this.currentTier,
        tickDurationMs: this.tickDurationMs,
        seasonBudget: this.seasonBudget,
        ticksRemaining: this.ticksRemaining,
      });
    }

    const tickPayload = {
      tickIndex: this.tickIndex,
      tickTier: this.currentTier,
      tickDurationMs: this.tickDurationMs,
      ticksRemaining: this.ticksRemaining,
      seasonBudget: this.seasonBudget,
      timeoutImminent: this.timeoutImminent,
    };

    this.eventBus.emit('TICK_START', tickPayload);
    this.eventBus.emit('TIME_ENGINE_TICK', tickPayload);
    this.eventBus.emit('TIME_TICK_ADVANCED', tickPayload);

    if (this.timeoutImminent) {
      this.eventBus.emit('TIME_BUDGET_WARNING', tickPayload);
    }

    if (this.ticksRemaining <= 0) {
      this.eventBus.emit('SEASON_TIMEOUT', {
        tickIndex: this.tickIndex,
        seasonBudget: this.seasonBudget,
      });

      this.completeRun('TIMEOUT');
    }
  }

  public setTierFromPressure(pressureScore: number): void {
    const currentIdx = TIER_CONFIGS.findIndex((config) => config.tier === this.currentTier);
    let newTier = this.currentTier;

    for (let i = currentIdx + 1; i < TIER_CONFIGS.length; i += 1) {
      if (pressureScore >= TIER_CONFIGS[i].enterAbove) {
        newTier = TIER_CONFIGS[i].tier;
      } else {
        break;
      }
    }

    if (newTier === this.currentTier) {
      for (let i = currentIdx - 1; i >= 0; i -= 1) {
        if (pressureScore < TIER_CONFIGS[currentIdx].exitBelow) {
          newTier = TIER_CONFIGS[i].tier;
          break;
        }
      }
    }

    if (newTier !== this.currentTier) {
      const previousTier = this.currentTier;
      const previousDuration = this.tickDurationMs;
      const nextConfig = TIER_CONFIGS.find((config) => config.tier === newTier);

      this.currentTier = newTier;
      this.tickDurationMs = nextConfig?.durationMs ?? this.tickDurationMs;

      const payload = {
        tickIndex: this.tickIndex,
        previousTier,
        newTier,
        previousDuration,
        newDuration: this.tickDurationMs,
        pressureScore,
        multiplier: nextConfig?.pressureMultiplier ?? 1.0,
      };

      this.tierTransitions.push({
        tickIndex: this.tickIndex,
        fromTier: previousTier,
        toTier: newTier,
        pressureScore,
        previousDurationMs: previousDuration,
        newDurationMs: this.tickDurationMs,
        multiplier: nextConfig?.pressureMultiplier ?? 1.0,
        timestamp: Date.now(),
      });

      this.eventBus.emit('TICK_TIER_CHANGED', payload);
      this.eventBus.emit('TIME_TIER_CHANGED', payload);
    }
  }

  public completeRun(
    reason: 'TIMEOUT' | 'RUN_ENDED' | 'ABANDONED' | 'UNKNOWN' = 'RUN_ENDED',
  ): void {
    if (this.completedAtMs !== null) {
      return;
    }

    this.completedAtMs = Date.now();
    this.completionReason = reason;

    this.eventBus.emit('TIME_ENGINE_COMPLETE', {
      tickIndex: this.tickIndex,
      tickTier: this.currentTier,
      tickDurationMs: this.tickDurationMs,
      ticksRemaining: this.ticksRemaining,
      seasonBudget: this.seasonBudget,
      timeoutImminent: this.timeoutImminent,
      reason,
    });
  }

  public setDecisionWindowCount(count: number): void {
    this.decisionWindows = Math.max(0, Math.floor(count));
  }

  public incrementDecisionWindowCount(delta = 1): void {
    this.decisionWindows = Math.max(0, this.decisionWindows + Math.floor(delta));
  }

  public getTickIndex(): number {
    return this.tickIndex;
  }

  public getCurrentTier(): TickTier {
    return this.currentTier;
  }

  public getTickDurationMs(): number {
    return this.tickDurationMs;
  }

  public getTicksRemaining(): number {
    return this.ticksRemaining;
  }

  public getSeasonBudget(): number {
    return this.seasonBudget;
  }

  public isTimeoutImminent(): boolean {
    return this.timeoutImminent;
  }

  public getBudgetSnapshot(): TickBudget {
    return {
      allocated: this.seasonBudget,
      consumed: this.tickIndex,
      remaining: this.ticksRemaining,
    };
  }

  public getState(): TimeEngineStateSnapshot {
    return {
      tickIndex: this.tickIndex,
      tickTier: this.currentTier,
      tickDurationMs: this.tickDurationMs,
      seasonBudget: this.seasonBudget,
      ticksRemaining: this.ticksRemaining,
      timeoutImminent: this.timeoutImminent,
      decisionWindows: this.decisionWindows,
    };
  }

  public captureStateSnapshot(): TimeEngineStateSnapshot {
    return this.getState();
  }

  public getTelemetry(): TelemetryEnvelopeV2 {
    return {
      tickTierDwell: {
        T0: this.tierDwellTicks[TickTier.SOVEREIGN],
        T1: this.tierDwellTicks[TickTier.STABLE],
        T2: this.tierDwellTicks[TickTier.COMPRESSED],
        T3: this.tierDwellTicks[TickTier.CRISIS],
        T4: this.tierDwellTicks[TickTier.COLLAPSE_IMMINENT],
      },
      tierTransitions: this.tierTransitions.map((transition) => ({ ...transition })),
      decisionWindowLifecycleMetrics: createEmptyDecisionWindowLifecycleMetrics(),
      runTimeoutFlags: {
        ...createEmptyRunTimeoutFlags(),
        timeoutImminent: this.timeoutImminent,
        timeoutOccurred: this.completionReason === 'TIMEOUT',
        completed: this.completedAtMs !== null,
        completionReason: this.completionReason,
        runStartedAtMs: this.startedAtMs,
        runCompletedAtMs: this.completedAtMs,
      },
    };
  }

  public setSeasonBudget(budget: number): void {
    this.seasonBudget = Math.max(1, Math.floor(budget));
    this.ticksRemaining = Math.max(0, this.seasonBudget - this.tickIndex);
    this.timeoutImminent = this.ticksRemaining <= 20;
  }

  public reset(): void {
    this.tickIndex = 0;
    this.currentTier = TickTier.STABLE;
    this.tickDurationMs = 2000;
    this.ticksRemaining = this.seasonBudget;
    this.timeoutImminent = false;
    this.decisionWindows = 0;
    this.tierTransitions.length = 0;
    this.startedAtMs = null;
    this.completedAtMs = null;
    this.completionReason = null;

    this.tierDwellTicks = {
      [TickTier.SOVEREIGN]: 0,
      [TickTier.STABLE]: 0,
      [TickTier.COMPRESSED]: 0,
      [TickTier.CRISIS]: 0,
      [TickTier.COLLAPSE_IMMINENT]: 0,
    };
  }
}