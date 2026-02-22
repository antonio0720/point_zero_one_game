import { proofTiers5 } from '../proof-tiers-5';
import { Achievement } from '../../achievements';
import { Progression } from '../../progression';

describe('proofTiers5', () => {
const achievement1 = new Achievement('achievement1');
const achievement2 = new Achievement('achievement2');
const progression = new Progression();

it('should correctly track proof tiers for two achievements', () => {
progression.unlock(achievement1);
progression.unlock(achievement1); // Tier 1

progression.unlock(achievement2); // Tier 2
progression.unlock(achievement2); // Tier 3
progression.unlock(achievement2); // Tier 4 (should not increase tier)

expect(progression.getProofTier('tier5')).toBe(0);
expect(progression.getProofTier('tier4')).toBe(1);
expect(progression.getProofTier('tier3')).toBe(2);
expect(progression.getProofTier('tier2')).toBe(3);
expect(progression.getProofTier('tier1')).toBe(2); // should be 2 since we have unlocked achievement1 twice
});

it('should correctly track proof tiers for a single achievement', () => {
for (let i = 0; i < 5; i++) {
progression.unlock(achievement1);
}

expect(progression.getProofTier('tier5')).toBe(1); // should be 1 since we have unlocked achievement1 5 times
});
});
