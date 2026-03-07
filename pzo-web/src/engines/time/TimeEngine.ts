/**
 * TimeEngine.ts — PZO Engine 1 of 7: Time & Tick Management
 * ─────────────────────────────────────────────────────────────────────────────
 * Governs tick progression, tick tier (speed), and season budget.
 *
 * Called by EngineOrchestrator at:
 *   Step 1:  advanceTick(snapshot)       — increment tick, emit TICK_START
 *   Step 11: setTierFromPressure(score)  — adjust tick speed based on pressure
 *
 * Tick Tier Ladder:
 *   T0 SOVEREIGN         3000ms   ×1.0 pressure — slow, decisive
 *   T1 STABLE            2000ms   ×1.0 pressure — normal cadence
 *   T2 COMPRESSED        1500ms   ×1.4 pressure — building tension
 *   T3 CRISIS            1000ms   ×1.9 pressure — fast, stressful
 *   T4 COLLAPSE_IMMINENT  700ms   ×2.6 pressure — maximum speed
 *
 * FILE LOCATION: frontend/packages/engine/src/time/TimeEngine.ts
 * Density6 LLC · Point Zero One · Confidential
 */

import type { PressureReader } from '../pressure/types';

// ─── Tick Tier ────────────────────────────────────────────────────────────────

export enum TickTier {
  SOVEREIGN         = 'T0',
  STABLE            = 'T1',
  COMPRESSED        = 'T2',
  CRISIS            = 'T3',
  COLLAPSE_IMMINENT = 'T4',
}

interface TierConfig {
  tier:              TickTier;
  durationMs:        number;
  pressureMultiplier: number;
  /** Pressure score threshold to ENTER this tier (from below) */
  enterAbove:        number;
  /** Pressure score threshold to EXIT this tier (dropping below) */
  exitBelow:         number;
}

const TIER_CONFIGS: TierConfig[] = [
  { tier: TickTier.SOVEREIGN,         durationMs: 3000, pressureMultiplier: 1.0, enterAbove: 0,    exitBelow: 0    },
  { tier: TickTier.STABLE,            durationMs: 2000, pressureMultiplier: 1.0, enterAbove: 0,    exitBelow: 0    },
  { tier: TickTier.COMPRESSED,        durationMs: 1500, pressureMultiplier: 1.4, enterAbove: 0.35, exitBelow: 0.25 },
  { tier: TickTier.CRISIS,            durationMs: 1000, pressureMultiplier: 1.9, enterAbove: 0.60, exitBelow: 0.50 },
  { tier: TickTier.COLLAPSE_IMMINENT, durationMs: 700,  pressureMultiplier: 2.6, enterAbove: 0.85, exitBelow: 0.75 },
];

// ─── Event Bus Interface ──────────────────────────────────────────────────────

interface IEventBus {
  emit(event: string, payload?: unknown): void;
}

// ─── Minimal RunStateSnapshot fields used by TimeEngine ───────────────────────

interface TimeEngineSnapshot {
  readonly tick:          number;
  readonly pressureScore: number;
  readonly tickTier:      string;
  [key: string]: unknown;
}

// ─── TimeEngine ───────────────────────────────────────────────────────────────

export class TimeEngine {
  private eventBus:        IEventBus;
  private pressureReader:  PressureReader | null = null;

  // State
  private tickIndex:       number = 0;
  private currentTier:     TickTier = TickTier.STABLE;
  private tickDurationMs:  number = 2000;
  private seasonBudget:    number = 720;
  private ticksRemaining:  number = 720;
  private timeoutImminent: boolean = false;
  private decisionWindows: number = 0;
  private tierDwellTicks:  Record<TickTier, number> = {
    [TickTier.SOVEREIGN]: 0,
    [TickTier.STABLE]: 0,
    [TickTier.COMPRESSED]: 0,
    [TickTier.CRISIS]: 0,
    [TickTier.COLLAPSE_IMMINENT]: 0,
  };

  constructor(eventBus: IEventBus) {
    this.eventBus = eventBus;
  }

  // ─── Orchestrator API ───────────────────────────────────────────────────

  /**
   * Called by EngineOrchestrator to wire pressure feedback.
   */
  setPressureReader(reader: PressureReader): void {
    this.pressureReader = reader;
  }

