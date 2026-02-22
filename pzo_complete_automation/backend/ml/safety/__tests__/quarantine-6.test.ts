import { quarantine6 } from '../quarantine-6';
import { expect } from 'expect';
import { spy, stub } from 'sinon';

describe('ML safety + integrity - quarantine-6', () => {
let quarantineSpy;

beforeEach(() => {
quarantineSpy = spy(quarantine6, 'quarantine');
});

afterEach(() => {
quarantineSpy.restore();
});

it('should call quarantine function', () => {
// Add your test case here
const args = [/* your arguments */];
quarantine6(...args);
expect(quarantineSpy.calledOnce).toBe(true);
});

it('should quarantine with correct arguments', () => {
// Add your test case here
const args = [/* your arguments */];
quarantineSpy.callsArgWith(1, /* expected error code */, /* expected data */);
});

it('should throw an error when quarantine fails', () => {
// Add your test case here
const errorCode = /* your error code */;
const errorData = /* your error data */;
quarantineSpy.callsArgWith(1, errorCode, errorData);
expect(() => quarantine6(/* your arguments */)).toThrowError(`${errorData}: ${errorCode}`);
});
});
