import { ScenarioBuilder } from '../scenario-builder';
import { Scenario } from '../../models/Scenario';
import { expect } from 'chai';

describe('Scenario Builder', () => {
describe('Scenario-Builder-12', () => {
let scenarioBuilder: ScenarioBuilder;

beforeEach(() => {
scenarioBuilder = new ScenarioBuilder();
});

it('should build the correct Scenario for Scenario-Builder-12', () => {
const scenario: Scenario = scenarioBuilder
.withStep('step1')
.withCondition((context) => context.valueA === 'expectedValue')
.withAction(() => { /* your action implementation */ })
.build();

expect(scenario).to.deep.equal({
id: '', // Auto-generated ID
name: 'Scenario-Builder-12',
steps: ['step1'],
condition: (context) => context.valueA === 'expectedValue',
action: () => { /* your action implementation */ },
});
});
});
});
