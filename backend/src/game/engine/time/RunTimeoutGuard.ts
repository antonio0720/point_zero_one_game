/*
 * POINT ZERO ONE — BACKEND ENGINE TIME
 * /backend/src/game/engine/time/RunTimeoutGuard.ts
 *
 * Doctrine:
 * - timeout is a backend-owned terminal truth, never a UI suggestion
 * - season budget + extension budget form a single authoritative time ceiling
 * - terminal outcomes must be stable and deterministic once crossed
 * - timeout projection must be side-effect free and replay-safe
 */

import type { RunOutcome } from '../core/GamePrimitives';
import type { OutcomeReasonCode, RunStateSnapshot } from '../core/RunStateSnapshot';

export interface RunTimeoutResolution {
  readonly totalBudgetMs: number;
  readonly nextElapsedMs: number;
  readonly consumedBudgetMs: number;
  readonly remainingBudgetMs: number;
  readonly timeoutReached: boolean;
  readonly nextOutcome: RunOutcome | null;
  readonly outcomeReason: string | null;
  readonly outcomeReasonCode: OutcomeReasonCode | null;
  readonly warnings: readonly string[];
  readonly tags: readonly string[];
}

export interface RunTimeoutGuardOptions {
  readonly timeoutWarningMessage?: string;
  readonly timeoutOutcomeReason?: string;
  readonly timeoutTag?: string;
}

function normalizeMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
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

export class RunTimeoutGuard {
  private readonly timeoutWarningMessage: string;
  private readonly timeoutOutcomeReason: string;
  private readonly timeoutTag: string;

  public constructor(options: RunTimeoutGuardOptions = {}) {
    this.timeoutWarningMessage =
      options.timeoutWarningMessage ?? 'Season budget exhausted.';
    this.timeoutOutcomeReason =
      options.timeoutOutcomeReason
      ?? 'Season budget exhausted before financial freedom was achieved.';
    this.timeoutTag = options.timeoutTag ?? 'run:timeout';
  }

  public getTotalBudgetMs(snapshot: RunStateSnapshot): number {
    return normalizeMs(snapshot.timers.seasonBudgetMs)
      + normalizeMs(snapshot.timers.extensionBudgetMs);
  }

  public getConsumedBudgetMs(nextElapsedMs: number): number {
    return normalizeMs(nextElapsedMs);
  }

  public getRemainingBudgetMs(snapshot: RunStateSnapshot, nextElapsedMs: number): number {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    return Math.max(0, totalBudgetMs - this.getConsumedBudgetMs(nextElapsedMs));
  }

  public hasReachedTimeout(snapshot: RunStateSnapshot, nextElapsedMs: number): boolean {
    if (snapshot.outcome !== null) {
      return snapshot.outcome === 'TIMEOUT';
    }

    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    return this.getConsumedBudgetMs(nextElapsedMs) >= totalBudgetMs;
  }

  public resolve(snapshot: RunStateSnapshot, nextElapsedMs: number): RunTimeoutResolution {
    const totalBudgetMs = this.getTotalBudgetMs(snapshot);
    const consumedBudgetMs = this.getConsumedBudgetMs(nextElapsedMs);
    const remainingBudgetMs = Math.max(0, totalBudgetMs - consumedBudgetMs);

    const timeoutReached =
      snapshot.outcome === null && consumedBudgetMs >= totalBudgetMs;

    const nextOutcome: RunOutcome | null = timeoutReached
      ? 'TIMEOUT'
      : snapshot.outcome;

    const outcomeReason = timeoutReached
      ? this.timeoutOutcomeReason
      : snapshot.telemetry.outcomeReason;

    const outcomeReasonCode: OutcomeReasonCode | null = timeoutReached
      ? 'SEASON_BUDGET_EXHAUSTED'
      : snapshot.telemetry.outcomeReasonCode;

    const warnings = timeoutReached
      ? dedupeStrings(snapshot.telemetry.warnings, [this.timeoutWarningMessage])
      : snapshot.telemetry.warnings;

    const tags = timeoutReached
      ? dedupeStrings(snapshot.tags, [this.timeoutTag])
      : snapshot.tags;

    return Object.freeze({
      totalBudgetMs,
      nextElapsedMs: consumedBudgetMs,
      consumedBudgetMs,
      remainingBudgetMs,
      timeoutReached,
      nextOutcome,
      outcomeReason,
      outcomeReasonCode,
      warnings,
      tags,
    });
  }
}