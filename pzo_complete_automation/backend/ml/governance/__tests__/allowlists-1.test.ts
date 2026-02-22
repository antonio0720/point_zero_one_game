import { AllowlistService } from '../services/allowlist.service';
import { CreateAllowlistDto, UpdateAllowlistDto } from '../dtos/allowlist.dto';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

describe('AllowlistService', () => {
let service: AllowlistService;
let allowlistModel: Model<any>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [MongooseModule.forRoot('')],
providers: [AllowlistService],
})
.overrideProvider(getModelToken('Allowlist'))
.useValue(jest.fn())
.compile();

service = module.get<AllowlistService>(AllowlistService);
allowlistModel = module.get<Model<any>>(getModelToken('Allowlist'));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('createAllowlist', () => {
const createDto: CreateAllowlistDto = {
name: 'Test Allowlist',
data: [{ id: uuidv4(), value: 'test-value' }],
};

it('should create an allowlist', async () => {
// mock create method for testing
const mockCreate = jest.spyOn(allowlistModel, 'create');

await service.createAllowlist(createDto);

expect(mockCreate).toHaveBeenCalledWith(createDto);
});
});

describe('updateAllowlist', () => {
const updateDto: UpdateAllowlistDto = {
id: uuidv4(),
name: 'Updated Allowlist',
data: [{ id: uuidv4(), value: 'updated-test-value' }],
};

it('should update an allowlist', async () => {
// mock findOneAndUpdate method for testing
const mockFindOneAndUpdate = jest.spyOn(allowlistModel, 'findOneAndUpdate');

await service.updateAllowlist(updateDto);

expect(mockFindOneAndUpdate).toHaveBeenCalledWith({ id: updateDto.id }, updateDto);
});
});
});
