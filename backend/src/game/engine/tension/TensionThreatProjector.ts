/* ========================================================================
 * POINT ZERO ONE — BACKEND TENSION THREAT PROJECTOR
 * /backend/src/game/engine/tension/TensionThreatProjector.ts
 * ====================================================================== */

import type { ThreatEnvelope } from '../core/GamePrimitives';

import {
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  TENSION_VISIBILITY_STATE,
  type AnticipationEntry,
  type TensionVisibilityState,
} from './types';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export class TensionThreatProjector {
  public toThreatEnvelopes(
    entries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    return freezeArray(
      entries.map((entry) => this.projectEntry(entry, visibilityState, currentTick)),
    );
  }

  private projectEntry(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): ThreatEnvelope {
    const etaTicks = entry.isArrived
      ? 0
      : Math.max(0, entry.arrivalTick - currentTick);

    return {
      threatId: entry.threatId,
      source: entry.source,
      etaTicks,
      severity: entry.severityWeight,
      visibleAs: INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState],
      summary: this.buildSummary(entry, visibilityState, etaTicks),
    };
  }

  private buildSummary(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    etaTicks: number,
  ): string {
    switch (visibilityState) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return entry.isArrived
          ? 'Active threat signature detected'
          : 'Threat signature detected';
      case TENSION_VISIBILITY_STATE.SIGNALED:
        return entry.isArrived
          ? `${entry.threatType} active`
          : `${entry.threatType} incoming`;
      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return entry.isArrived
          ? `${entry.threatType} active +${entry.ticksOverdue}t`
          : `${entry.threatType} in ${etaTicks} ticks`;
      case TENSION_VISIBILITY_STATE.EXPOSED:
        return entry.isArrived
          ? `${entry.threatType} active • ${entry.worstCaseOutcome} • use ${entry.mitigationCardTypes.join(' / ')}`
          : `${entry.threatType} in ${etaTicks} ticks • ${entry.worstCaseOutcome} • use ${entry.mitigationCardTypes.join(' / ')}`;
      default:
        return entry.summary;
    }
  }
}