  /**
   * Step 1 of tick sequence. Advances tick index, updates remaining budget,
   * emits TICK_START event.
   */
  advanceTick(snapshot: TimeEngineSnapshot): void {
    this.tickIndex++;
    this.ticksRemaining = Math.max(0, this.seasonBudget - this.tickIndex);
    this.timeoutImminent = this.ticksRemaining <= 20;

    // Track dwell time per tier
    this.tierDwellTicks[this.currentTier] =
      (this.tierDwellTicks[this.currentTier] ?? 0) + 1;

    // Emit tick start
    this.eventBus.emit('TICK_START', {
      tickIndex:       this.tickIndex,
      tickTier:        this.currentTier,
      tickDurationMs:  this.tickDurationMs,
      ticksRemaining:  this.ticksRemaining,
      seasonBudget:    this.seasonBudget,
      timeoutImminent: this.timeoutImminent,
    });

    // Check season timeout
    if (this.ticksRemaining <= 0) {
      this.eventBus.emit('SEASON_TIMEOUT', {
        tickIndex:    this.tickIndex,
        seasonBudget: this.seasonBudget,
      });
    }
  }

  /**
   * Step 11 of tick sequence. Maps pressure score to tick tier.
   * Tier change takes effect on the NEXT tick.
   * Hysteresis: different thresholds for entering vs exiting to prevent oscillation.
   */
  setTierFromPressure(pressureScore: number): void {
    const currentIdx = TIER_CONFIGS.findIndex(c => c.tier === this.currentTier);
    let newTier = this.currentTier;

    // Check if we should escalate (move to higher tier)
    for (let i = currentIdx + 1; i < TIER_CONFIGS.length; i++) {
      if (pressureScore >= TIER_CONFIGS[i].enterAbove) {
        newTier = TIER_CONFIGS[i].tier;
      } else {
        break;
      }
    }

    // Check if we should de-escalate (move to lower tier)
    if (newTier === this.currentTier) {
      for (let i = currentIdx - 1; i >= 0; i--) {
        if (pressureScore < TIER_CONFIGS[currentIdx].exitBelow) {
          newTier = TIER_CONFIGS[i].tier;
          break;
        }
      }
    }

    if (newTier !== this.currentTier) {
      const prevTier = this.currentTier;
      const prevDuration = this.tickDurationMs;
      this.currentTier = newTier;

      const config = TIER_CONFIGS.find(c => c.tier === newTier);
      this.tickDurationMs = config?.durationMs ?? 2000;

      this.eventBus.emit('TICK_TIER_CHANGED', {
        tickIndex:      this.tickIndex,
        previousTier:   prevTier,
        newTier:        newTier,
        previousDuration: prevDuration,
        newDuration:    this.tickDurationMs,
        pressureScore,
        multiplier:     config?.pressureMultiplier ?? 1.0,
      });
    }
  }

  // ─── Accessors ──────────────────────────────────────────────────────────

  getTickIndex():      number   { return this.tickIndex; }
  getCurrentTier():    TickTier { return this.currentTier; }
  getTickDurationMs(): number   { return this.tickDurationMs; }
  getTicksRemaining(): number   { return this.ticksRemaining; }
  getSeasonBudget():   number   { return this.seasonBudget; }
  isTimeoutImminent(): boolean  { return this.timeoutImminent; }

  getState() {
    return {
      tickIndex:       this.tickIndex,
      tickTier:        this.currentTier,
      tickDurationMs:  this.tickDurationMs,
      seasonBudget:    this.seasonBudget,
      ticksRemaining:  this.ticksRemaining,
      timeoutImminent: this.timeoutImminent,
      decisionWindows: this.decisionWindows,
    };
  }

  getTelemetry() {
    return {
      tickTierDwell:   { ...this.tierDwellTicks },
      totalTicks:      this.tickIndex,
      finalTier:       this.currentTier,
    };
  }

  // ─── Configuration ──────────────────────────────────────────────────────

  setSeasonBudget(budget: number): void {
    this.seasonBudget = budget;
    this.ticksRemaining = Math.max(0, budget - this.tickIndex);
  }

  /**
   * Reset for new run.
   */
  reset(): void {
    this.tickIndex = 0;
    this.currentTier = TickTier.STABLE;
    this.tickDurationMs = 2000;
    this.ticksRemaining = this.seasonBudget;
    this.timeoutImminent = false;
    this.decisionWindows = 0;
    this.tierDwellTicks = {
      [TickTier.SOVEREIGN]: 0,
      [TickTier.STABLE]: 0,
      [TickTier.COMPRESSED]: 0,
      [TickTier.CRISIS]: 0,
      [TickTier.COLLAPSE_IMMINENT]: 0,
    };
  }
}
