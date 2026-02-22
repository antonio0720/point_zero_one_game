import { quarantine } from '../quarantine-11';
import { expect } from 'chai';
import 'mocha';

describe('Quarantine', () => {
it('should quarantine a dangerous model', () => {
const dangerousModel = {}; // your dangerous model here
const quarantinedModel = quarantine(dangerousModel);
expect(quarantinedModel).to.not.equal(dangerousModel);
// add more assertions to check if the quarantine process is working correctly
});

it('should return the original model when not dangerous', () => {
const safeModel = {}; // your safe model here
const quarantinedModel = quarantine(safeModel);
expect(quarantinedModel).to.equal(safeModel);
});
});
