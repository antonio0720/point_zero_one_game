/**
 * FILE: pzo-web/src/engines/cascade/PositiveCascadeTracker.ts
 *
 * Manages all 5 positive cascade sustaining states. Called at Step 1 of
 * tickCascade() — BEFORE negative link execution — so positive states can
 * influence game state that negative link recovery reads.
 *
 * Rules:
 *   ✦ SUSTAINED_STATE cascades: dissolve immediately when sustaining condition breaks.
 *   ✦ ONE_TIME_EVENT cascades: fire once per qualifying condition per run.
 *   ✦ PCHAIN_FORTIFIED_SHIELDS: PAUSES (not dissolves) when any layer drops below 80%.
 *     Resumes without re-accumulation when all 4 layers return to ≥80%.
 *   ✦ PCHAIN_NEMESIS_BROKEN: fires once per unique botId. Guards against re-firing.
 *   ✦ PCHAIN_SOVEREIGN_APPROACH: PAUSES (not dissolves) when netWorth drops below 1.5× threshold.
 *   ✦ No grace period. No partial retention. Conditions lapse → cascade dissolves.
 *
 * May import: types.ts, ShieldReader interface
 * Must NEVER import: any engine class
 *
 * Density6 LLC · Point Zero One · Engine 6 of 7 · Confidential
 */
import {
  ChainId,
  ActivePositiveCascade,
  RecoveryActionLog,
  CASCADE_CONSTANTS,
} from './types';
import type { ShieldReader } from '../shield/types';

export interface PositiveTickResult {
  newlyActivated:      ChainId[];
  dissolved:           ChainId[];
  paused:              ChainId[];
  resumed:             ChainId[];
  stillActive:         ChainId[];
  nemesisBrokenBotId?: string;
}

export class PositiveCascadeTracker {
  // All active/paused positive cascade states
  private active = new Map<ChainId, ActivePositiveCascade>();
  // Tracks which botIds have already triggered NEMESIS_BROKEN this run
  private readonly nemesisFiredBots = new Set<string>();
  // Tracks MOMENTUM_LOCK state — set by CascadeEngine when MOMENTUM_LOCK link fires
  private momentumLocked = new Map<ChainId, number>(); // chainId → expiryTick

  constructor(private readonly shieldReader: ShieldReader) {}

  // ── Main Tick Evaluation ───────────────────────────────────────────────────

