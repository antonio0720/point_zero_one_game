import { ProofTiers } from '../proof-tiers';
import { Achievement } from '../../achievements';
import { ProgressionService } from '../../progression-service';

describe('ProofTiers - proof-tiers-3', () => {
let proofTiers: ProofTiers;
let progressionService: ProgressionService;

beforeEach(() => {
proofTiers = new ProofTiers();
progressionService = new ProgressionService(proofTiers);
});

describe('calculateProgression', () => {
it('should calculate progression for proof-tiers-3 correctly', () => {
// Given
const userId = '123';
const proofData = [
{ id: 'p1', points: 10 },
{ id: 'p2', points: 20 },
{ id: 'p3', points: 30 },
{ id: 'p4', points: 40 },
];

proofTiers.registerProof('tier-1', 1);
proofTiers.registerProof('tier-2', 20);
proofTiers.registerProof('tier-3', 60);
proofTiers.registerProof('tier-4', 100);

// When
const progression = progressionService.calculateProgression(userId, proofData);

// Then
expect(progression.achievements).toEqual([
new Achievement('Started', 'proof-tiers-3'),
]);
expect(progression.currentTier).toBe('tier-1');
expect(progression.pointsProgress).toBe(1);
expect(progression.totalPointsEarned).toBe(50);
});

it('should advance to the next tier when reaching the required points', () => {
// Given
const userId = '123';
const proofData = [
{ id: 'p1', points: 10 },
{ id: 'p2', points: 20 },
{ id: 'p3', points: 65 },
{ id: 'p4', points: 70 },
];

proofTiers.registerProof('tier-1', 1);
proofTiers.registerProof('tier-2', 20);
proofTiers.registerProof('tier-3', 60);
proofTiers.registerProof('tier-4', 100);

// When
const progression = progressionService.calculateProgression(userId, proofData);

// Then
expect(progression.achievements).toEqual([
new Achievement('Started', 'proof-tiers-3'),
new Achievement('Reached Tier 2', 'proof-tiers-3'),
]);
expect(progression.currentTier).toBe('tier-2');
expect(progression.pointsProgress).toBe(0);
expect(progression.totalPointsEarned).toBe(70);
});
});
});
