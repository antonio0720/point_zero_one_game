/*
 * POINT ZERO ONE — BACKEND ENGINE CORE
 * /backend/src/game/engine/core/RunStateInvariantGuard.ts
 *
 * Doctrine:
 * - runtime state must be provably sane at the simulation boundary
 * - invariant checks are deterministic, bounded, and serialization-safe
 * - guards should surface rich diagnostics without mutating snapshots
 * - derived-state checks must be opt-in where legacy runtime drift still exists
 */

import type { RunStateSnapshot } from './RunStateSnapshot';
import { checksumSnapshot } from './Deterministic';

export type InvariantSeverity = 'ERROR' | 'WARN';
export type InvariantStage = 'runtime' | 'tick-finalized' | 'terminal';

export interface InvariantIssue {
  readonly severity: InvariantSeverity;
  readonly code: string;
  readonly path: string;
  readonly message: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}

export interface RunStateInvariantOptions {
  readonly stage?: InvariantStage;
  readonly requireDerivedFields?: boolean;
  readonly expectedTickChecksumMode?: 'none' | 'lte-tick' | 'eq-tick';
}

export interface RunStateTransitionOptions extends RunStateInvariantOptions {
  readonly maxTickDelta?: number;
}

export interface RunStateInvariantReport {
  readonly ok: boolean;
  readonly runId: string;
  readonly tick: number;
  readonly stage: InvariantStage;
  readonly checksum: string;
  readonly errors: readonly InvariantIssue[];
  readonly warnings: readonly InvariantIssue[];
}

const EPSILON = 0.001;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function approxEqual(left: number, right: number, epsilon = EPSILON): boolean {
  return Math.abs(left - right) <= epsilon;
}

function deriveExpectedNetWorth(snapshot: RunStateSnapshot): number {
  const shieldValue = snapshot.shield.layers.reduce(
    (sum, layer) => sum + layer.current,
    0,
  );
  const recurring = Math.max(
    0,
    (snapshot.economy.incomePerTick - snapshot.economy.expensesPerTick) * 12,
  );

  return Math.round(
    (snapshot.economy.cash - snapshot.economy.debt + recurring + shieldValue) * 100,
  ) / 100;
}

function deriveWeakestLayer(snapshot: RunStateSnapshot): {
  readonly layerId: RunStateSnapshot['shield']['weakestLayerId'];
  readonly ratio: number;
} {
  const weakest = snapshot.shield.layers
    .slice()
    .sort((left, right) => left.current - right.current)[0];

  if (!weakest) {
    return {
      layerId: 'L1',
      ratio: 0,
    };
  }

  return {
    layerId: weakest.layerId,
    ratio: weakest.max <= 0 ? 0 : weakest.current / weakest.max,
  };
}

function normalizeActiveWindowStore(
  snapshot: RunStateSnapshot,
): Record<string, { readonly frozen: boolean } | null> {
  if (!isRecord(snapshot.timers.activeDecisionWindows)) {
    return {};
  }

  const normalized: Record<string, { readonly frozen: boolean } | null> = {};
  for (const [key, value] of Object.entries(snapshot.timers.activeDecisionWindows)) {
    if (isRecord(value)) {
      normalized[key] = {
        frozen: value.frozen === true,
      };
      continue;
    }

    normalized[key] = null;
  }

  return normalized;
}

