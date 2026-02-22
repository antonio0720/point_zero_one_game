export interface Experiment {
id: string;
name: string;
description?: string;
startDate: Date;
endDate: Date | null;
targetPopulation: TargetPopulation;
treatments: Treatment[];
}

interface TargetPopulation {
audience: Audience;
filters?: Filter[];
}

enum Audience {
ALL,
USERS_WITH_TAGS,
COHORT,
CUSTOM_AUDIENCE
}

interface Filter {
key: string;
operator: Operator;
value: any;
}

type Operator = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'IN' | 'NOT IN';

interface Treatment {
name: string;
variations?: Variation[];
rolloutStrategy: RolloutStrategy;
}

enum RolloutStrategy {
AB_TEST,
CANARY_RELEASE,
GATE_TOGGLE
}

interface Variation {
id: string;
weight: number;
config?: Config;
}

interface Config {
key1: string | number | boolean | null;
key2: string | number | boolean | null;
// add more keys as needed
}
