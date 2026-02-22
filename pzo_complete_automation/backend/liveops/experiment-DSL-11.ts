import { Injectable } from '@nestjs/common';
import { ExperimentRule, ExperimentTarget, ExperimentVariant } from './experiment.interface';

@Injectable()
export class ExperimentService {
private experiments: Map<string, Experiment> = new Map();

createExperiment(id: string, rule: ExperimentRule): void {
this.experiments.set(id, new Experiment(rule));
}

updateExperiment(id: string, updates: Partial<ExperimentRule>): void {
const experiment = this.experiments.get(id);
if (experiment) {
Object.assign(experiment.rule, updates);
}
}

getExperiment(id: string): Experiment | undefined {
return this.experiments.get(id);
}
}

class Experiment implements ExperimentRule {
constructor(private rule: ExperimentRule) {}

public target(): ExperimentTarget {
return this.rule.target;
}

public variants(): Map<string, ExperimentVariant> {
const variantMap = new Map();
this.rule.variants.forEach((variant) => {
variantMap.set(variant.id, new ExperimentVariant(variant));
});
return variantMap;
}
}

class ExperimentVariant implements ExperimentVariant {
constructor(private variant: ExperimentVariant) {}

public id(): string {
return this.variant.id;
}

public weight(): number {
return this.variant.weight;
}

public actions(): Map<string, any> {
const actionMap = new Map();
this.variant.actions.forEach((action) => {
actionMap.set(action.key, action.value);
});
return actionMap;
}
}
