// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/game/engine/zero/TickPlan.ts

/*
 * POINT ZERO ONE — BACKEND ENGINE ZERO
 * /backend/src/game/engine/zero/TickPlan.ts
 *
 * Doctrine:
 * - zero wraps backend/core TickSequence rather than duplicating it
 * - step enablement is policy-driven and queryable
 * - the tick plan must remain deterministic and inspectable
 */

import {
  TICK_SEQUENCE,
  TICK_STEP_DESCRIPTORS,
  type TickStep,
  type TickStepDescriptor,
} from '../core/TickSequence';
import type { OrchestratorConfig } from './OrchestratorConfig';
import type { TickPlanEntry, TickPlanSnapshot } from './zero.types';

function freezeArray<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...items]);
}

function freezeEntry(entry: TickPlanEntry): TickPlanEntry {
  return Object.freeze({ ...entry });
}

export class TickPlan {
  private readonly entries: readonly TickPlanEntry[];

  public constructor(private readonly config: OrchestratorConfig) {
    this.entries = freezeArray(
      TICK_SEQUENCE.map((step) =>
        freezeEntry({
          step,
          descriptor: TICK_STEP_DESCRIPTORS[step],
          enabled: config.stepConfig[step].enabled,
        }),
      ),
    );
  }

  public snapshot(): TickPlanSnapshot {
    return Object.freeze({
      entries: this.entries,
      size: this.entries.length,
    });
  }

  public enabledEntries(): readonly TickPlanEntry[] {
    return this.entries.filter((entry) => entry.enabled);
  }

  public isEnabled(step: TickStep): boolean {
    return this.config.stepConfig[step].enabled;
  }

  public getEntry(step: TickStep): TickPlanEntry {
    const entry = this.entries.find((candidate) => candidate.step === step);

    if (entry === undefined) {
      throw new Error(`[TickPlan] Missing plan entry for step ${step}.`);
    }

    return entry;
  }

  public getDescriptor(step: TickStep): TickStepDescriptor {
    return this.getEntry(step).descriptor;
  }

  public assertEnabled(step: TickStep): void {
    if (!this.isEnabled(step)) {
      throw new Error(`[TickPlan] Step ${step} is disabled by orchestrator policy.`);
    }
  }

  public firstEnabledStep(): TickStep | null {
    return this.enabledEntries()[0]?.step ?? null;
  }

  public lastEnabledStep(): TickStep | null {
    const enabled = this.enabledEntries();
    return enabled.length > 0 ? enabled[enabled.length - 1].step : null;
  }
}