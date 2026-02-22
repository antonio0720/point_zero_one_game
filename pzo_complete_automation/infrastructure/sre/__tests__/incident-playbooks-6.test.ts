import { Playbook } from '../incident-playbooks';
import { PlaybookStep, PlaybookStepExecutionResult } from '../playbook-step';
import { Incident } from '../incident';
import { TestPlaybookStep1, TestPlaybookStep2 } from './test-playbook-steps';

describe('Incident Playbooks', () => {
let playbook: Playbook;
let incident: Incident;

beforeEach(() => {
playbook = new Playbook();
incident = new Incident();
});

it('should run playbook steps correctly', () => {
playbook.addStep(new TestPlaybookStep1());
playbook.addStep(new TestPlaybookStep2());

const result = playbook.run(incident);

expect(result).toEqual([
PlaybookStepExecutionResult.success,
PlaybookStepExecutionResult.success,
]);
});
});

class TestPlaybookStep1 implements PlaybookStep {
public execute(): Promise<PlaybookStepExecutionResult> {
// Implement the test playbook step logic here...
return Promise.resolve(PlaybookStepExecutionResult.success);
}
}

class TestPlaybookStep2 implements PlaybookStep {
public execute(): Promise<PlaybookStepExecutionResult> {
// Implement the test playbook step logic here...
return Promise.resolve(PlaybookStepExecutionResult.success);
}
}
