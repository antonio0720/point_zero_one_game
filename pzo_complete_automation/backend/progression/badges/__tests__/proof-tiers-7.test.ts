import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BadgeService } from './badges.service';
import { User } from '../user/entities/user.entity';
import { ProofTier } from './proof-tiers.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from './badges.entity';

describe('BadgeService', () => {
let service: BadgeService;
let userRepository: Repository<User>;
let badgeRepository: Repository<Badge>;

beforeEach(async () => {
const module = await Test.createTestingModule({
providers: [BadgeService],
})
.overrideProvider(getRepositoryToken(User))
.useValue(createMockRepository(User))
.overrideProvider(getRepositoryToken(Badge))
.useValue(createMockRepository(Badge));

service = module.get<BadgeService>(BadgeService);
userRepository = module.get(getRepositoryToken(User));
badgeRepository = module.get(getRepositoryToken(Badge));
});

it('should get the correct proof tier for a user', async () => {
const user = createMockUser({ id: 1, proofTier: ProofTier.Tier3 });
jest.spyOn(userRepository, 'findOne').mockResolvedValue(user);

expect(await service.getProofTier(1)).toEqual(ProofTier.Tier3);
});

it('should correctly calculate progression between proof tiers', async () => {
const user = createMockUser({ id: 1, proofTier: ProofTier.Tier2 });
const badge = createMockBadge({ tier: ProofTier.Tier3, points: 50 });
jest.spyOn(badgeRepository, 'findOne').mockResolvedValue(badge);
jest.spyOn(user, 'getPoints').mockReturnValue(45);

expect(await service.getProgression(1)).toEqual('45/50');
});
});

function createMockUser(override: Partial<User> = {}): User {
return {
id: 1,
email: 'test@example.com',
proofTier: ProofTier.Tier1,
...override,
};
}

function createMockBadge(override: Partial<Badge> = {}): Badge {
return {
id: 1,
name: 'Test Badge',
tier: ProofTier.Tier3,
points: 50,
...override,
};
}

function createMockRepository(entity: any): Repository<any> {
class MockRepository implements Repository<any> {
findOne = jest.fn();
}

return new MockRepository();
}
