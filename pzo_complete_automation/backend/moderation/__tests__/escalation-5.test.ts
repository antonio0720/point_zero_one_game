import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, TypeOrmModule } from '@nestjs/typeorm';
import { AbuseService } from '../abuse.service';
import { BanService } from '../ban.service';
import { UserRepository } from 'src/auth/user.repository';
import { AbuseEntity } from '../entities/abuse.entity';
import { BanEntity } from '../entities/ban.entity';
import { ModerationService } from './moderation.service';
import { CreateAbuseDto, ReportAbuseDto } from '../dto';
import { createAppDataSource } from 'src/database/app-datasource';

describe('ModerationService - escalation-5', () => {
let service: ModerationService;
let abuseService: AbuseService;
let banService: BanService;
let userRepository: UserRepository;

beforeAll(async () => {
const appDataSource = createAppDataSource();
await appDataSource.initialize();

const module: TestingModule = await Test.createTestingModule({
imports: [TypeOrmModule.forRoot()],
providers: [
ModerationService,
AbuseService,
BanService,
{ provide: UserRepository, useValue: userRepository = appDataSource.getRepository(UserRepository) },
{ provide: getConnectionToken(), useValue: appDataSource },
],
}).compile();

service = module.get<ModerationService>(ModerationService);
abuseService = module.get<AbuseService>(AbuseService);
banService = module.get<BanService>(BanService);
});

describe('banUser', () => {
const createAbuseDto: CreateAbuseDto = new CreateAbuseDto();
const reportAbuseDto: ReportAbuseDto = new ReportAbuseDto();

beforeEach(async () => {
// Clear the database for each test case
await userRepository.query(`TRUNCATE TABLE users`);
await userRepository.query(`TRUNCATE TABLE abuses`);
await userRepository.query(`TRUNCATE TABLE bans`);
});

it('should ban a user when there are 5 escalation-5 reports within 24 hours', async () => {
// Create users
const userId1 = await userRepository.save({ id: 1, username: 'user1' });
const userId2 = await userRepository.save({ id: 2, username: 'user2' });
const userId3 = await userRepository.save({ id: 3, username: 'user3' });

// Create escalation-5 abuses for each user
await abuseService.createAbuse(createAbuseDto, userId1, 'escalation-5');
await abuseService.createAbuse(createAbuseDto, userId2, 'escalation-5');
await abuseService.createAbuse(createAbuseDto, userId3, 'escalation-5');

// Advance time by 24 hours (for example, using a library like sinon-mockdate)
// ...

// Report the same escalation-5 abuses
reportAbuseDto.userId = userId1;
await service.reportAbuse(reportAbuseDto);
reportAbuseDto.userId = userId2;
await service.reportAbuse(reportAbuseDto);
reportAbuseDto.userId = userId3;
await service.reportAbuse(reportAbuseDto);

// Check if the users are banned
const bans = await banService.getBansByUserIds([userId1, userId2, userId3]);
expect(bans.length).toBe(3);
});
});
});
