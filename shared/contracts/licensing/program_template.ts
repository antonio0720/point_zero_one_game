Here is the TypeScript file `shared/contracts/licensing/program_template.ts` based on your specifications:

```typescript
/**
 * ProgramTemplate class representing a template for financial roguelike games.
 */
export class ProgramTemplate {
    /**
     * The unique identifier of the program template.
     */
    public readonly template_id: string;

    /**
     * The duration of the program in weeks.
     */
    public readonly duration_weeks: number;

    /**
     * The weekly plan for the program.
     */
    public readonly weekly_plan: WeeklyPlan[];

    /**
     * The sequence of packs in the program.
     */
    public readonly pack_sequence: PackSequence[];

    /**
     * The schedule for benchmarking purposes.
     */
    public readonly benchmark_schedule: BenchmarkSchedule[];

    /**
     * The rules for cohort formation.
     */
    public readonly cohort_rules: CohortRules;

    /**
     * The policy for ladder mode.
     */
    public readonly ladder_mode_policy: LadderModePolicy;

    /**
     * Creates a new instance of ProgramTemplate with the given properties.
     * @param templateId - The unique identifier of the program template.
     * @param durationWeeks - The duration of the program in weeks.
     * @param weeklyPlan - The weekly plan for the program.
     * @param packSequence - The sequence of packs in the program.
     * @param benchmarkSchedule - The schedule for benchmarking purposes.
     * @param cohortRules - The rules for cohort formation.
     * @param ladderModePolicy - The policy for ladder mode.
     */
    constructor(
        templateId: string,
        durationWeeks: number,
        weeklyPlan: WeeklyPlan[],
        packSequence: PackSequence[],
        benchmarkSchedule: BenchmarkSchedule[],
        cohortRules: CohortRules,
        ladderModePolicy: LadderModePolicy
    ) {
        this.template_id = templateId;
        this.duration_weeks = durationWeeks;
        this.weekly_plan = weeklyPlan;
        this.pack_sequence = packSequence;
        this.benchmark_schedule = benchmarkSchedule;
        this.cohort_rules = cohortRules;
        this.ladder_mode_policy = ladderModePolicy;
    }
}

/**
 * WeeklyPlan class representing a plan for a week in the program.
 */
export interface WeeklyPlan {
    /**
     * The unique identifier of the weekly plan.
     */
    id: string;

    /**
     * The activities planned for the week.
     */
    activities: Activity[];
}

/**
 * PackSequence class representing a sequence of packs in the program.
 */
export interface PackSequence {
    /**
     * The unique identifier of the pack sequence.
     */
    id: string;

    /**
     * The sequence of packs in the order they should be unlocked.
     */
    pack_ids: string[];
}

/**
 * BenchmarkSchedule class representing a schedule for benchmarking purposes.
 */
export interface BenchmarkSchedule {
    /**
     * The unique identifier of the benchmark schedule.
     */
    id: string;

    /**
     * The weeks when benchmarks should be conducted.
     */
    weeks: number[];
}

/**
 * CohortRules class representing the rules for cohort formation.
 */
export interface CohortRules {
    /**
     * The maximum number of participants in a cohort.
     */
    max_participants: number;

    /**
     * The minimum number of participants required to start a new cohort.
     */
    min_participants: number;
}

/**
 * LadderModePolicy class representing the policy for ladder mode.
 */
export interface LadderModePolicy {
    /**
     * Whether ladder mode is enabled or not.
     */
    enabled: boolean;

    /**
     * The criteria for advancing in the ladder.
     */
    advancement_criteria: AdvancementCriteria[];
}

/**
 * AdvancementCriteria class representing the criteria for advancing in the ladder.
 */
export interface AdvancementCriteria {
    /**
     * The type of criterion (e.g., score, rank).
     */
    type: string;

    /**
     * The value required to meet the criterion.
     */
    value: number;
}