export class RunStateInvariantGuard {
  public inspect(
    snapshot: RunStateSnapshot,
    options: RunStateInvariantOptions = {},
  ): RunStateInvariantReport {
    const stage = options.stage ?? 'runtime';
    const expectedTickChecksumMode =
      options.expectedTickChecksumMode ??
      (stage === 'tick-finalized' || stage === 'terminal' ? 'eq-tick' : 'lte-tick');
    const requireDerivedFields = options.requireDerivedFields ?? false;

    const errors: InvariantIssue[] = [];
    const warnings: InvariantIssue[] = [];

    const push = (issue: InvariantIssue): void => {
      if (issue.severity === 'ERROR') {
        errors.push(issue);
        return;
      }

      warnings.push(issue);
    };

    if (snapshot.schemaVersion !== 'engine-run-state.v2') {
      push({
        severity: 'ERROR',
        code: 'SCHEMA_VERSION_INVALID',
        path: 'schemaVersion',
        message: 'Run state schemaVersion is invalid.',
        expected: 'engine-run-state.v2',
        actual: snapshot.schemaVersion,
      });
    }

    for (const [path, value] of [
      ['runId', snapshot.runId],
      ['userId', snapshot.userId],
      ['seed', snapshot.seed],
    ] as const) {
      if (typeof value !== 'string' || value.trim().length === 0) {
        push({
          severity: 'ERROR',
          code: 'IDENTITY_FIELD_EMPTY',
          path,
          message: `${path} must be a non-empty string.`,
          actual: value,
        });
      }
    }

    if (!Number.isInteger(snapshot.tick) || snapshot.tick < 0) {
      push({
        severity: 'ERROR',
        code: 'TICK_INVALID',
        path: 'tick',
        message: 'tick must be a non-negative integer.',
        actual: snapshot.tick,
      });
    }

    const numericChecks: Array<[string, number, number | null]> = [
      ['economy.cash', snapshot.economy.cash, null],
      ['economy.debt', snapshot.economy.debt, null],
      ['economy.incomePerTick', snapshot.economy.incomePerTick, null],
      ['economy.expensesPerTick', snapshot.economy.expensesPerTick, null],
      ['economy.netWorth', snapshot.economy.netWorth, null],
      ['economy.freedomTarget', snapshot.economy.freedomTarget, 0],
      ['economy.haterHeat', snapshot.economy.haterHeat, 0],
      ['pressure.score', snapshot.pressure.score, 0],
      ['pressure.maxScoreSeen', snapshot.pressure.maxScoreSeen, 0],
      ['tension.score', snapshot.tension.score, 0],
      ['tension.anticipation', snapshot.tension.anticipation, 0],
      ['shield.weakestLayerRatio', snapshot.shield.weakestLayerRatio, 0],
      ['battle.battleBudget', snapshot.battle.battleBudget, 0],
      ['battle.battleBudgetCap', snapshot.battle.battleBudgetCap, 0],
      ['timers.seasonBudgetMs', snapshot.timers.seasonBudgetMs, 0],
      ['timers.extensionBudgetMs', snapshot.timers.extensionBudgetMs, 0],
      ['timers.elapsedMs', snapshot.timers.elapsedMs, 0],
      ['timers.currentTickDurationMs', snapshot.timers.currentTickDurationMs, 1],
      ['timers.holdCharges', snapshot.timers.holdCharges, 0],
      ['telemetry.emittedEventCount', snapshot.telemetry.emittedEventCount, 0],
    ];

    for (const [path, value, min] of numericChecks) {
      if (!isFiniteNumber(value)) {
        push({
          severity: 'ERROR',
          code: 'NON_FINITE_NUMBER',
          path,
          message: `${path} must be a finite number.`,
          actual: value,
        });
        continue;
      }

      if (min !== null && value < min) {
        push({
          severity: 'ERROR',
          code: 'NUMBER_BELOW_MINIMUM',
          path,
          message: `${path} must be greater than or equal to ${String(min)}.`,
          expected: min,
          actual: value,
        });
      }
    }

    if (snapshot.pressure.score < 0 || snapshot.pressure.score > 1) {
      push({
        severity: 'ERROR',
        code: 'PRESSURE_SCORE_OUT_OF_RANGE',
        path: 'pressure.score',
        message: 'pressure.score must be in the range [0, 1].',
        expected: '[0,1]',
        actual: snapshot.pressure.score,
      });
    }

    if (snapshot.pressure.maxScoreSeen + EPSILON < snapshot.pressure.score) {
      push({
        severity: 'WARN',
        code: 'PRESSURE_MAX_SCORE_BELOW_CURRENT',
        path: 'pressure.maxScoreSeen',
        message: 'pressure.maxScoreSeen is below the current pressure.score.',
        expected: `>= ${String(snapshot.pressure.score)}`,
        actual: snapshot.pressure.maxScoreSeen,
      });
    }

    if (snapshot.shield.layers.length === 0) {
      push({
        severity: 'ERROR',
        code: 'SHIELD_LAYERS_EMPTY',
        path: 'shield.layers',
        message: 'shield.layers must contain at least one layer.',
      });
    }

    const layerIds = snapshot.shield.layers.map((layer) => layer.layerId);
    if (!isUnique(layerIds)) {
      push({
        severity: 'ERROR',
        code: 'SHIELD_LAYER_IDS_DUPLICATED',
        path: 'shield.layers',
        message: 'shield.layers contains duplicate layerId values.',
        actual: layerIds,
      });
    }

    for (const layer of snapshot.shield.layers) {
      if (!isFiniteNumber(layer.current) || !isFiniteNumber(layer.max)) {
        push({
          severity: 'ERROR',
          code: 'SHIELD_LAYER_NON_FINITE',
          path: `shield.layers.${layer.layerId}`,
          message: 'Shield layer current/max must be finite numbers.',
          actual: layer,
        });
        continue;
      }

      if (layer.max <= 0) {
        push({
          severity: 'ERROR',
          code: 'SHIELD_LAYER_MAX_INVALID',
          path: `shield.layers.${layer.layerId}.max`,
          message: 'Shield layer max must be greater than zero.',
          actual: layer.max,
        });
      }

      if (layer.current < 0 || layer.current > layer.max + EPSILON) {
        push({
          severity: 'ERROR',
          code: 'SHIELD_LAYER_CURRENT_OUT_OF_RANGE',
          path: `shield.layers.${layer.layerId}.current`,
          message: 'Shield layer current must be between 0 and max.',
          expected: `[0, ${String(layer.max)}]`,
          actual: layer.current,
        });
      }

      const expectedRatio = layer.max <= 0 ? 0 : layer.current / layer.max;
      if (!approxEqual(layer.integrityRatio, expectedRatio)) {
        push({
          severity: requireDerivedFields ? 'ERROR' : 'WARN',
          code: 'SHIELD_LAYER_RATIO_DRIFT',
          path: `shield.layers.${layer.layerId}.integrityRatio`,
          message: 'Shield layer integrityRatio is out of sync with current/max.',
          expected: expectedRatio,
          actual: layer.integrityRatio,
        });
      }
    }

    const expectedWeakestLayer = deriveWeakestLayer(snapshot);
    if (snapshot.shield.weakestLayerId !== expectedWeakestLayer.layerId) {
      push({
        severity: requireDerivedFields ? 'ERROR' : 'WARN',
        code: 'SHIELD_WEAKEST_LAYER_DRIFT',
        path: 'shield.weakestLayerId',
        message: 'shield.weakestLayerId is out of sync with layer currents.',
        expected: expectedWeakestLayer.layerId,
        actual: snapshot.shield.weakestLayerId,
      });
    }

    if (!approxEqual(snapshot.shield.weakestLayerRatio, expectedWeakestLayer.ratio)) {
      push({
        severity: requireDerivedFields ? 'ERROR' : 'WARN',
        code: 'SHIELD_WEAKEST_RATIO_DRIFT',
        path: 'shield.weakestLayerRatio',
        message: 'shield.weakestLayerRatio is out of sync with the weakest layer.',
        expected: expectedWeakestLayer.ratio,
        actual: snapshot.shield.weakestLayerRatio,
      });
    }

    const botIds = snapshot.battle.bots.map((bot) => bot.botId);
    if (!isUnique(botIds)) {
      push({
        severity: 'ERROR',
        code: 'BOT_IDS_DUPLICATED',
        path: 'battle.bots',
        message: 'battle.bots contains duplicate botId values.',
        actual: botIds,
      });
    }

    if (!isUnique(snapshot.battle.neutralizedBotIds)) {
      push({
        severity: 'ERROR',
        code: 'NEUTRALIZED_BOT_IDS_DUPLICATED',
        path: 'battle.neutralizedBotIds',
        message: 'battle.neutralizedBotIds contains duplicates.',
        actual: snapshot.battle.neutralizedBotIds,
      });
    }

    const expectedNetWorth = deriveExpectedNetWorth(snapshot);
    if (!approxEqual(snapshot.economy.netWorth, expectedNetWorth, 0.01)) {
      push({
        severity: requireDerivedFields ? 'ERROR' : 'WARN',
        code: 'ECONOMY_NET_WORTH_DRIFT',
        path: 'economy.netWorth',
        message: 'economy.netWorth is out of sync with the runtime derivation formula.',
        expected: expectedNetWorth,
        actual: snapshot.economy.netWorth,
      });
    }

    if (
      snapshot.timers.nextTickAtMs !== null &&
      !isFiniteNumber(snapshot.timers.nextTickAtMs)
    ) {
      push({
        severity: 'ERROR',
        code: 'NEXT_TICK_TIMESTAMP_INVALID',
        path: 'timers.nextTickAtMs',
        message: 'timers.nextTickAtMs must be null or a finite number.',
        actual: snapshot.timers.nextTickAtMs,
      });
    }

    const activeWindowStore = normalizeActiveWindowStore(snapshot);
    if (!isRecord(snapshot.timers.activeDecisionWindows)) {
      push({
        severity: 'ERROR',
        code: 'ACTIVE_WINDOWS_STORE_INVALID',
        path: 'timers.activeDecisionWindows',
        message: 'timers.activeDecisionWindows must be an object-like store.',
        actual: snapshot.timers.activeDecisionWindows,
      });
    }

    if (!isUnique(snapshot.timers.frozenWindowIds)) {
      push({
        severity: 'ERROR',
        code: 'FROZEN_WINDOW_IDS_DUPLICATED',
        path: 'timers.frozenWindowIds',
        message: 'timers.frozenWindowIds contains duplicates.',
        actual: snapshot.timers.frozenWindowIds,
      });
    }

    for (const windowId of snapshot.timers.frozenWindowIds) {
      if (!(windowId in activeWindowStore)) {
        push({
          severity: 'WARN',
          code: 'FROZEN_WINDOW_ID_MISSING',
          path: 'timers.frozenWindowIds',
          message: 'A frozen window id is not present in activeDecisionWindows.',
          actual: windowId,
        });
        continue;
      }

      const windowState = activeWindowStore[windowId];
      if (windowState !== null && windowState.frozen !== true) {
        push({
          severity: 'WARN',
          code: 'FROZEN_WINDOW_FLAG_DRIFT',
          path: `timers.activeDecisionWindows.${windowId}.frozen`,
          message: 'Frozen window id exists but the stored window is not marked frozen.',
          expected: true,
          actual: windowState.frozen,
        });
      }
    }

    for (const decision of snapshot.telemetry.decisions) {
      if (!Number.isInteger(decision.tick) || decision.tick < 0) {
        push({
          severity: 'ERROR',
          code: 'DECISION_TICK_INVALID',
          path: 'telemetry.decisions.tick',
          message: 'Decision tick values must be non-negative integers.',
          actual: decision.tick,
        });
      }

      if (!isFiniteNumber(decision.latencyMs) || decision.latencyMs < 0) {
        push({
          severity: 'ERROR',
          code: 'DECISION_LATENCY_INVALID',
          path: 'telemetry.decisions.latencyMs',
          message: 'Decision latencyMs must be a finite non-negative number.',
          actual: decision.latencyMs,
        });
      }
    }

    if (expectedTickChecksumMode !== 'none') {
      const checksumCount = snapshot.sovereignty.tickChecksums.length;
      const expected = snapshot.tick;
      const valid =
        expectedTickChecksumMode === 'eq-tick'
          ? checksumCount === expected
          : checksumCount <= expected;

      if (!valid) {
        push({
          severity: expectedTickChecksumMode === 'eq-tick' ? 'ERROR' : 'WARN',
          code: 'TICK_CHECKSUM_COUNT_INVALID',
          path: 'sovereignty.tickChecksums',
          message:
            expectedTickChecksumMode === 'eq-tick'
              ? 'tickChecksums length must match tick at the finalized boundary.'
              : 'tickChecksums length must never exceed tick.',
          expected,
          actual: checksumCount,
        });
      }
    }

    if (snapshot.outcome !== null && snapshot.telemetry.outcomeReasonCode === null) {
      push({
        severity: 'WARN',
        code: 'OUTCOME_REASON_CODE_MISSING',
        path: 'telemetry.outcomeReasonCode',
        message: 'A terminal outcome exists without telemetry.outcomeReasonCode.',
        actual: snapshot.outcome,
      });
    }

    if (snapshot.sovereignty.proofHash !== null && snapshot.outcome === null) {
      push({
        severity: 'WARN',
        code: 'PROOF_HASH_PRESENT_BEFORE_OUTCOME',
        path: 'sovereignty.proofHash',
        message: 'proofHash is present before the run has a terminal outcome.',
        actual: snapshot.sovereignty.proofHash,
      });
    }

    const checksum = checksumSnapshot(snapshot);

    return {
      ok: errors.length === 0,
      runId: snapshot.runId,
      tick: snapshot.tick,
      stage,
      checksum,
      errors,
      warnings,
    };
  }

