/**
 * AfterAction Contract Interface
 */
export interface AfterActionContract {
  failure_mode?: string;
  strength_mode?: string;
  what_killed_you?: string;
  what_saved_you?: string[];
  one_tiny_action?: string;
  one_medium_action?: string;
  replay_suggestion_scenario_id?: number;
  free_resources?: { [key: string]: number };
}
