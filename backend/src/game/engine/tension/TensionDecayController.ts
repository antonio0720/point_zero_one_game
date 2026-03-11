/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION DECAY CONTROLLER
 * /backend/src/game/engine/tension/TensionDecayController.ts
 * ====================================================================== */

import {
  ENTRY_STATE,
  PRESSURE_TENSION_AMPLIFIERS,
  TENSION_CONSTANTS,
  type DecayComputeInput,
  type DecayComputeResult,
  type DecayContributionBreakdown,
} from './types';

type MutableDecayContributionBreakdown = {
  -readonly [K in keyof DecayContributionBreakdown]: DecayContributionBreakdown[K];
};

export class TensionDecayController {
  private sovereigntyBonusConsumed = false;

  public computeDelta(input: DecayComputeInput): DecayComputeResult {
    const contributionBreakdown = this.createMutableBreakdown();

    this.applyActiveEntryPressure(contributionBreakdown, input);
    this.applyExpiredEntryPressure(contributionBreakdown, input);
    this.applyReliefDecay(contributionBreakdown, input);
    this.applyEmptyQueueRecovery(contributionBreakdown, input);
    this.applyVisibilityAwareness(contributionBreakdown, input);
    this.applySovereigntyRelief(contributionBreakdown, input);

    const rawDelta = this.computeRawDelta(contributionBreakdown);
    const positiveRaw = this.computePositiveRaw(contributionBreakdown);
    const negativeRaw = this.computeNegativeRaw(contributionBreakdown);

    const amplifiedDelta =
      positiveRaw * PRESSURE_TENSION_AMPLIFIERS[input.pressureTier] +
      negativeRaw;

    return {
      rawDelta,
      amplifiedDelta,
      contributionBreakdown: Object.freeze({
        ...contributionBreakdown,
      }),
    };
  }

  public reset(): void {
    this.sovereigntyBonusConsumed = false;
  }

  public resetSovereigntyBonus(): void {
    this.sovereigntyBonusConsumed = false;
  }

  private createMutableBreakdown(): MutableDecayContributionBreakdown {
    return {
      queuedThreats: 0,
      arrivedThreats: 0,
      expiredGhosts: 0,
      mitigationDecay: 0,
      nullifyDecay: 0,
      emptyQueueBonus: 0,
      visibilityBonus: 0,
      sovereigntyBonus: 0,
    };
  }

  private applyActiveEntryPressure(
    contributionBreakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    for (const entry of input.activeEntries) {
      if (entry.state === ENTRY_STATE.QUEUED) {
        contributionBreakdown.queuedThreats +=
          TENSION_CONSTANTS.QUEUED_TENSION_PER_TICK;
        continue;
      }

      if (entry.state === ENTRY_STATE.ARRIVED) {
        contributionBreakdown.arrivedThreats +=
          TENSION_CONSTANTS.ARRIVED_TENSION_PER_TICK;
      }
    }
  }

  private applyExpiredEntryPressure(
    contributionBreakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    for (const entry of input.expiredEntries) {
      if (entry.state === ENTRY_STATE.EXPIRED) {
        contributionBreakdown.expiredGhosts +=
          TENSION_CONSTANTS.EXPIRED_GHOST_PER_TICK;
      }
    }
  }

  private applyReliefDecay(
    contributionBreakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    for (const entry of input.relievedEntries) {
      if (entry.state === ENTRY_STATE.MITIGATED) {
        contributionBreakdown.mitigationDecay -=
          TENSION_CONSTANTS.MITIGATION_DECAY_PER_TICK;
        continue;
      }

      if (entry.state === ENTRY_STATE.NULLIFIED) {
        contributionBreakdown.nullifyDecay -=
          TENSION_CONSTANTS.NULLIFY_DECAY_PER_TICK;
      }
    }
  }

  private applyEmptyQueueRecovery(
    contributionBreakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    if (input.queueIsEmpty) {
      contributionBreakdown.emptyQueueBonus -=
        TENSION_CONSTANTS.EMPTY_QUEUE_DECAY;
    }
  }

  private applyVisibilityAwareness(
    contributionBreakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    contributionBreakdown.visibilityBonus = input.visibilityAwarenessBonus;
  }

  private applySovereigntyRelief(
    contributionBreakdown: MutableDecayContributionBreakdown,
    input: DecayComputeInput,
  ): void {
    if (input.sovereigntyMilestoneReached && !this.sovereigntyBonusConsumed) {
      contributionBreakdown.sovereigntyBonus -=
        TENSION_CONSTANTS.SOVEREIGNTY_BONUS_DECAY;
      this.sovereigntyBonusConsumed = true;
    }
  }

  private computeRawDelta(
    contributionBreakdown: MutableDecayContributionBreakdown,
  ): number {
    return (
      contributionBreakdown.queuedThreats +
      contributionBreakdown.arrivedThreats +
      contributionBreakdown.expiredGhosts +
      contributionBreakdown.mitigationDecay +
      contributionBreakdown.nullifyDecay +
      contributionBreakdown.emptyQueueBonus +
      contributionBreakdown.visibilityBonus +
      contributionBreakdown.sovereigntyBonus
    );
  }

  private computePositiveRaw(
    contributionBreakdown: MutableDecayContributionBreakdown,
  ): number {
    return (
      contributionBreakdown.queuedThreats +
      contributionBreakdown.arrivedThreats +
      contributionBreakdown.expiredGhosts +
      contributionBreakdown.visibilityBonus
    );
  }

  private computeNegativeRaw(
    contributionBreakdown: MutableDecayContributionBreakdown,
  ): number {
    return (
      contributionBreakdown.mitigationDecay +
      contributionBreakdown.nullifyDecay +
      contributionBreakdown.emptyQueueBonus +
      contributionBreakdown.sovereigntyBonus
    );
  }
}