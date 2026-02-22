import { HedgePairs2 } from '../hedge-pairs-2';
import { Asset } from '../../asset';

describe('Hedge Pairs 2', () => {
const asset1 = new Asset('Asset1');
const asset2 = new Asset('Asset2');
const hedgePairs2 = new HedgePairs2([asset1, asset2]);

it('should calculate the hedged price correctly', () => {
// Given
const prices = {
'Asset1': 10,
'Asset2': 5,
};

// When
const hedgedPrice = hedgePairs2.hedgedPrice(prices);

// Then
expect(hedgedPrice).toBeCloseTo(15, 2);
});

it('should calculate the optimal allocation correctly', () => {
// Given
const prices = {
'Asset1': 12,
'Asset2': 4,
};

const weights = hedgePairs2.optimalAllocation(prices);

// Then
expect(weights[asset1]).toBeCloseTo(0.8, 2);
expect(weights[asset2]).toBeCloseTo(0.2, 2);
});
});
