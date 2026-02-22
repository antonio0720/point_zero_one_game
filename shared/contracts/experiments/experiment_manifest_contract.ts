Here is the TypeScript file `shared/contracts/experiments/experiment_manifest_contract.ts`:

```typescript
/**
 * Experiment manifest contract
 */

export interface ExperimentManifest {
  /** Unique identifier for the experiment */
  id: string;

  /** Name of the experiment */
  name: string;

  /** Description of the experiment */
  description?: string;

  /** Variants that can be assigned to players in this experiment */
  variants: ExperimentVariant[];

  /** Knobs that are allowed to be modified for each variant */
  allowedKnobs: string[];

  /** Target cohort for the experiment */
  targetCohort: string;

  /** Invariants that must hold true for the experiment to be valid */
  invariants?: ExperimentInvariant[];

  /** Thresholds for kill-switch conditions */
  killSwitchThresholds?: KillSwitchThreshold[];

  /** Rollout plan for the experiment */
  rolloutPlan: RolloutPlan;
}

export interface ExperimentVariant {
  /** Unique identifier for the variant */
  id: string;

  /** Name of the variant */
  name: string;

  /** Description of the variant */
  description?: string;

  /** Initial configuration for the variant */
  initialConfiguration: ExperimentKnob[];
}

export interface ExperimentInvariant {
  /** Unique identifier for the invariant */
  id: string;

  /** Name of the invariant */
  name: string;

  /** Description of the invariant */
  description?: string;

  /** Condition that must hold true for the experiment to be valid */
  condition: (manifest: ExperimentManifest) => boolean;
}

export interface KillSwitchThreshold {
  /** Unique identifier for the threshold */
  id: string;

  /** Name of the threshold */
  name: string;

  /** Description of the threshold */
  description?: string;

  /** Condition that triggers the kill-switch if exceeded */
  condition: (manifest: ExperimentManifest, context: ExperimentContext) => number;

  /** Threshold value */
  threshold: number;
}

export interface ExperimentKnob {
  /** Unique identifier for the knob */
  id: string;

  /** Name of the knob */
  name: string;

  /** Description of the knob */
  description?: string;

  /** Current value of the knob */
  currentValue: number | boolean | string;
}

export interface ExperimentContext {
  /** Current timestamp in milliseconds */
  timestamp: number;

  /** Current game state */
  gameState: GameState;
}

export interface RolloutPlan {
  /** Start time for the experiment in Unix timestamp format */
  startTime: number;

  /** End time for the experiment in Unix timestamp format */
  endTime?: number;

  /** Initial percentage of players to assign to each variant */
  initialAssignmentsPercentage?: { [variantId: string]: number };

  /** Schedule for changing the percentage of players assigned to each variant over time */
  assignmentSchedule?: AssignmentSchedule[];
}

export interface AssignmentSchedule {
  /** Unix timestamp when the schedule starts */
  startTime: number;

  /** Unix timestamp when the schedule ends */
  endTime: number;

  /** New percentage of players to assign to each variant */
  newAssignmentsPercentage: { [variantId: string]: number };
}
