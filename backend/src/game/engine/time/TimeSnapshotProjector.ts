/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeSnapshotProjector.ts
 *
 * Doctrine:
 * - snapshot projection is the final immutable assembly layer for time mutations
 * - this file does not decide cadence policy; it applies already-resolved time results
 * - tags, warnings, and telemetry updates must be deduplicated and serialization-safe
 * - outcome mutation from timeout is delegated to RunTimeoutGuard, not re-derived here
 */

import type { RunOutcome, RunPhase } from '../core/GamePrimitives';
import type {
  OutcomeReasonCode,
  RunStateSnapshot,
  TelemetryState,
  TimerState,
} from '../core/RunStateSnapshot';
import { RunTimeoutGuard, type RunTimeoutResolution } from './RunTimeoutGuard';

export interface TimeSnapshotProjectionRequest {
  readonly tick: number;
  readonly phase: RunPhase;
  readonly timers: TimerState;
  readonly tags?: readonly string[];
  readonly warnings?: readonly string[];
  readonly outcome?: RunOutcome | null;
  readonly outcomeReason?: string | null;
  readonly outcomeReasonCode?: OutcomeReasonCode | null;
  readonly decisionWindowExpired?: boolean;
}

function dedupeStrings(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  const merged = new Set<string>();

  for (const group of groups) {
    for (const item of group) {
      if (item.length > 0) {
        merged.add(item);
      }
    }
  }

  return Object.freeze([...merged]);
}

function resolveTelemetry(
  previous: TelemetryState,
  timeout: RunTimeoutResolution,
  request: TimeSnapshotProjectionRequest,
): TelemetryState {
  const warnings = dedupeStrings(
    timeout.warnings,
    request.warnings ?? [],
  );

  return Object.freeze({
    ...previous,
    outcomeReason:
      request.outcomeReason
      ?? timeout.outcomeReason
      ?? previous.outcomeReason,
    outcomeReasonCode:
      request.outcomeReasonCode
      ?? timeout.outcomeReasonCode
      ?? previous.outcomeReasonCode,
    warnings,
  });
}

export class TimeSnapshotProjector {
  public constructor(
    private readonly timeoutGuard: RunTimeoutGuard = new RunTimeoutGuard(),
  ) {}

  public project(
    snapshot: RunStateSnapshot,
    request: TimeSnapshotProjectionRequest,
  ): RunStateSnapshot {
    const timeout = this.timeoutGuard.resolve(snapshot, request.timers.elapsedMs);

    const tags = dedupeStrings(
      timeout.tags,
      request.tags ?? [],
      request.decisionWindowExpired === true ? ['decision_window:expired'] : [],
    );

    const telemetry = resolveTelemetry(snapshot.telemetry, timeout, request);

    return Object.freeze({
      ...snapshot,
      tick: request.tick,
      phase: request.phase,
      outcome:
        request.outcome
        ?? timeout.nextOutcome
        ?? snapshot.outcome,
      timers: request.timers,
      telemetry,
      tags,
    });
  }

  public projectTimeAdvance(
    snapshot: RunStateSnapshot,
    tick: number,
    phase: RunPhase,
    timers: TimerState,
    extra: Omit<TimeSnapshotProjectionRequest, 'tick' | 'phase' | 'timers'> = {},
  ): RunStateSnapshot {
    return this.project(snapshot, {
      tick,
      phase,
      timers,
      ...extra,
    });
  }
}