  /**
   * Evaluates all 5 positive cascade conditions.
   * Must be called BEFORE processTickLinks() in every tick.
   */
  public evaluateTick(
    tick:     number,
    runState: any,
    log:      RecoveryActionLog
  ): PositiveTickResult {
    const result: PositiveTickResult = {
      newlyActivated: [],
      dissolved:      [],
      paused:         [],
      resumed:        [],
      stillActive:    [],
    };

    // ── PCHAIN_SUSTAINED_CASHFLOW ──────────────────────────────────────────
    // Activates: 10+ consecutive positive-flow ticks
    // Sustains: income > expenses every tick
    // Dissolves: any tick where cashflow goes negative
    this.evalSustaining(
      ChainId.PCHAIN_SUSTAINED_CASHFLOW,
      log.consecutivePositiveFlowTicks >= CASCADE_CONSTANTS.CASHFLOW_MOMENTUM_TICKS,
      tick,
      result
    );

    // ── PCHAIN_FORTIFIED_SHIELDS ───────────────────────────────────────────
    // Activates: all 4 layers ≥80% for 5 consecutive ticks
    // Sustains: all 4 layers ≥80% each tick (PAUSES if any drop below)
    // PAUSE: resumes without re-accumulation when all 4 return ≥80%
    // DISSOLVES: only via MOMENTUM_LOCK targeting this chain
    const isChainMomentumLocked = this.isChainMomentumLocked(ChainId.PCHAIN_FORTIFIED_SHIELDS, tick);
    if (!isChainMomentumLocked) {
      const isFortified = log.consecutiveFortifiedTicks >= CASCADE_CONSTANTS.FORTIFIED_TICKS_REQUIRED;
      const existing    = this.active.get(ChainId.PCHAIN_FORTIFIED_SHIELDS);

      if (isFortified) {
        if (!existing) {
          // New activation
          this.active.set(ChainId.PCHAIN_FORTIFIED_SHIELDS, {
            pchainId:               ChainId.PCHAIN_FORTIFIED_SHIELDS,
            activatedAtTick:        tick,
            ticksActive:            0,
            isActive:               true,
            isPaused:               false,
            lastSustainingCheckTick:tick,
          });
          result.newlyActivated.push(ChainId.PCHAIN_FORTIFIED_SHIELDS);
        } else if (existing.isPaused) {
          // Resume from pause — no re-accumulation required
          existing.isPaused               = false;
          existing.isActive               = true;
          existing.lastSustainingCheckTick = tick;
          result.resumed.push(ChainId.PCHAIN_FORTIFIED_SHIELDS);
        } else {
          existing.lastSustainingCheckTick = tick;
          result.stillActive.push(ChainId.PCHAIN_FORTIFIED_SHIELDS);
        }
      } else if (existing && existing.isActive && !existing.isPaused) {
        // Layer dropped below 80% — PAUSE (not dissolve)
        existing.isPaused = true;
        existing.isActive = false;
        result.paused.push(ChainId.PCHAIN_FORTIFIED_SHIELDS);
      }
    } else if (this.active.get(ChainId.PCHAIN_FORTIFIED_SHIELDS)?.isActive) {
      // MOMENTUM_LOCK is active — force dissolve
      const entry = this.active.get(ChainId.PCHAIN_FORTIFIED_SHIELDS)!;
      entry.isActive = false;
      entry.isPaused = false;
      result.dissolved.push(ChainId.PCHAIN_FORTIFIED_SHIELDS);
    }

    // ── PCHAIN_STREAK_MASTERY ──────────────────────────────────────────────
    // Activates + Sustains: 5+ consecutive clean ticks
    // Clean tick = positive cashflow + bot retreating/neutralized + zero active negative chains
    this.evalSustaining(
      ChainId.PCHAIN_STREAK_MASTERY,
      log.consecutiveCleanTicks >= CASCADE_CONSTANTS.STREAK_MASTERY_TICKS,
      tick,
      result
    );

    // ── PCHAIN_SOVEREIGN_APPROACH ──────────────────────────────────────────
    // Activates: netWorth >= 2× freedomThreshold (ONE_TIME_UNLOCK then SUSTAINED)
    // PAUSES: netWorth drops below 1.5× threshold
    // Resumes: netWorth recovers above 2× — no re-earning required
    {
      const netWorth        = runState.netWorth ?? 0;
      const threshold       = runState.freedomThreshold ?? 1;
      const isAboveActivate = netWorth >= threshold * CASCADE_CONSTANTS.SOVEREIGN_APPROACH_MULTIPLIER;
      const isAbovePause    = netWorth >= threshold * CASCADE_CONSTANTS.SOVEREIGN_PAUSE_THRESHOLD;
      const existing        = this.active.get(ChainId.PCHAIN_SOVEREIGN_APPROACH);

      if (isAboveActivate) {
        if (!existing) {
          this.active.set(ChainId.PCHAIN_SOVEREIGN_APPROACH, {
            pchainId:               ChainId.PCHAIN_SOVEREIGN_APPROACH,
            activatedAtTick:        tick,
            ticksActive:            0,
            isActive:               true,
            isPaused:               false,
            lastSustainingCheckTick:tick,
          });
          result.newlyActivated.push(ChainId.PCHAIN_SOVEREIGN_APPROACH);
        } else if (existing.isPaused) {
          existing.isPaused               = false;
          existing.isActive               = true;
          existing.lastSustainingCheckTick = tick;
          result.resumed.push(ChainId.PCHAIN_SOVEREIGN_APPROACH);
        } else {
          existing.lastSustainingCheckTick = tick;
          result.stillActive.push(ChainId.PCHAIN_SOVEREIGN_APPROACH);
        }
      } else if (!isAbovePause && existing?.isActive && !existing.isPaused) {
        // Below pause threshold — PAUSE
        existing.isPaused = true;
        existing.isActive = false;
        result.paused.push(ChainId.PCHAIN_SOVEREIGN_APPROACH);
      } else if (existing?.isActive) {
        result.stillActive.push(ChainId.PCHAIN_SOVEREIGN_APPROACH);
      }
    }

    // ── PCHAIN_NEMESIS_BROKEN ──────────────────────────────────────────────
    // ONE_TIME_EVENT: fires once per unique botId when neutralized twice in a run
    // Guards against re-firing with nemesisFiredBots Set
    for (const [botId, count] of log.nemesisNeutralizationCount.entries()) {
      if (
        count >= CASCADE_CONSTANTS.NEMESIS_NEUTRALIZE_COUNT &&
        !this.nemesisFiredBots.has(botId)
      ) {
        this.nemesisFiredBots.add(botId);
        result.newlyActivated.push(ChainId.PCHAIN_NEMESIS_BROKEN);
        result.nemesisBrokenBotId = botId;
        // NEMESIS_BROKEN is one-time — no persistent state entry needed
      }
    }

    // Increment ticksActive for all truly active cascades
    for (const [, cascade] of this.active) {
      if (cascade.isActive && !cascade.isPaused) {
        cascade.ticksActive++;
      }
    }

    return result;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Standard SUSTAINED_STATE evaluation — activates when condMet, dissolves when !condMet.
   * No pause logic. No re-accumulation distinction.
   */
  private evalSustaining(
    id:      ChainId,
    condMet: boolean,
    tick:    number,
    result:  PositiveTickResult
  ): void {
    const existing = this.active.get(id);

    if (condMet) {
      if (!existing || (!existing.isActive && !existing.isPaused)) {
        this.active.set(id, {
          pchainId:               id,
          activatedAtTick:        tick,
          ticksActive:            0,
          isActive:               true,
          isPaused:               false,
          lastSustainingCheckTick:tick,
        });
        result.newlyActivated.push(id);
      } else if (existing.isActive) {
        existing.lastSustainingCheckTick = tick;
        result.stillActive.push(id);
      }
    } else {
      if (existing?.isActive) {
        existing.isActive = false;
        existing.isPaused = false;
        result.dissolved.push(id);
      }
    }
  }

  // ── Momentum Lock Management ───────────────────────────────────────────────

  /**
   * Called by CascadeEngine when a MOMENTUM_LOCK effect fires.
   * Records the expiry tick for the targeted positive chain.
   */
  public applyMomentumLock(targetChainId: ChainId, currentTick: number, durationTicks: number): void {
    this.momentumLocked.set(targetChainId, currentTick + durationTicks);
  }

  private isChainMomentumLocked(chainId: ChainId, currentTick: number): boolean {
    const expiryTick = this.momentumLocked.get(chainId);
    if (expiryTick === undefined) return false;
    if (currentTick >= expiryTick) {
      this.momentumLocked.delete(chainId);
      return false;
    }
    return true;
  }

  // ── Query Accessors ────────────────────────────────────────────────────────

  public isActive(id: ChainId): boolean {
    const entry = this.active.get(id);
    return entry?.isActive === true && entry?.isPaused === false;
  }

  public isPaused(id: ChainId): boolean {
    return this.active.get(id)?.isPaused === true;
  }

  public getActiveCascades(): ActivePositiveCascade[] {
    return [...this.active.values()].filter(a => a.isActive && !a.isPaused);
  }

  public getAllCascades(): ActivePositiveCascade[] {
    return [...this.active.values()];
  }

  public getTicksActive(id: ChainId): number {
    return this.active.get(id)?.ticksActive ?? 0;
  }

  public getActiveCount(): number {
    return this.getActiveCascades().length;
  }

  public reset(): void {
    this.active.clear();
    this.nemesisFiredBots.clear();
    this.momentumLocked.clear();
  }
}