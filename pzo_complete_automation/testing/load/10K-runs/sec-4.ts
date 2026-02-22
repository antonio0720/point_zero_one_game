import * as faker from 'faker';
import * as sinon from 'sinon';
import { beforeEach, describe, expect, it } from '@jest/globals';

class Service {
async process() {
// Your service logic here
}
}

let service: Service;
let clock: Sinon.SinonFakeTimers;

beforeEach(() => {
service = new Service();
clock = sinon.useFakeTimers({ toMock: ['Date'] });
});

afterEach(() => {
clock.restore();
});

describe('Service', () => {
it('should process data correctly', async () => {
const inputData = Array.from({ length: 10000 }).map(() => faker.lorem.sentence());
const outputData = inputData.map((input) => `Processed: ${input}`);

// Mock the service function with the provided input and output data for every run
sinon.stub(service, 'process').callsFake(() => Promise.resolve(outputData[0]));

const processedData = await Promise.all(inputData.map((data) => service.process()));

expect(processedData).toEqual(outputData);
});
});
