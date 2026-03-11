/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION DECAY CONTROLLER
 * /backend/src/game/engine/tension/TensionDecayController.ts
 * ====================================================================== */

import { ENTRY_STATE, PRESSURE_TENSION_AMPLIFIERS, TENSION_CONSTANTS, type DecayComputeInput, type DecayComputeResult } from './types';

export class TensionDecayController {
  private sovereigntyBonusConsumed = false;

  public computeDelta(input: DecayComputeInput): DecayComputeResult {
    const contributionBreakdown = {
      queuedThreats: 0,
      arrivedThreats: 0,
      expiredGhosts: 0,
      mitigationDecay: 0,
      nullifyDecay: 0,
      emptyQueueBonus: 0,
      visibilityBonus: 0,
      sovereigntyBonus: 0,
    };

    for (const entry of input.activeEntries) {
      if (entry.state === ENTRY_STATE.QUEUED) {
        contributionBreakdown.queuedThreats +=
          TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK * entry.severityWeight;
      } else if (entry.state === ENTRY_STATE.ARRIVED) {
        contributionBreakdown.arrivedThreats +=
          TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK * entry.severityWeight;
      }
    }

    for (const entry of input.expiredEntries) {
      contributionBreakdown.expiredGhosts +=
        TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK * entry.severityWeight;
    }

    for (const entry of input.relievedEntries) {
      if (entry.state === ENTRY_STATE.MITIGATED) {
        contributionBreakdown.mitigationDecay -=
          TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK * entry.severityWeight;
      } else if (entry.state === ENTRY_STATE.NULLIFIED) {
        contributionBreakdown.nullifyDecay -=
          TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK * entry.severityWeight;
      }
    }

    if (input.queueIsEmpty) {
      contributionBreakdown.emptyQueueBonus -= TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;
    }

    contributionBreakdown.visibilityBonus = input.visibilityAwarenessBonus;

    if (input.sovereigntyMilestoneReached && !this.sovereigntyBonusConsumed) {
      contributionBreakdown.sovereigntyBonus -=
        TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY;
      this.sovereigntyBonusConsumed = true;
    }

    const rawDelta =
      contributionBreakdown.queuedThreats +
      contributionBreakdown.arrivedThreats +
      contributionBreakdown.expiredGhosts +
      contributionBreakdown.mitigationDecay +
      contributionBreakdown.nullifyDecay +
      contributionBreakdown.emptyQueueBonus +
      contributionBreakdown.visibilityBonus +
      contributionBreakdown.sovereigntyBonus;

    const positiveRaw =
      contributionBreakdown.queuedThreats +
      contributionBreakdown.arrivedThreats +
      contributionBreakdown.expiredGhosts +
      contributionBreakdown.visibilityBonus;

    const negativeRaw =
      contributionBreakdown.mitigationDecay +
      contributionBreakdown.nullifyDecay +
      contributionBreakdown.emptyQueueBonus +
      contributionBreakdown.sovereigntyBonus;

    const amplifiedDelta =
      positiveRaw * PRESSURE_TENSION_AMPLIFIERS[input.pressureTier] + negativeRaw;

    return {
      rawDelta,
      amplifiedDelta,
      contributionBreakdown,
    };
  }

  public reset(): void {
    this.sovereigntyBonusConsumed = false;
  }
}