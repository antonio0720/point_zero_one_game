// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/OrchestratorDiagnostics.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/OrchestratorDiagnostics.ts
 *
 * Doctrine:
 * - diagnostics are operational truth, not gameplay truth
 * - zero retains bounded summaries and step errors for fast inspection
 * - diagnostics must be cheap enough to leave enabled in normal development
 */

import type {
  OrchestratorTelemetryRecord,
  TickExecutionSummary,
  TickStepErrorRecord,
} from './zero.types';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

export class OrchestratorDiagnostics {
  private readonly tickSummaries: TickExecutionSummary[] = [];
  private readonly errors: TickStepErrorRecord[] = [];
  private readonly telemetry: OrchestratorTelemetryRecord[] = [];

  public constructor(
    private readonly retainLastTickSummaries = 50,
    private readonly retainLastErrors = 100,
  ) {}

  public recordTickSummary(summary: TickExecutionSummary): void {
    this.tickSummaries.push(summary);

    if (this.tickSummaries.length > this.retainLastTickSummaries) {
      this.tickSummaries.splice(
        0,
        this.tickSummaries.length - this.retainLastTickSummaries,
      );
    }
  }

  public recordError(error: TickStepErrorRecord): void {
    this.errors.push(error);

    if (this.errors.length > this.retainLastErrors) {
      this.errors.splice(0, this.errors.length - this.retainLastErrors);
    }
  }

  public recordTelemetry(entry: OrchestratorTelemetryRecord): void {
    this.telemetry.push(entry);

    if (this.telemetry.length > this.retainLastTickSummaries) {
      this.telemetry.splice(
        0,
        this.telemetry.length - this.retainLastTickSummaries,
      );
    }
  }

  public getLastTickSummary(): TickExecutionSummary | null {
    return this.tickSummaries.length > 0
      ? this.tickSummaries[this.tickSummaries.length - 1]
      : null;
  }

  public getTickSummaries(): readonly TickExecutionSummary[] {
    return freezeArray(this.tickSummaries);
  }

  public getErrors(): readonly TickStepErrorRecord[] {
    return freezeArray(this.errors);
  }

  public getTelemetry(): readonly OrchestratorTelemetryRecord[] {
    return freezeArray(this.telemetry);
  }

  public clear(): void {
    this.tickSummaries.length = 0;
    this.errors.length = 0;
    this.telemetry.length = 0;
  }
}