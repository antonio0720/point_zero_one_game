import { RivalryLedger13 } from '../rivalry-ledger-13';
import { LedgerEntry } from '../../common/interfaces';

describe('RivalryLedger13', () => {
const ledger: LedgerEntry[] = [];

const rivalryLedger = new RivalryLedger13(ledger);

it('should initialize correctly', () => {
expect(rivalryLedger).toBeInstanceOf(RivalryLedger13);
});

it('adds entries correctly', () => {
rivalryLedger.addEntry('PlayerA', 'Win');
rivalryLedger.addEntry('PlayerB', 'Loss');

expect(ledger).toEqual([{ player: 'PlayerA', action: 'Win' }, { player: 'PlayerB', action: 'Loss' }]);
});

it('calculates scores correctly', () => {
for (let i = 0; i < 10; i++) {
rivalryLedger.addEntry('PlayerA', 'Win');
rivalryLedger.addEntry('PlayerB', 'Loss');
}

expect(rivalryLedger.getScore('PlayerA')).toEqual(10);
expect(rivalryLedger.getScore('PlayerB')).toEqual(0);
});
});
