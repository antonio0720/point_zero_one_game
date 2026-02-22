import { Test, TestingModule } from '@nestjs/testing';
import { ProgressionService } from '../progression.service';
import { Achievement } from '../../achievements/entities/achievement.entity';
import { ProofTierDto } from '../dto/proof-tier.dto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AchievementService } from '../../achievements/achievement.service';

describe('ProgressionService (proof-tiers-6)', () => {
let service: ProgressionService;
let achievementRepository: Repository<Achievement>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ProgressionService, AchievementService],
})
.overrideProvider(getRepositoryToken(Achievement))
.useValue(() => {}) // Mock the repository for testing purposes
.compile();

service = module.get<ProgressionService>(ProgressionService);
achievementRepository = module.get(getRepositoryToken(Achievement));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('checkProofTier', () => {
const proofTiers: ProofTierDto[] = [
// Add sample proof tiers data for testing
];

it('should return the correct proof tier', async () => {
jest.spyOn(achievementRepository, 'findOne').mockResolvedValue({ id: 1, achievementPoints: 50 });
const result = await service.checkProofTier(proofTiers);
// Add assertions for the expected proof tier based on your test data and expectations
});

it('should return null if no proof tiers match', async () => {
jest.spyOn(achievementRepository, 'findOne').mockResolvedValue({ id: 1, achievementPoints: 20 });
const result = await service.checkProofTier(proofTiers);
// Add assertions for the expected null value when no proof tiers match based on your test data and expectations
});
});
});
