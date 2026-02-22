import { describe, it, expect } from '@jest/globals';
import { PlaybookRunner } from '../../../src/playbooks/PlaybookRunner';
import { AutomatedPlaybooks2 } from '../../../src/incident-response/AutomatedPlaybooks2';
import { IncidentResponseFixtures } from '../fixtures/IncidentResponseFixtures';

describe('Security incident response - automated-playbooks-2', () => {
const playbookRunner = new PlaybookRunner();
const automatedPlaybooks2 = new AutomatedPlaybooks2();
const fixtures = new IncidentResponseFixtures();

it('should run correctly for a simple incident', async () => {
const incident = fixtures.getSimpleIncident();
await playbookRunner.run(incident, automatedPlaybooks2);
expect(incident).toEqual(fixtures.getExpectedSimpleIncidentResult());
});

it('should handle incidents with multiple hosts', async () => {
const incident = fixtures.getMultipleHostsIncident();
await playbookRunner.run(incident, automatedPlaybooks2);
expect(incident).toEqual(fixtures.getExpectedMultipleHostsIncidentResult());
});

it('should handle incidents with various tasks', async () => {
const incident = fixtures.getVariousTasksIncident();
await playbookRunner.run(incident, automatedPlaybooks2);
expect(incident).toEqual(fixtures.getExpectedVariousTasksIncidentResult());
});
});
