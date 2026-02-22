interface Variable {
name: string;
value: number | string;
}

interface Condition {
variableName: string;
operator: '==' | '!=';
value: string | number;
}

interface Action {
key: string;
operation: 'set' | 'increment' | 'decrement';
targetVariable: string;
value?: number | string;
}

type Rule = {
condition: Condition;
actions: Action[];
};

interface ExperimentDefinition {
name: string;
description?: string;
variables?: Variable[];
rules: Rule[];
startTime: Date;
endTime?: Date;
}

function createExperiment(definition: ExperimentDefinition): void {
const { name, description, variables, rules, startTime, endTime } = definition;

// Create and configure the experiment object here...

// Save the experiment to a database or storage service...

// Start the experiment at the specified time...
}
