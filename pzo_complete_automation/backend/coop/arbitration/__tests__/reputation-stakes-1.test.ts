import { calculateReputationStakes } from '../reputation-stakes';
import { CoopMember, ReputationScore } from '../../../interfaces';

describe('calculateReputationStakes', () => {
const member1: CoopMember = {
id: '1',
reputation: ReputationScore.NEUTRAL,
stakes: 0,
};

const member2: CoopMember = {
id: '2',
reputation: ReputationScore.BAD,
stakes: 10,
};

const member3: CoopMember = {
id: '3',
reputation: ReputationScore.GOOD,
stakes: 5,
};

it('should calculate correct stakes for neutral members', () => {
expect(calculateReputationStakes([member1], [])).toEqual([0]);
});

it('should correctly distribute stakes to bad members first', () => {
const result = calculateReputationStakes([member2, member1], [15]);
expect(result).toEqual([10, 5]);
});

it('should correctly distribute stakes to good members last', () => {
const result = calculateReputationStakes([member3, member2, member1], [20]);
expect(result).toEqual([5, 10, 5]);
});
});
