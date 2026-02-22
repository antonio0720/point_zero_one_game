import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from '../data-retention.service';
import { UserRepository } from '../../user/repositories/user.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { DataRetentionDto } from '../dtos/data-retention.dto';
import { DataRetentionEntity } from '../entities/data-retention.entity';
import { DataSource } from 'typeorm';

describe('DataRetentionService', () => {
let service: DataRetentionService;
let userRepository: UserRepository;
let dataSource: DataSource;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [DataRetentionService, UserRepository],
})
.overrideProvider(getRepositoryToken(UserEntity))
.useValue(new UserRepository())
.compile();

service = module.get<DataRetentionService>(DataRetentionService);
userRepository = module.get<UserRepository>(UserRepository);
dataSource = module.get<DataSource>(DataSource);
});

it('should delete a user and associated data retentions based on GDPR-right-to-delete-7', async () => {
// Given - Create test users and data retentions
const user1 = await userRepository.createUser({ name: 'John Doe' });
await userRepository.save(user1);

const dataRetention1 = new DataRetentionEntity();
dataRetention1.userId = user1.id;
dataRetention1.type = 'exampleType';
dataRetention1.data = JSON.stringify({ key: 'value' });
await dataSource.save(dataRetention1);

const user2 = await userRepository.createUser({ name: 'Jane Doe' });
await userRepository.save(user2);

// When - Delete user based on GDPR-right-to-delete-7
const dataRetentionDto: DataRetentionDto = {
userId: user1.id,
typesToDelete: ['exampleType'],
};
await service.deleteDataRetentions(dataRetentionDto);

// Then - Check that the user and associated data retentions are deleted
const userFound = await userRepository.findOne(user1.id, { relations: ['dataRetentions'] });
expect(userFound).toBeNull();

const dataRetentionFound = await dataSource.getRepository(DataRetentionEntity)
.createQueryBuilder('data_retention')
.where('data_retention.userId = :userId', { userId: user1.id })
.getOne();
expect(dataRetentionFound).toBeNull();
});
});
