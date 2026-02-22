import { synthesizeDeal, AdvancedCoop } from '../../coop/advanced';
import { Deal, Player } from '../../interfaces';
import assert from 'assert';

describe('syndicateDeals-3', () => {
let advancedCoop: AdvancedCoop;

beforeEach(() => {
advancedCoop = new AdvancedCoop();
});

it('should syndicate deals correctly', () => {
const player1: Player = { id: 'p1', balance: 100 };
const player2: Player = { id: 'p2', balance: 50 };
const player3: Player = { id: 'p3', balance: 75 };

advancedCoop.addPlayer(player1);
advancedCoop.addPlayer(player2);
advancedCoop.addPlayer(player3);

const deal1: Deal = {
id: 'd1',
value: 20,
playerId: player1.id,
syndicateSize: 3,
isSyndicated: false,
};

advancedCoop.addDeal(deal1);

advancedCoop.syndicateDeals();

const syndicate = advancedCoop.getDeal('d1')?.syndicate;
assert.deepEqual(syndicate, [player1.id, player2.id, player3.id]);
});

// Add more test cases as needed
});
