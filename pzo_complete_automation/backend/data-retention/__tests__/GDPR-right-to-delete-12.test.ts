import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from '../data-retention.service';
import { UserRepository } from '../../user/user.repository';
import { getConnectionToken } from '@nestjs/typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('DataRetentionService (GDPR-right-to-delete-12)', () => {
let service: DataRetentionService;
let userRepository: UserRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [DataRetentionService, UserRepository],
guards: [JwtAuthGuard],
})
.overrideProvider(getConnectionToken())
.useValue(connection) // Mock connection for testing purposes
.compile();

service = module.get<DataRetentionService>(DataRetentionService);
userRepository = module.get<UserRepository>(UserRepository);
});

describe('deleteAccount', () => {
const testUserId = 1;
let user: UserEntity;

beforeEach(async () => {
user = await userRepository.findOneBy({ id: testUserId });
if (!user) {
user = await userRepository.save(new UserEntity({ id: testUserId }));
}
});

it('should delete the user and all associated data', async () => {
await service.deleteAccount(testUserId);

const foundUser = await userRepository.findOneBy({ id: testUserId });
expect(foundUser).toBeNull();
});

it('should throw an exception when user not found', async () => {
const nonExistentUserId = 999;
await expect(service.deleteAccount(nonExistentUserId)).rejects.toThrowError();
});

it('should return a success response when the deletion is successful', async () => {
const result = await service.deleteAccount(testUserId);
expect(result).toEqual({ statusCode: HttpStatus.OK, message: 'User deleted successfully.' });
});
});
});
