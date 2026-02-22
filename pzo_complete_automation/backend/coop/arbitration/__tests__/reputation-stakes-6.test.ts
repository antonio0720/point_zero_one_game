import { ReputationStakes6 } from '../reputation-stakes-6';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Reputation Stakes 6', () => {
let reputationStakes6: ReputationStakes6;

beforeEach(() => {
reputationStakes6 = new ReputationStakes6();
});

it('should calculate the winning amount for a single player', () => {
const input = { stake: 10, reputation: 5 };
const output = reputationStakes6.calculateWinningAmount(input);
expect(output).to.equal(20);
});

it('should calculate the winning amount for multiple players', () => {
const input = { players: [{ stake: 10, reputation: 5 }, { stake: 20, reputation: 7 }] };
const output = reputationStakes6.calculateWinningAmounts(input);
expect(output).to.deep.equal([30, 40]);
});

// Add more test cases as needed
});
