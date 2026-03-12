// backend/src/game/engine/zero/OutcomeGate.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OutcomeGate.ts
 *
 * Doctrine:
 * - terminal outcome authority remains backend-owned
 * - Engine 0 may evaluate terminal state, but it must not re-implement
 *   core outcome law when RuntimeOutcomeResolver already exists
 * - this file is a zero-owned coordinator over the core resolver:
 *   resolve -> apply -> annotate -> signal
 * - outcome resolution must remain deterministic, immutable, and proof-safe
 */

import { cloneJson, deepFreeze } from '../core/Deterministic';
import {
  createEngineSignal,
  type EngineSignal,
} from '../core/EngineContracts';
import type { RunStateSnapshot } from '../core/RunStateSnapshot';
import {
  RuntimeOutcomeResolver,
  type RuntimeOutcomeDecision,
  type RuntimeOutcomeResolverOptions,
} from '../core/RuntimeOutcomeResolver';

type Mutable<T> =
  T extends readonly (infer U)[]
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export interface OutcomeGateOptions extends RuntimeOutcomeResolverOptions {
  readonly annotateNegativeOutcomes?: boolean;
}

export interface ForcedOutcomeInput {
  readonly outcome: NonNullable<RunStateSnapshot['outcome']>;
  readonly reason: string;
  readonly reasonCode: NonNullable<RunStateSnapshot['telemetry']['outcomeReasonCode']>;
  readonly severity?: EngineSignal['severity'];
  readonly signalCode?: string;
  readonly warning?: string | null;
}

export interface OutcomeGateResult {
  readonly snapshot: RunStateSnapshot;
  readonly decision: RuntimeOutcomeDecision;
  readonly didChangeOutcome: boolean;
  readonly shouldFinalize: boolean;
  readonly signals: readonly EngineSignal[];
}

const DEFAULT_OPTIONS: Required<OutcomeGateOptions> = {
  bankruptOnNegativeCash: true,
  bankruptOnNegativeNetWorth: false,
  quarantineTerminatesRun: true,
  engineAbortWarningsThreshold: 25,
  annotateNegativeOutcomes: true,
};

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function uniqueAppend<T>(items: readonly T[], value: T): readonly T[] {
  return items.includes(value) ? freezeArray(items) : freezeArray([...items, value]);
}

function uniqueAppendMany<T>(items: readonly T[], values: readonly T[]): readonly T[] {
  const next = [...items];
  for (const value of values) {
    if (!next.includes(value)) {
      next.push(value);
    }
  }
  return freezeArray(next);
}

function isDecisionEqual(
  snapshot: RunStateSnapshot,
  decision: RuntimeOutcomeDecision,
): boolean {
  return (
    snapshot.outcome === decision.outcome &&
    snapshot.telemetry.outcomeReason === decision.outcomeReason &&
    snapshot.telemetry.outcomeReasonCode === decision.outcomeReasonCode
  );
}

function isNegativeOutcome(
  outcome: RunStateSnapshot['outcome'],
): outcome is Extract<RunStateSnapshot['outcome'], 'BANKRUPT' | 'TIMEOUT' | 'ABANDONED'> {
  return outcome === 'BANKRUPT' || outcome === 'TIMEOUT' || outcome === 'ABANDONED';
}

function buildOutcomeSignal(decision: RuntimeOutcomeDecision, tick: number): EngineSignal | null {
  if (!decision.isTerminal || decision.outcome === null) {
    return null;
  }

  const severity: EngineSignal['severity'] =
    decision.outcome === 'FREEDOM'
      ? 'INFO'
      : decision.outcome === 'ABANDONED'
        ? 'ERROR'
        : 'WARN';

  const code = `OUTCOME_${decision.outcome}`;
  const message =
    decision.outcomeReason === null
      ? `Outcome resolved: ${decision.outcome}`
      : `Outcome resolved: ${decision.outcome} (${decision.outcomeReason})`;

  return createEngineSignal(
    'mode',
    severity,
    code,
    message,
    tick,
    freezeArray([
      'engine-zero',
      'outcome-gate',
      `outcome:${decision.outcome.toLowerCase()}`,
      decision.outcomeReasonCode === null
        ? 'reason:none'
        : `reason:${decision.outcomeReasonCode.toLowerCase()}`,
    ]),
  );
}

