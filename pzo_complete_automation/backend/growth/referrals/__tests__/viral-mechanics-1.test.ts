import { ViralMechanics1 } from '../viral-mechanics-1';

describe('ViralMechanics1', () => {
it('should correctly calculate rewards', () => {
const viralMechanics = new ViralMechanics1();

expect(viralMechanics.calculateRewards(1)).toEqual([0, 1]);
expect(viralMechanics.calculateRewards(2)).toEqual([1, 2]);
expect(viralMechanics.calculateRewards(3)).toEqual([2, 3, 1]);
// Add more test cases as needed
});
});
