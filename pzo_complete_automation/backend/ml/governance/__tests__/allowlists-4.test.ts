import { Test, TestingModule } from '@nestjs/testing';
import { AllowlistsService } from './allowlists.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowlistEntity } from '../entities/allowlist.entity';
import { CreateAllowlistDto } from '../dto/create-allowlist.dto';

describe('AllowlistsService', () => {
let service: AllowlistsService;
let allowlistRepository: Repository<AllowlistEntity>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [AllowlistsService, {
provide: getRepositoryToken(AllowlistEntity),
useValue: jest.createMockInstance(Repository),
}],
}).compile();

service = module.get<AllowlistsService>(AllowlistsService);
allowlistRepository = module.get<Repository<AllowlistEntity>>(getRepositoryToken(AllowlistEntity));
});

describe('createAllowlist', () => {
it('should create a new allowlist', async () => {
const createAllowlistDto: CreateAllowlistDto = {
name: 'test-allowlist',
};

const createdAllowlist = await service.createAllowlist(createAllowlistDto);

expect(createdAllowlist).toBeDefined();
expect(createdAllowlist.name).toEqual(createAllowlistDto.name);
});
});

describe('getAllAllowlists', () => {
it('should return all allowlists', async () => {
const allowlist1 = new AllowlistEntity();
allowlist1.id = 1;
allowlist1.name = 'allowlist-1';

const allowlist2 = new AllowlistEntity();
allowlist2.id = 2;
allowlist2.name = 'allowlist-2';

allowlistRepository.findOne = jest.fn().mockResolvedValueOnce(allowlist1);
allowlistRepository.find = jest.fn().mockResolvedValue([allowlist1, allowlist2]);

const allAllowlists = await service.getAllAllowlists();

expect(allAllowlists).toEqual([allowlist1, allowlist2]);
});
});
});
