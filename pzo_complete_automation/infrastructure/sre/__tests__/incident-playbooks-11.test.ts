import { IncidentPlaybook } from '../../incident-playbooks';
import { Alert, Service } from '../models';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';

jest.mock('fs', () => ({
...jest.requireActual('fs'),
promises: {
...jest.requireActual('fs').promises,
readFile: jest.fn(),
},
}));

describe('IncidentPlaybook', () => {
const mockService = new Service({ name: 'Mock Service' });
const mockEventEmitter = new EventEmitter();
const mockAlert = new Alert({ service: mockService, title: 'Test Incident', description: 'This is a test incident.' });

beforeEach(() => {
jest.clearAllMocks();
});

it('should load playbook from file and call onStart when incident starts', async () => {
const playbookContent = `export class MockPlaybook {
static onStart(alert: Alert) {}
}`;
fs.readFile.mockResolvedValueOnce(Buffer.from(playbookContent));

const playbook = new IncidentPlaybook('path/to/playbook.ts');
await playbook.onIncidentStart(mockAlert);

expect(fs.readFile).toHaveBeenCalledWith('path/to/playbook.ts', 'utf8');
expect(MockPlaybook.onStart).toHaveBeenCalledWith(mockAlert);
});

it('should call onRun for each function in playbook when incident runs', async () => {
const playbookContent = `export class MockPlaybook {
static onRunFunction1() {}
static onRunFunction2() {}
}`;
fs.readFile.mockResolvedValueOnce(Buffer.from(playbookContent));

const playbook = new IncidentPlaybook('path/to/playbook.ts');
await playbook.onIncidentStart(mockAlert);
mockEventEmitter.emit('run', mockAlert);

expect(MockPlaybook.onRunFunction1).toHaveBeenCalledWith(mockAlert, mockEventEmitter);
expect(MockPlaybook.onRunFunction2).toHaveBeenCalledWith(mockAlert, mockEventEmitter);
});

it('should call onEnd for playbook when incident ends', async () => {
const playbookContent = `export class MockPlaybook {
static onEnd() {}
}`;
fs.readFile.mockResolvedValueOnce(Buffer.from(playbookContent));

const playbook = new IncidentPlaybook('path/to/playbook.ts');
await playbook.onIncidentStart(mockAlert);
mockEventEmitter.emit('end', mockAlert);

expect(MockPlaybook.onEnd).toHaveBeenCalledWith(mockAlert);
});
});