  public assert(
    snapshot: RunStateSnapshot,
    options: RunStateInvariantOptions = {},
  ): RunStateSnapshot {
    const report = this.inspect(snapshot, options);
    if (!report.ok) {
      throw new Error(this.formatReport(report));
    }

    return snapshot;
  }

  public inspectTransition(
    previous: RunStateSnapshot,
    next: RunStateSnapshot,
    options: RunStateTransitionOptions = {},
  ): RunStateInvariantReport {
    const report = this.inspect(next, options);
    const errors = [...report.errors];
    const warnings = [...report.warnings];
    const maxTickDelta = Math.max(0, options.maxTickDelta ?? 1);

    const push = (issue: InvariantIssue): void => {
      if (issue.severity === 'ERROR') {
        errors.push(issue);
        return;
      }

      warnings.push(issue);
    };

    for (const field of ['runId', 'userId', 'seed', 'mode'] as const) {
      if (previous[field] !== next[field]) {
        push({
          severity: 'ERROR',
          code: 'IDENTITY_CHANGED_ACROSS_TRANSITION',
          path: field,
          message: `${field} cannot change across a runtime transition.`,
          expected: previous[field],
          actual: next[field],
        });
      }
    }

    const tickDelta = next.tick - previous.tick;
    if (tickDelta < 0 || tickDelta > maxTickDelta) {
      push({
        severity: 'ERROR',
        code: 'TICK_DELTA_INVALID',
        path: 'tick',
        message: 'tick delta across transition is invalid.',
        expected: `0..${String(maxTickDelta)}`,
        actual: tickDelta,
      });
    }

    if (next.timers.elapsedMs < previous.timers.elapsedMs) {
      push({
        severity: 'ERROR',
        code: 'ELAPSED_MS_REGRESSED',
        path: 'timers.elapsedMs',
        message: 'timers.elapsedMs cannot move backwards.',
        expected: `>= ${String(previous.timers.elapsedMs)}`,
        actual: next.timers.elapsedMs,
      });
    }

    if (
      next.sovereignty.tickChecksums.length < previous.sovereignty.tickChecksums.length
    ) {
      push({
        severity: 'ERROR',
        code: 'TICK_CHECKSUMS_REGRESSED',
        path: 'sovereignty.tickChecksums',
        message: 'tickChecksums cannot shrink across transition.',
        expected: `>= ${String(previous.sovereignty.tickChecksums.length)}`,
        actual: next.sovereignty.tickChecksums.length,
      });
    }

    if (previous.outcome !== null && next.outcome !== previous.outcome) {
      push({
        severity: 'ERROR',
        code: 'TERMINAL_OUTCOME_MUTATED',
        path: 'outcome',
        message: 'A terminal outcome cannot change across transition.',
        expected: previous.outcome,
        actual: next.outcome,
      });
    }

    if (
      previous.sovereignty.proofHash !== null &&
      next.sovereignty.proofHash !== previous.sovereignty.proofHash
    ) {
      push({
        severity: 'ERROR',
        code: 'PROOF_HASH_MUTATED',
        path: 'sovereignty.proofHash',
        message: 'proofHash cannot change once it has been materialized.',
        expected: previous.sovereignty.proofHash,
        actual: next.sovereignty.proofHash,
      });
    }

    return {
      ...report,
      ok: errors.length === 0,
      errors,
      warnings,
    };
  }

  private formatReport(report: RunStateInvariantReport): string {
    const lines = [
      `RunStateInvariantGuard failed for run ${report.runId} at tick ${String(report.tick)} (${report.stage}).`,
      ...report.errors.map(
        (issue) =>
          `ERROR ${issue.code} @ ${issue.path}: ${issue.message}`,
      ),
      ...report.warnings.map(
        (issue) =>
          `WARN ${issue.code} @ ${issue.path}: ${issue.message}`,
      ),
    ];

    return lines.join(' ');
  }
}
