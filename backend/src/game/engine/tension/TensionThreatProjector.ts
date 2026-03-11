/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION THREAT PROJECTOR
 * /backend/src/game/engine/tension/TensionThreatProjector.ts
 * ====================================================================== */

import type { ThreatEnvelope, VisibilityLevel } from '../core/GamePrimitives';
import {
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  TENSION_VISIBILITY_STATE,
  type AnticipationEntry,
  type TensionVisibilityState,
} from './types';

function visibilityRank(level: VisibilityLevel): number {
  switch (level) {
    case 'EXPOSED':
      return 4;
    case 'PARTIAL':
      return 3;
    case 'SILHOUETTE':
      return 2;
    case 'HIDDEN':
    default:
      return 1;
  }
}

export class TensionThreatProjector {
  public toThreatEnvelopes(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    const mapped = entries.map((entry) => {
      const etaTicks = entry.isArrived
        ? 0
        : Math.max(0, entry.arrivalTick - currentTick);

      let visibleAs = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
      if (entry.isCascadeTriggered && !entry.isArrived) {
        visibleAs =
          visibilityRank(visibleAs) >= visibilityRank('PARTIAL') ? visibleAs : 'PARTIAL';
      }

      return {
        threatId: entry.threatId,
        source: entry.source,
        etaTicks,
        severity: entry.severityWeight,
        visibleAs,
        summary: this.buildSummary(entry, visibilityState, etaTicks),
      };
    });

    return Object.freeze(mapped);
  }

  private buildSummary(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    etaTicks: number,
  ): string {
    switch (visibilityState) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return 'Unknown threat signature detected.';
      case TENSION_VISIBILITY_STATE.SIGNALED:
        return `${entry.threatType} incoming.`;
      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return entry.isArrived
          ? `${entry.threatType} is active now.`
          : `${entry.threatType} arrives in ${etaTicks} tick(s).`;
      case TENSION_VISIBILITY_STATE.EXPOSED:
      default:
        return entry.isArrived
          ? `${entry.worstCaseOutcome} | Mitigate with ${entry.mitigationCardTypes.join(', ')}`
          : `${entry.threatType} in ${etaTicks} tick(s) | ${entry.worstCaseOutcome}`;
    }
  }
}