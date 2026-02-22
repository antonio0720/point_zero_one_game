import { Test, TestingModule } from '@nestjs/testing';
import { ViralMechanics5Service } from './viral-mechanics-5.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ViralMechanics5Service', () => {
let service: ViralMechanics5Service;
let prisma: PrismaService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ViralMechanics5Service, PrismaService],
}).compile();

service = module.get<ViralMechanics5Service>(ViralMechanics5Service);
prisma = module.get<PrismaService>(PrismaService);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('processReferral', () => {
it('should process referral correctly', async () => {
// arrange
const userId = 'userId';
const refCode = 'refCode';
const referrerId = 'referrerId';

jest.spyOn(prisma, 'user').mockReturnValue({
findOne: jest.fn().mockResolvedValue({ id: userId }),
update: jest.fn(),
});

// act
await service.processReferral(refCode, referrerId);

// assert
expect(prisma.user.findOne).toHaveBeenCalledWith({ where: { refCode } });
expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { referralCount: jest.Anything() } });
});

it('should update referrer when new user created', async () => {
// arrange
const refCode = 'refCode';
const referrerId = 'referrerId';

jest.spyOn(prisma, 'user').mockReturnValue({
findOne: jest.fn().mockResolvedValue(null),
create: jest.fn(),
});

// act
await service.processReferral(refCode, referrerId);

// assert
expect(prisma.user.findOne).toHaveBeenCalledWith({ where: { refCode } });
expect(prisma.user.create).toHaveBeenCalledWith({ data: { id: referrerId, referralCount: 1, refCode } });
});
});
});
