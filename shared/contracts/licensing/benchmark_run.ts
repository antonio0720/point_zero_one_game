Here is the TypeScript file `shared/contracts/licensing/benchmark_run.ts` based on your specifications:

```typescript
/**
 * BenchmarkRun contract for Point Zero One Digital's financial roguelike game.
 */

export interface BenchmarkRun {
  benchmark_id: string;
  scenario_id: string;
  fixed_seed_commit_hash: string;
  pinned_episode_version: string;
  pinned_ruleset_id: string;
  scoring_profile_id: string;
  comparable_outputs?: ComparableOutput[];
}

export interface ComparableOutput {
  // Add fields as needed to represent the output of a benchmark run that can be compared with others.
}
