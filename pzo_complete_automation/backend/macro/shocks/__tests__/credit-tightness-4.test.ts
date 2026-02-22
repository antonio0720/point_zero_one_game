import { assert } from 'assert';
import { makeScenario } from '../../../scenarios';
import { CreditTightness4 } from '../credit-tightness-4';

describe('Macro systems - credit-tightness-4', () => {
let scenario: any;
let shock: any;

beforeEach(() => {
scenario = makeScenario();
shock = new CreditTightness4(scenario);
});

it('should have the correct name', () => {
assert.equal(shock.name, 'credit-tightness-4');
});

// Add more test cases as needed
});
