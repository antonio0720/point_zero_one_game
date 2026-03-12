/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/TimeTelemetryProjector.ts
 *
 * Doctrine:
 * - telemetry is a backend-owned audit surface, not a UI convenience
 * - time-side telemetry projection must remain deterministic, immutable, and hash-safe
 * - warning / fork-hint / decision streams are append-only, deduped where appropriate
 * - outcome reason state may be refined here, but terminal truth remains owned by runtime
 * - additive normalization is allowed so long as it does not erase prior audit facts
 */

import type {
  DecisionRecord,
  OutcomeReasonCode,
  RunStateSnapshot,
  TelemetryState,
} from '../core/RunStateSnapshot';

export interface TimeDecisionTelemetryInput {
  readonly tick: number;
  readonly actorId: string;
  readonly cardId: string;
  readonly latencyMs: number;
  readonly timingClass: readonly string[];
  readonly accepted: boolean;
}

export interface TimeTelemetryProjectionRequest {
  readonly decisions?: readonly TimeDecisionTelemetryInput[];
  readonly warnings?: readonly string[];
  readonly forkHints?: readonly string[];
  readonly emittedEventCountDelta?: number;
  readonly lastTickChecksum?: string | null;
  readonly outcomeReason?: string | null;
  readonly outcomeReasonCode?: OutcomeReasonCode | null;
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

function normalizeLatencyMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeEventDelta(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeTick(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeChecksum(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTimingClass(values: readonly string[]): readonly string[] {
  return freezeArray(values.filter((value) => value.length > 0));
}

function normalizeDecision(input: TimeDecisionTelemetryInput): DecisionRecord {
  return Object.freeze({
    tick: normalizeTick(input.tick),
    actorId: input.actorId,
    cardId: input.cardId,
    latencyMs: normalizeLatencyMs(input.latencyMs),
    timingClass: normalizeTimingClass(input.timingClass),
    accepted: input.accepted,
  });
}

function incrementSafe(previous: number, delta: number): number {
  const next = previous + delta;

  if (!Number.isFinite(next)) {
    return previous;
  }

  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(next)));
}

export class TimeTelemetryProjector {
  public project(
    previous: TelemetryState,
    request: TimeTelemetryProjectionRequest = {},
  ): TelemetryState {
    const nextDecisions =
      request.decisions === undefined
        ? previous.decisions
        : freezeArray([
            ...previous.decisions,
            ...request.decisions.map((decision) => normalizeDecision(decision)),
          ]);

    const nextWarnings =
      request.warnings === undefined
        ? previous.warnings
        : dedupeStrings(previous.warnings, request.warnings);

    const nextForkHints =
      request.forkHints === undefined
        ? previous.forkHints
        : dedupeStrings(previous.forkHints, request.forkHints);

    const nextEmittedEventCount = incrementSafe(
      previous.emittedEventCount,
      normalizeEventDelta(request.emittedEventCountDelta),
    );

    const nextChecksum = normalizeChecksum(request.lastTickChecksum);

    return Object.freeze({
      decisions: nextDecisions,
      outcomeReason:
        request.outcomeReason !== undefined
          ? request.outcomeReason
          : previous.outcomeReason,
      outcomeReasonCode:
        request.outcomeReasonCode !== undefined
          ? request.outcomeReasonCode
          : previous.outcomeReasonCode,
      lastTickChecksum:
        nextChecksum !== undefined
          ? nextChecksum
          : previous.lastTickChecksum,
      forkHints: nextForkHints,
      emittedEventCount: nextEmittedEventCount,
      warnings: nextWarnings,
    });
  }

  public projectForSnapshot(
    snapshot: RunStateSnapshot,
    request: TimeTelemetryProjectionRequest = {},
  ): TelemetryState {
    return this.project(snapshot.telemetry, request);
  }

  public appendDecision(
    previous: TelemetryState,
    decision: TimeDecisionTelemetryInput,
  ): TelemetryState {
    return this.project(previous, {
      decisions: [decision],
    });
  }

  public appendWarning(
    previous: TelemetryState,
    warning: string,
  ): TelemetryState {
    return this.project(previous, {
      warnings: [warning],
    });
  }

  public appendForkHint(
    previous: TelemetryState,
    forkHint: string,
  ): TelemetryState {
    return this.project(previous, {
      forkHints: [forkHint],
    });
  }

  public incrementEventCount(
    previous: TelemetryState,
    delta = 1,
  ): TelemetryState {
    return this.project(previous, {
      emittedEventCountDelta: delta,
    });
  }

  public setChecksum(
    previous: TelemetryState,
    checksum: string | null,
  ): TelemetryState {
    return this.project(previous, {
      lastTickChecksum: checksum,
    });
  }

  public setOutcomeReason(
    previous: TelemetryState,
    outcomeReason: string | null,
    outcomeReasonCode: OutcomeReasonCode | null,
  ): TelemetryState {
    return this.project(previous, {
      outcomeReason,
      outcomeReasonCode,
    });
  }
}