import { Test, TestingModule } from '@nestjs/testing';
import { AllowlistsService } from './allowlists.service';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AllowlistDocument } from '../schemas/allowlist.schema';
import { CreateAllowlistDto } from '../dto/create-allowlist.dto';
import { UpdateAllowlistDto } from '../dto/update-allowlist.dto';

describe('AllowlistsService', () => {
let service: AllowlistsService;
let allowlistModel: Model<AllowlistDocument>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [MongooseModule],
providers: [AllowlistsService],
})
.overrideProvider(getModelToken('Allowlist'))
.useValue(jest.fn())
.compile();

service = module.get<AllowlistsService>(AllowlistsService);
allowlistModel = module.get<Model<AllowlistDocument>>(getModelToken('Allowlist'));
});

describe('create', () => {
it('should create an allowlist', async () => {
const createDto: CreateAllowlistDto = { /* data for the allowlist */ };
const createdAllowlist = await service.create(createDto);
expect(createdAllowlist).toBeDefined();
});
});

describe('findAll', () => {
it('should return all allowlists', async () => {
const findAllSpy = jest.spyOn(allowlistModel, 'find').mockResolvableValue([]);
await service.findAll();
expect(findAllSpy).toHaveBeenCalled();
});
});

describe('findOne', () => {
it('should return an allowlist by id', async () => {
const findOneSpy = jest.spyOn(allowlistModel, 'findOne').mockResolvableValue({ /* mock allowlist data */ });
const result = await service.findOne('id');
expect(result).toEqual({ /* mock allowlist data */ });
expect(findOneSpy).toHaveBeenCalledWith({ _id: 'id' });
});
});

describe('update', () => {
it('should update an allowlist', async () => {
const updateDto: UpdateAllowlistDto = { /* data for the updated allowlist */ };
const findOneSpy = jest.spyOn(allowlistModel, 'findOne').mockResolvableValue({ /* mock allowlist data */ });
const saveSpy = jest.spyOn(allowlistModel, 'save').mockResolvableValue({ /* mock saved allowlist data */ });

await service.update('id', updateDto);

expect(findOneSpy).toHaveBeenCalledWith({ _id: 'id' });
expect(saveSpy).toHaveBeenCalledWith(updateDto);
});
});

describe('remove', () => {
it('should remove an allowlist by id', async () => {
const findOneAndRemoveSpy = jest.spyOn(allowlistModel, 'findOneAndRemove').mockResolvableValue({ /* mock deleted allowlist data */ });

await service.remove('id');

expect(findOneAndRemoveSpy).toHaveBeenCalledWith({ _id: 'id' });
});
});
});
