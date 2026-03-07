/**
 * FILE: /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/pzo-web/src/engines/tension/TensionDecayController.ts
 * Computes the tension delta each tick from queue state.
 * Returns a delta that TensionEngine applies to the running score.
 *
 * KEY RULE: Pressure amplifier applies ONLY to positive contributions.
 * Negative contributions (decay) are NOT amplified — pressure makes tension
 * climb faster but does NOT make recovery harder.
 *
 * IMPORTS: types.ts only. Never imports any other engine module.
 *
 * Density6 LLC · Point Zero One · Engine 3 of 7 · Confidential
 */
import {
  AnticipationEntry,
  EntryState,
  PressureTier,
  TENSION_CONSTANTS,
  PRESSURE_TENSION_AMPLIFIERS,
} from './types';

// ── Compute Input ──────────────────────────────────────────────────────────
export interface DecayComputeInput {
  activeEntries: AnticipationEntry[];      // QUEUED + ARRIVED entries
  expiredEntries: AnticipationEntry[];     // all EXPIRED entries this run (ghost penalty source)
  mitigatingEntries: AnticipationEntry[];  // MITIGATED entries still in decay window
  pressureTier: PressureTier;             // for amplifier lookup
  visibilityAwarenessBonus: number;       // flat bonus from visibility state (0.0 or 0.05)
  queueIsEmpty: boolean;                  // true if 0 active entries (QUEUED + ARRIVED = 0)
  sovereigntyMilestoneReached: boolean;   // one-time freedom milestone bonus flag
}

// ── Compute Result ─────────────────────────────────────────────────────────
export interface DecayComputeResult {
  rawDelta: number;       // sum of all contributions before amplification
  amplifiedDelta: number; // positive contributions amplified, negative unchanged
  contributionBreakdown: {
    queuedThreats: number;    // positive — from QUEUED entries
    arrivedThreats: number;   // positive — from ARRIVED entries (higher than QUEUED)
    expiredGhosts: number;    // positive — lingering ghost penalty per expired threat
    mitigationDecay: number;  // negative — decay from post-mitigation window
    nullifyDecay: number;     // negative — partial decay from nullified threats
    emptyQueueBonus: number;  // negative — bonus when board is clear
    visibilityBonus: number;  // positive — awareness dread (+0.05 for TELEGRAPHED/EXPOSED)
    sovereigntyBonus: number; // negative — one-time flat drop on freedom milestone
  };
}

export class TensionDecayController {
  // Sovereignty bonus fires exactly once per run, tracked by this flag.
  // Reset in reset() at run start. NOT reset mid-run even if multiple milestones crossed.
  private sovereigntyBonusConsumed: boolean = false;

  // ── Core Compute ───────────────────────────────────────────────────────

  /**
   * Compute the tension delta for one tick.
   * All components calculated independently then summed.
   * Positive delta = tension builds. Negative delta = tension decays.
   *
   * AMPLIFICATION RULE:
   *   amplifiedDelta = (positiveContributions * pressureAmplifier) + negativeContributions
   *   Negative (decay) is NOT multiplied by amplifier.
   */
  public computeDelta(input: DecayComputeInput): DecayComputeResult {
    const breakdown = {
      queuedThreats:    0,
      arrivedThreats:   0,
      expiredGhosts:    0,
      mitigationDecay:  0,
      nullifyDecay:     0,
      emptyQueueBonus:  0,
      visibilityBonus:  0,
      sovereigntyBonus: 0,
    };

    // ── Positive contributions (tension builds) ──────────────────────────

    for (const entry of input.activeEntries) {
      if (entry.state === EntryState.QUEUED) {
        breakdown.queuedThreats += TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
      } else if (entry.state === EntryState.ARRIVED) {
        breakdown.arrivedThreats += TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
      }
    }

    // Ghost penalties — persist for the ENTIRE run. Never expire.
    // +0.08 per expired threat per tick, forever.
    for (const _entry of input.expiredEntries) {
      breakdown.expiredGhosts += TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
    }

    // Visibility awareness dread bonus — knowing the countdown increases dread
    breakdown.visibilityBonus = input.visibilityAwarenessBonus;

    // ── Negative contributions (tension decays) ──────────────────────────

    // Post-mitigation decay sessions (MITIGATED entries within decay window)
    for (const entry of input.mitigatingEntries) {
      if (entry.state === EntryState.MITIGATED) {
        breakdown.mitigationDecay -= TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
      } else if (entry.state === EntryState.NULLIFIED) {
        breakdown.nullifyDecay -= TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;
      }
    }

    // Empty queue bonus — reward for clearing the board entirely
    // NOTE: This applies even if mitigatingEntries is non-empty (decay sessions co-exist)
    if (input.queueIsEmpty) {
      breakdown.emptyQueueBonus -= TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;
    }

    // Sovereignty bonus — one-time large drop. Consumed flag prevents repeat firing.
    if (input.sovereigntyMilestoneReached && !this.sovereigntyBonusConsumed) {
      breakdown.sovereigntyBonus -= TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY;
      this.sovereigntyBonusConsumed = true;
    }

    // ── Sum raw delta ────────────────────────────────────────────────────

    const rawDelta =
      breakdown.queuedThreats +
      breakdown.arrivedThreats +
      breakdown.expiredGhosts +
      breakdown.mitigationDecay +
      breakdown.nullifyDecay +
      breakdown.emptyQueueBonus +
      breakdown.visibilityBonus +
      breakdown.sovereigntyBonus;

    // ── Amplify positive contributions only ──────────────────────────────

    const amplifier = PRESSURE_TENSION_AMPLIFIERS[input.pressureTier];

    const positiveRaw =
      breakdown.queuedThreats +
      breakdown.arrivedThreats +
      breakdown.expiredGhosts +
      breakdown.visibilityBonus;

    const negativeRaw =
      breakdown.mitigationDecay +
      breakdown.nullifyDecay +
      breakdown.emptyQueueBonus +
      breakdown.sovereigntyBonus;

    // CRITICAL: negative contributions are NOT multiplied by amplifier.
    const amplifiedDelta = (positiveRaw * amplifier) + negativeRaw;

    return { rawDelta, amplifiedDelta, contributionBreakdown: breakdown };
  }

  // ── Reset ──────────────────────────────────────────────────────────────

  /** Full reset — called at run start. Clears sovereignty consumed flag. */
  public reset(): void {
    this.sovereigntyBonusConsumed = false;
  }

  /**
   * Allow sovereignty bonus to fire again.
   * Only called if a run resets mid-game (not normal gameplay).
   */
  public resetSovereigntyBonus(): void {
    this.sovereigntyBonusConsumed = false;
  }
}