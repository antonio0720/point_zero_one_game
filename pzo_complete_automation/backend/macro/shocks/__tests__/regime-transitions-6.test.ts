import { Test, TestingModule } from '@nestjs/testing';
import { RegimeTransitionsService } from '../regime-transitions.service';
import { RegimeTransitionDto } from '../../dtos/regime-transition.dto';
import { MacroSystemsModule } from '../../../macro-systems/macro-systems.module';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { RegimeTransition, RegimeTransitionSchema } from '../../schemas/regime-transition.schema';

describe('RegimeTransitionsService', () => {
let service: RegimeTransitionsService;
let modelToken = getModelToken(RegimeTransition.name);

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [MacroSystemsModule, MongooseModule.forRoot('')],
providers: [RegimeTransitionsService],
})
.overrideProvider(modelToken)
.useValue(RegimeTransitionSchema);

service = module.get<RegimeTransitionsService>(RegimeTransitionsService);
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('create', () => {
const createDto: RegimeTransitionDto = {};

it('should create a new regime transition', async () => {
const created = await service.create(createDto);
expect(created).toBeDefined();
});
});

describe('findAll', () => {
it('should return all regime transitions', async () => {
const regimeTransitions = await service.findAll();
expect(regimeTransitions).toEqual([]); // Replace [] with actual data when available
});
});

describe('findOne', () => {
const id = 'some-id';

it('should return the regime transition with the given id', async () => {
const regimeTransition = await service.findOne(id);
expect(regimeTransition).toBeDefined();
});
});

describe('update', () => {
const id = 'some-id';
const updateDto: RegimeTransitionDto = {};

it('should update the regime transition with the given id', async () => {
const updated = await service.update(id, updateDto);
expect(updated).toBeDefined();
});
});

describe('remove', () => {
const id = 'some-id';

it('should remove the regime transition with the given id', async () => {
await service.remove(id);
});
});
});
