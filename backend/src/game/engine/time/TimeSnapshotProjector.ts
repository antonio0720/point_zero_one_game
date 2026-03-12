/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeSnapshotProjector.ts
 *
 * Doctrine:
 * - snapshot projection is the final immutable assembly layer for time mutations
 * - this file does not decide cadence policy; it applies already-resolved time results
 * - tags, warnings, and telemetry updates must be deduplicated and serialization-safe
 * - outcome mutation from timeout is delegated to RunTimeoutGuard, not re-derived here
 * - projection must preserve prior snapshot history unless an explicit override is supplied
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

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
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

  return freezeArray([...merged]);
}

function normalizeTick(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function resolveTelemetry(
  previous: TelemetryState,
  timeout: RunTimeoutResolution,
  request: TimeSnapshotProjectionRequest,
): TelemetryState {
  const warnings = dedupeStrings(
    previous.warnings,
    timeout.warnings,
    request.warnings ?? [],
  );

  return Object.freeze({
    ...previous,
    outcomeReason:
      request.outcomeReason !== undefined
        ? request.outcomeReason
        : timeout.outcomeReason !== null
          ? timeout.outcomeReason
          : previous.outcomeReason,
    outcomeReasonCode:
      request.outcomeReasonCode !== undefined
        ? request.outcomeReasonCode
        : timeout.outcomeReasonCode !== null
          ? timeout.outcomeReasonCode
          : previous.outcomeReasonCode,
    warnings,
  });
}

function resolveTags(
  snapshot: RunStateSnapshot,
  timeout: RunTimeoutResolution,
  request: TimeSnapshotProjectionRequest,
): readonly string[] {
  return dedupeStrings(
    snapshot.tags,
    timeout.tags,
    request.tags ?? [],
    request.decisionWindowExpired === true ? ['decision_window:expired'] : [],
  );
}

function resolveOutcome(
  snapshot: RunStateSnapshot,
  timeout: RunTimeoutResolution,
  request: TimeSnapshotProjectionRequest,
): RunOutcome | null {
  if (request.outcome !== undefined) {
    return request.outcome;
  }

  if (timeout.nextOutcome !== null) {
    return timeout.nextOutcome;
  }

  return snapshot.outcome;
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
    const tags = resolveTags(snapshot, timeout, request);
    const telemetry = resolveTelemetry(snapshot.telemetry, timeout, request);

    return Object.freeze({
      ...snapshot,
      tick: normalizeTick(request.tick),
      phase: request.phase,
      outcome: resolveOutcome(snapshot, timeout, request),
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