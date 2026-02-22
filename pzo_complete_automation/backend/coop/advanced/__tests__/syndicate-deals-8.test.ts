import { expect } from 'chai';
import { SyndicateDeals } from '../../../src/backend/coop/advanced/syndicate-deals';
import { Deal, Player } from '../../../src/common';

describe('Syndicate Deals 8', () => {
let syndicateDeals: SyndicateDeals;

beforeEach(() => {
syndicateDeals = new SyndicateDeals();
});

it('handles simple deals', () => {
const player1 = new Player('Alice');
const player2 = new Player('Bob');
const deal1 = new Deal(10, player1);
const deal2 = new Deal(5, player2);

syndicateDeals.syndicateDeals([deal1, deal2], [player1, player2]);

expect(player1.deals).to.deep.equal([deal1, new Deal(5, player2)]);
expect(player2.deals).to.deep.equal([deal2, new Deal(3, player1)]);
});

// Add more test cases as needed...
});
