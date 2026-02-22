import { rollback as rollbackFunction } from '../release';
import * as assert from 'assert';

describe('rollback-13', () => {
it('should correctly rollback to the previous release', () => {
const initialState = {}; // Initial state before the release
const expectedRolledBackState = {}; // Expected state after rolling back

// Perform a release and store the current state
const currentState = rollbackFunction(initialState);
assert.notDeepStrictEqual(currentState, initialState);

// Rollback to the previous state and compare with expected rolled-back state
const rolledBackState = rollbackFunction(currentState);
assert.deepStrictEqual(rolledBackState, expectedRolledBackState);
});

it('should return the initial state when no release has been performed', () => {
const initialState = {};
const rolledBackState = rollbackFunction(initialState);
assert.deepStrictEqual(rolledBackState, initialState);
});
});