function negativeOutcomeWarning(decision: RuntimeOutcomeDecision): string | null {
  if (!decision.isTerminal || !isNegativeOutcome(decision.outcome)) {
    return null;
  }

  switch (decision.outcome) {
    case 'BANKRUPT':
      return 'outcome.bankrupt';
    case 'TIMEOUT':
      return 'outcome.timeout';
    case 'ABANDONED':
      return 'outcome.abandoned';
    default:
      return null;
  }
}

export class OutcomeGate {
  private readonly options: Required<OutcomeGateOptions>;

  private readonly resolver: RuntimeOutcomeResolver;

  public constructor(options: OutcomeGateOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.resolver = new RuntimeOutcomeResolver(this.options);
  }

  public resolve(snapshot: RunStateSnapshot): RuntimeOutcomeDecision {
    return this.resolver.resolve(snapshot);
  }

  public isTerminal(snapshot: RunStateSnapshot): boolean {
    return this.resolve(snapshot).isTerminal;
  }

  public shouldFinalize(snapshot: RunStateSnapshot): boolean {
    return snapshot.outcome !== null && snapshot.sovereignty.proofHash === null;
  }

  public apply(snapshot: RunStateSnapshot): OutcomeGateResult {
    const decision = this.resolver.resolve(snapshot);
    const resolved = this.resolver.apply(snapshot);

    const didChangeOutcome =
      resolved !== snapshot || !isDecisionEqual(snapshot, decision);

    const next =
      this.options.annotateNegativeOutcomes === true
        ? this.annotateResolvedSnapshot(resolved, decision)
        : resolved;

    const signal = buildOutcomeSignal(decision, next.tick);
    const signals = signal === null ? freezeArray<EngineSignal>([]) : freezeArray([signal]);

    return {
      snapshot: next,
      decision,
      didChangeOutcome,
      shouldFinalize: this.shouldFinalize(next),
      signals,
    };
  }

  public force(
    snapshot: RunStateSnapshot,
    input: ForcedOutcomeInput,
  ): OutcomeGateResult {
    const decision: RuntimeOutcomeDecision = {
      outcome: input.outcome,
      outcomeReason: input.reason,
      outcomeReasonCode: input.reasonCode,
      totalBudgetMs:
        snapshot.timers.seasonBudgetMs + snapshot.timers.extensionBudgetMs,
      remainingBudgetMs: Math.max(
        0,
        snapshot.timers.seasonBudgetMs +
          snapshot.timers.extensionBudgetMs -
          snapshot.timers.elapsedMs,
      ),
      isTerminal: true,
    };

    const forcedSnapshot = this.applyDecision(snapshot, decision, input.warning ?? null);

    const signal = createEngineSignal(
      'mode',
      input.severity ??
        (input.outcome === 'FREEDOM'
          ? 'INFO'
          : input.outcome === 'ABANDONED'
            ? 'ERROR'
            : 'WARN'),
      input.signalCode ?? `FORCED_OUTCOME_${input.outcome}`,
      `Forced outcome applied: ${input.outcome} (${input.reason})`,
      forcedSnapshot.tick,
      freezeArray([
        'engine-zero',
        'outcome-gate',
        'forced-outcome',
        `outcome:${input.outcome.toLowerCase()}`,
        `reason:${input.reasonCode.toLowerCase()}`,
      ]),
    );

    return {
      snapshot: forcedSnapshot,
      decision,
      didChangeOutcome: true,
      shouldFinalize: this.shouldFinalize(forcedSnapshot),
      signals: freezeArray([signal]),
    };
  }

  private annotateResolvedSnapshot(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
  ): RunStateSnapshot {
    const warning = negativeOutcomeWarning(decision);
    if (warning === null) {
      return snapshot;
    }

    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;
    next.telemetry.warnings = uniqueAppend(next.telemetry.warnings, warning);

    return deepFreeze(next) as RunStateSnapshot;
  }

  private applyDecision(
    snapshot: RunStateSnapshot,
    decision: RuntimeOutcomeDecision,
    warning: string | null,
  ): RunStateSnapshot {
    const next = cloneJson(snapshot) as Mutable<RunStateSnapshot>;

    next.outcome = decision.outcome;
    next.telemetry.outcomeReason = decision.outcomeReason;
    next.telemetry.outcomeReasonCode = decision.outcomeReasonCode;

    if (warning !== null && warning.length > 0) {
      next.telemetry.warnings = uniqueAppend(next.telemetry.warnings, warning);
    }

    next.tags = uniqueAppendMany(next.tags, freezeArray([
      'run:terminal',
      `run:terminal:${decision.outcome === null ? 'none' : decision.outcome.toLowerCase()}`,
    ]));

    return deepFreeze(next) as RunStateSnapshot;
  }
}