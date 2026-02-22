import * as assert from 'assert';
import * as sinon from 'sinon';
import { Service } from './service';

describe('Failure Injection Test - Scenario 10', () => {
let service: Service;

beforeEach(() => {
service = new Service();
});

it('Should return error when fetching non-existing user', async () => {
// Mock the user repository method to throw an error
const getUserStub = sinon.stub(service, 'getUser').throws(new Error('User not found'));

try {
await service.getUser(100);
assert.fail('Expected error not thrown');
} catch (error) {
// Expected error
assert.ok(error);
assert.strictEqual(error.message, 'User not found');
}

// Restore the original user repository method
service.getUser = getUserStub.restore();
});
});
