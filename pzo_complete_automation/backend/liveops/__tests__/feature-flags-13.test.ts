import { Test, TestingModule } from '@nestjs/testing';
import { LiveopsService } from '../liveops.service';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagService } from './feature-flag.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlagEntity } from './entities/feature-flag.entity';

describe('FeatureFlagsController', () => {
let controller: FeatureFlagsController;
let service: FeatureFlagService;
let liveopsService: LiveopsService;
let featureFlagRepository: Repository<FeatureFlagEntity>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [FeatureFlagsController],
providers: [
FeatureFlagService,
LiveopsService,
JwtAuthGuard,
{
provide: getRepositoryToken(FeatureFlagEntity),
useValue: featureFlagRepository,
},
],
})
.overrideGuard(JwtAuthGuard)
.use AlwaysAllowedGuard()
.compile();

controller = module.get<FeatureFlagsController>(FeatureFlagsController);
service = module.get<FeatureFlagService>(FeatureFlagService);
liveopsService = module.get<LiveopsService>(LiveopsService);
featureFlagRepository = module.get<Repository<FeatureFlagEntity>>(
getRepositoryToken(FeatureFlagEntity),
);
});

describe('getFeatureFlags', () => {
it('should return feature flags list from database', async () => {
// setup mocks

// your test logic here
});
});

describe('updateFeatureFlag', () => {
it('should update a feature flag in the database', async () => {
// setup mocks

// your test logic here
});
});
});
