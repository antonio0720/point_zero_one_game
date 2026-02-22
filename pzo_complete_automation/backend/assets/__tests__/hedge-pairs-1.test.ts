import { hedgePairs } from '../src/hedgePairs';
import { expect } from 'chai';

describe('Hedge Pairs', () => {
it('should return correct hedge pairs for given stocks', () => {
const result = hedgePairs(['AAPL', 'GOOG']);

// Replace the expected array with the actual expected output.
expect(result).to.deep.equal([
['AAPL', 'MSFT'],
['AAPL', 'AMZN'],
['AAPL', 'GOOGL'],
['GOOG', 'MSFT'],
['GOOG', 'AMZN'],
['GOOGL', 'MSFT'],
['GOOGL', 'AMZN'],
]);
});
});
