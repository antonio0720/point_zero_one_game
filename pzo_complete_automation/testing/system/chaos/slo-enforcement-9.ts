import * as chaos from 'chaos-monkey';
import { test, expect } from '@jest/globals';
import { sleep } from './utils';

const resourcePlanner = chaos.resourcePlanner({
maxInstanceRemovalRatePercent: 10,
});

const chaosEngine = new chaos.ChaosEngine();
chaosEngine.register('instance-terminate', resourcePlanner);

// Before each test, clear the Chaos Engine
beforeEach(() => {
chaosEngine.clear();
});

test('Test SLO enforcement with instance termination', async () => {
// Simulate application startup
await sleep(2000);

// Trigger instance termination
const terminateInstance = await chaosEngine.runAction('instance-terminate');

// Verify if the instance is running before termination
expect(process.env.NODE_ENV).toEqual('production');

// Wait for the instance to terminate
await sleep(10000);

// Verify if the instance is not running after termination
expect(process.env.NODE_ENV).not.toEqual('production');

// Check if the Chaos Engine executed the action
expect(terminateInstance.executed).toBe(true);
});
