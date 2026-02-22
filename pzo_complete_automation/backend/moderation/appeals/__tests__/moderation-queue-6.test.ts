import { Test, TestingModule } from '@nestjs/testing';
import { ModerationQueueService } from '../moderation-queue.service';
import { AbuseBanManagementService } from '../../abuse-ban-management/abuse-ban-management.service';
import { UserRepository } from 'src/user/user.repository';
import { ContentRepository } from 'src/content/content.repository';
import { AbuseReason } from 'src/enums/abuse-reason.enum';
import { BanType } from 'src/enums/ban-type.enum';
import { CreateAbuseDto } from 'src/dto/create-abuse.dto';
import { ModerationQueueEntity } from '../entities/moderation-queue.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('ModerationQueueService (Abuse + ban management - moderation-queue-6)', () => {
let service: ModerationQueueService;
let abuseBanManagementService: AbuseBanManagementService;
let userRepository: UserRepository;
let contentRepository: ContentRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
ModerationQueueService,
AbuseBanManagementService,
{ provide: UserRepository, useValue: {} },
{ provide: ContentRepository, useValue: {} },
],
}).compile();

service = module.get<ModerationQueueService>(ModerationQueueService);
abuseBanManagementService = module.get<AbuseBanManagementService>(AbuseBanManagementService);
userRepository = module.get<UserRepository>(UserRepository);
contentRepository = module.get<ContentRepository>(ContentRepository);
});

it('should handle a case where a user posts abusive content and is banned', async () => {
// Arrange
const userId = 1;
const contentId = 2;
const abuseReason: AbuseReason = AbuseReason.HATE_SPEECH;
const banType: BanType = BanType.TOTAL;

const createAbuseDto: CreateAbuseDto = {
userId,
contentId,
reason: abuseReason,
};

// Mock data for the repositories (replace with your own mocks)
const mockModerationQueueEntity: ModerationQueueEntity = new ModerationQueueEntity();
mockModerationQueueEntity.userId = userId;
mockModerationQueueEntity.contentId = contentId;
mockModerationQueueEntity.abuseReason = abuseReason;

// Stub the behavior of the AbuseBanManagementService and UserRepository to return the expected results
abuseBanManagementService.banUser.mockResolvedValue(true);
userRepository.findOne.mockResolvedValue({ id: userId });

// Act
await service.handleAbuseReport(createAbuseDto);

// Assert
expect(abuseBanManagementService.banUser).toHaveBeenCalledWith(userId, banType);
});
});
