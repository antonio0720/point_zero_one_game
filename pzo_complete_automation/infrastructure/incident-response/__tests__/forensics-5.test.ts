import { Forensics5 } from '../../src/incident-response/forensics-5';
import { MockAdapter, MockNetwork } from 'mock-adapter';
import axios from 'axios';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Forensics5', () => {
let mock;
let instance: Forensics5;

beforeEach(() => {
mock = new MockAdapter(axios);
instance = new Forensics5();
});

afterEach(() => {
mock.restore();
});

it('should return the correct forensic findings when the network response is successful', async () => {
const expectedFindings = ['finding1', 'finding2'];
mock.onGet('/api/forensics-5').reply(200, expectedFindings);

const results = await instance.execute();
expect(results).to.deep.equal(expectedFindings);
});

it('should throw an error when the network request fails', async () => {
mock.onGet('/api/forensics-5').networkError();

try {
await instance.execute();
sinon.assert.notCalled(console.error);
} catch (err) {
expect(err).to.exist;
sinon.assert.calledOnce(console.error);
}
});

it('should call the network request once when execute is called', async () => {
mock.onGet('/api/forensics-5').once();

await instance.execute();
sinon.assert.calledOnce(mock.requests.get);
});
});
