import { AllowlistService } from '../allowlist.service';
import { CreateAllowlistDto } from '../dto/create-allowlist.dto';
import { UpdateAllowlistDto } from '../dto/update-allowlist.dto';
import { UserEntity } from '../../user/entities/user.entity';
import { getRepositoryToken, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AllowlistEntity } from '../entities/allowlist.entity';

describe('AllowlistService', () => {
let service: AllowlistService;
let allowlistRepository: Repository<AllowlistEntity>;
let userRepository: Repository<UserEntity>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [AllowlistService, UserEntity, AllowlistEntity],
imports: [],
})
.overrideProvider(getRepositoryToken(UserEntity))
.useValue(new Repository<UserEntity>())
.overrideProvider(getRepositoryToken(AllowlistEntity))
.useValue(new Repository<AllowlistEntity>())
.compile();

service = module.get<AllowlistService>(AllowlistService);
allowlistRepository = module.get<Repository<AllowlistEntity>>(
getRepositoryToken(AllowlistEntity),
);
userRepository = module.get<Repository<UserEntity>>(
getRepositoryToken(UserEntity),
);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('createAllowlist', () => {
const createAllowlistDto: CreateAllowlistDto = new CreateAllowlistDto();

beforeEach(() => {
createAllowlistDto.name = 'Test Allowlist';
});

it('should create a new allowlist', async () => {
// Arrange
const user = new UserEntity();
user.id = 1;

jest.spyOn(userRepository, 'save').mockResolvedValue(user);
jest.spyOn(allowlistRepository, 'save').mockResolvedValue({});

// Act
const result = await service.createAllowlist(createAllowlistDto, user);

// Assert
expect(result).toEqual({ id: expect.any(Number), name: createAllowlistDto.name });
});
});

describe('updateAllowlist', () => {
const updateAllowlistDto: UpdateAllowlistDto = new UpdateAllowlistDto();

beforeEach(() => {
updateAllowlistDto.name = 'Updated Allowlist';
});

it('should update an existing allowlist', async () => {
// Arrange
const allowlist = new AllowlistEntity();
allowlist.id = 1;
allowlist.name = 'Test Allowlist';

jest.spyOn(allowlistRepository, 'findOne').mockResolvedValue(allowlist);
jest.spyOn(allowlistRepository, 'save').mockResolvedValue({ ...allowlist, name: updateAllowlistDto.name });

// Act
const result = await service.updateAllowlist(1, updateAllowlistDto);

// Assert
expect(result).toEqual({ id: 1, name: updateAllowlistDto.name });
});

it('should throw an error if the allowlist does not exist', async () => {
// Arrange
jest.spyOn(allowlistRepository, 'findOne').mockResolvedValue(null);

// Act and Assert
await expect(service.updateAllowlist(1, updateAllowlistDto)).rejects.toThrowError('Allowlist not found');
});
});
});
