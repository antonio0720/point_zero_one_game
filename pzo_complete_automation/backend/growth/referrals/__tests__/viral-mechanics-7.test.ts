import { Test, TestingModule } from '@nestjs/testing';
import { ViralMechanicsService } from './viral-mechanics.service';
import { UserRepository } from 'src/modules/user/user.repository';
import { ReferralRepository } from 'src/modules/referrals/referral.repository';
import { CreateReferralDto } from 'src/modules/referrals/dto/create-referral.dto';

describe('ViralMechanicsService', () => {
let service: ViralMechanicsService;
let userRepository: UserRepository;
let referralRepository: ReferralRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ViralMechanicsService, UserRepository, ReferralRepository],
}).compile();

service = module.get<ViralMechanicsService>(ViralMechanicsService);
userRepository = module.get<UserRepository>(UserRepository);
referralRepository = module.get<ReferralRepository>(ReferralRepository);
});

describe('testMethod', () => {
it('should handle success', async () => {
// arrange
const userId1 = 'userId1';
const userId2 = 'userId2';
const newUserId = 'newUserId';
jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: userId1 } as any);
jest.spyOn(referralRepository, 'create').mockResolvedValue({ id: 'createdReferralId' } as any);

// act
const result = await service.testMethod(userId1, userId2, newUserId);

// assert
expect(result).toEqual('Success');
expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: userId1 } });
expect(referralRepository.create).toHaveBeenCalledWith({
fromId: userId1,
toId: userId2,
rewarded: false,
} as CreateReferralDto);
});

it('should handle error', async () => {
// arrange
const userId = 'userId';
jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

// act and assert
await expect(service.testMethod(userId, 'otherUserId', 'newUserId')).rejects.toThrow('User not found');
expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: userId } });
});
});
});
