interface Feature {
name: string;
defaultState: boolean;
}

interface Rule {
featureName: string;
condition: (user: User) => boolean;
state: boolean;
}

interface User {
userId: string;
attributes: Record<string, any>;
}

class Experiment {
private features: Feature[];
private rules: Rule[];

constructor(features: Feature[], rules: Rule[]) {
this.features = features;
this.rules = rules;
}

getFeatureState(user: User): boolean {
const userMatchesRule = this.rules.find((rule) => rule.condition(user));

if (userMatchesRule) {
return userMatchesRule.state;
}

const feature = this.features.find((feature) => feature.name === userMatchesRule?.featureName);

return feature ? feature.defaultState : false;
}
}
