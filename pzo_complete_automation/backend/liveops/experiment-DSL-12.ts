export interface Feature {
name: string;
defaultValue: boolean | number | string;
}

export interface Rule {
condition: (context: Context) => boolean;
action: (context: Context) => void;
}

export interface Experiment {
name: string;
features: Feature[];
rules: Rule[];
}

interface Context {
userId?: string;
timestamp?: number;
userProperties?: Record<string, any>;
customMetrics?: Record<string, number>;
experimentName?: string;
}

function applyFeature(context: Context, features: Feature): void {
const featureValue = context.userProperties?.[features.name] ?? features.defaultValue;

if (typeof featureValue === 'boolean') {
context[features.name] = featureValue;
} else if (typeof featureValue === 'number') {
context['feature_' + features.name] = featureValue;
} else {
context[features.name] = featureValue ?? '';
}
}

function applyRule(context: Context, rule: Rule): void {
if (rule.condition(context)) {
rule.action(context);
}
}

function runExperiment(experiment: Experiment, context: Context): void {
experiment.features.forEach((feature) => applyFeature(context, feature));

experiment.rules.forEach((rule) => applyRule(context, rule));
}
