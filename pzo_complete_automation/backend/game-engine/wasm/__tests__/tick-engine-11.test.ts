import { setupWorker, setImmediate, clearTimeout, setTimeout } from 'msw';
import { rest } from 'msw';
import * as wasm from '../game-engine/wasm/pkg/game_engine_bg.js';
import { TestEnvironment } from './test-environment.js';
import assert from 'assert';

const worker = setupWorker(
rest.get('/api/tick', (_, res, ctx) => {
return res(ctx.json({ result: wasm.tickEngine() }));
})
);

beforeAll(() => worker.start());
afterEach(() => worker.resetHandlers());
afterAll(() => worker.stop());

describe('Deterministic run engine - tick-engine-11', () => {
const testEnvironment = new TestEnvironment();

beforeEach(() => {
wasm.init(testEnvironment);
});

it('should return the correct output for test case 11', async () => {
const initialState = [
[-1, -1],
[-1, 0],
[-1, 1],
[0, -1],
[0, 0],
[0, 1],
[1, -1],
[1, 0],
[1, 1]
];

const expectedOutput = [
[-1, -2],
[-2, -1],
[-3, -1],
[-1, -1],
[-1, 0],
[-1, 1],
[-2, 1],
[-3, 1],
[-4, 1]
];

const { result } = await testEnvironment.fetch('/api/tick');
assert.deepEqual(result, expectedOutput);
});
});
