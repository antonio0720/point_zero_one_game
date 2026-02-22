import { Achievement, Player, ProgressionService } from '../../../core';
import { InMemoryProgressionService } from '../in-memory-progression-service';
import { ProofTier4Achievement } from './proof-tier4-achievement';
import { expect } from 'chai';

describe('Proof Tier 4', () => {
let service: ProgressionService;
let player: Player;

beforeEach(() => {
service = new InMemoryProgressionService();
player = new Player(service);
});

it('should unlock Proof Tier 4A when a player reaches 100 points', () => {
for (let i = 0; i < 100; i++) {
service.addPointsToPlayer(player, 5);
const achievements = player.getAllAchievements();
expect(achievements.some((a: Achievement) => a instanceof ProofTier4Achievement)).to.be.false;
}

service.addPointsToPlayer(player, 1); // Reach 100 points
const achievements = player.getAllAchievements();
expect(achievements.some((a: Achievement) => a instanceof ProofTier4Achievement)).to.be.true;
});

it('should unlock Proof Tier 4B when a player reaches 200 points', () => {
for (let i = 0; i < 200; i++) {
service.addPointsToPlayer(player, 5);
const achievements = player.getAllAchievements();
expect(achievements.some((a: Achievement) => a instanceof ProofTier4BAchievement)).to.be.false;
}

service.addPointsToPlayer(player, 1); // Reach 200 points
const achievements = player.getAllAchievements();
expect(achievements.some((a: Achievement) => a instanceof ProofTier4BAchievement)).to.be.true;
});

// Add more test cases for Proof Tier 4C, 4D, etc. as needed
});
