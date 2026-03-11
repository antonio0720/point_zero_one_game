/**
 * ============================================================================
 * POINT ZERO ONE — BACKEND TENSION SNAPSHOT ADAPTER
 * /backend/src/game/engine/tension/TensionSnapshotAdapter.ts
 * ============================================================================
 *
 * Purpose:
 * - bridge rich Engine 3 runtime output into the compact backend RunStateSnapshot
 * - convert anticipation queue entries into visibility-safe ThreatEnvelope objects
 * - preserve immutable snapshot semantics required by the backend runtime
 *
 * Design:
 * - adapter only; no queue mutation, no score mutation, no event emission
 * - converts internal tension visibility state to backend envelope visibility
 * - can merge a fresh TensionRuntimeSnapshot into a RunStateSnapshot safely
 * ============================================================================
 */

import type { ThreatEnvelope } from '../core/GamePrimitives';
import type { RunStateSnapshot, TensionState } from '../core/RunStateSnapshot';
import {
  INTERNAL_VISIBILITY_TO_ENVELOPE,
  TENSION_VISIBILITY_STATE,
  VISIBILITY_CONFIGS,
  type AnticipationEntry,
  type TensionRuntimeSnapshot,
  type TensionVisibilityState,
} from './types';

export interface TensionSnapshotAdapterInput {
  readonly runState: RunStateSnapshot;
  readonly runtimeSnapshot: TensionRuntimeSnapshot;
  readonly queueEntries?: readonly AnticipationEntry[];
}

export class TensionSnapshotAdapter {
  public adaptState(
    runtimeSnapshot: TensionRuntimeSnapshot,
    queueEntries: readonly AnticipationEntry[],
    previousState?: TensionState,
  ): TensionState {
    const visibleThreats = this.adaptThreatEnvelopes(
      queueEntries,
      runtimeSnapshot.visibilityState,
      runtimeSnapshot.tickNumber,
    );

    return Object.freeze({
      score: runtimeSnapshot.score,
      anticipation: runtimeSnapshot.queueLength,
      visibleThreats,
      maxPulseTriggered:
        Boolean(previousState?.maxPulseTriggered) || runtimeSnapshot.isPulseActive,
      lastSpikeTick:
        runtimeSnapshot.lastSpikeTick ?? previousState?.lastSpikeTick ?? null,
    });
  }

  public mergeIntoRunState(input: TensionSnapshotAdapterInput): RunStateSnapshot {
    const queueEntries = Object.freeze([...(input.queueEntries ?? [])]);
    const tensionState = this.adaptState(
      input.runtimeSnapshot,
      queueEntries,
      input.runState.tension,
    );

    return Object.freeze({
      ...input.runState,
      tension: tensionState,
    });
  }

  public adaptThreatEnvelopes(
    queueEntries: readonly AnticipationEntry[],
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): readonly ThreatEnvelope[] {
    const envelopes = queueEntries
      .filter((entry) => !entry.isMitigated && !entry.isNullified)
      .map((entry) => this.toThreatEnvelope(entry, visibilityState, currentTick));

    return Object.freeze(envelopes);
  }

  public toThreatEnvelope(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): ThreatEnvelope {
    const visibleAs = INTERNAL_VISIBILITY_TO_ENVELOPE[visibilityState];
    const etaTicks = Math.max(0, entry.arrivalTick - currentTick);
    const severity = this.toEnvelopeSeverity(entry);
    const summary = this.buildSummary(entry, visibilityState, currentTick);

    return Object.freeze({
      threatId: entry.threatId,
      source: entry.source,
      etaTicks,
      severity,
      visibleAs,
      summary,
    });
  }

  private buildSummary(
    entry: AnticipationEntry,
    visibilityState: TensionVisibilityState,
    currentTick: number,
  ): string {
    const etaTicks = Math.max(0, entry.arrivalTick - currentTick);
    const countdownLabel =
      etaTicks === 0
        ? entry.ticksOverdue > 0
          ? `ACTIVE +${entry.ticksOverdue}t`
          : 'ACTIVE NOW'
        : `IN ${etaTicks}T`;

    switch (visibilityState) {
      case TENSION_VISIBILITY_STATE.SHADOWED:
        return 'Threat signature detected. Details suppressed under low-visibility conditions.';

      case TENSION_VISIBILITY_STATE.SIGNALED:
        return `${entry.threatType} incoming. Prepare a category-correct response.`;

      case TENSION_VISIBILITY_STATE.TELEGRAPHED:
        return `${entry.threatType} ${countdownLabel}. ${entry.summary}`;

      case TENSION_VISIBILITY_STATE.EXPOSED: {
        const mitigation =
          entry.mitigationCardTypes.length > 0
            ? ` Mitigate via ${entry.mitigationCardTypes.join(' / ')}.`
            : '';

        return `${entry.threatType} ${countdownLabel}. ${entry.summary} Worst case: ${entry.worstCaseOutcome}.${mitigation}`;
      }

      default:
        return entry.summary;
    }
  }

  private toEnvelopeSeverity(entry: AnticipationEntry): number {
    const weight = Number.isFinite(entry.severityWeight) ? entry.severityWeight : 0;
    const scaled = Math.round(weight * 10);

    return Math.max(1, Math.min(10, scaled));
  }
}