import { GovernanceKernel } from '../governance-kernel';
import { CeclV1 } from '../cecl-v1';
import { expect } from '@jest/globals';

describe('Governance Kernel + CECL_v1 - Crash Loop Recovery', () => {
let governanceKernel: GovernanceKernel;
let ceclV1: CeclV1;

beforeEach(() => {
governanceKernel = new GovernanceKernel();
ceclV1 = new CeclV1();
});

it('should handle crash-loop-recovery-6 scenario', () => {
// Arrange
const initialState = {};
const action = { type: 'SOME_ACTION' };

governanceKernel.registerReducer('some reducer', (state, action) => {
// This reducer will throw an error on purpose to simulate a crash loop
if (action.type === 'SOME_ACTION') {
throw new Error('Crash Loop');
}
return state;
});

governanceKernel.applyMiddleware((getState, getActions) => next => action => {
// Mock middleware to handle crash loop recovery
if (action.type === 'SOME_ACTION' && getState().crashCount < 3) {
const newState = ceclV1.calculateNewState(getState, action);
governanceKernel.dispatch({ type: 'RECOVER', payload: newState });
return next(action);
}

// If the crash loop has occurred more than 3 times, stop trying to recover
if (action.type === 'SOME_ACTION' && getState().crashCount >= 3) {
throw new Error('Crash Loop Recovery failed');
}
});

governanceKernel.initialize(initialState);

// Act & Assert
const stateBeforeCrash = governanceKernel.getState();
governanceKernel.dispatch(action);
expect(governanceKernel.getState()).not.toEqual(stateBeforeCrash);
});
});
