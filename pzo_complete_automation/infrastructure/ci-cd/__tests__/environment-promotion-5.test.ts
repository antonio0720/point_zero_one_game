import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentPromotionService } from '../services/environment-promotion.service';
import { EnvironmentPromotionController } from '../controllers/environment-promotion.controller';
import { EnvironmentPromotion } from '../entities/environment-promotion.entity';
import { getConnection, Connection } from 'typeorm';
import { createTestingConnections } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';

describe('EnvironmentPromotionController (e2e)', () => {
let app: any;
let environmentPromotionService: EnvironmentPromotionService;
let connection: Connection;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
controllers: [EnvironmentPromotionController],
providers: [EnvironmentPromotionService],
}).compile();

app = moduleFixture.createNestApplication();
environmentPromotionService = moduleFixture.get<EnvironmentPromotionService>(EnvironmentPromotionService);
connection = (await createTestingConnections([__dirname + '/../entities/**/*{.ts,.js}']))[0];
});

afterAll(async () => {
await app.close();
await connection.dropDatabase();
await connection.close();
});

describe('create', () => {
it('should create an environment promotion', async () => {
const newEnvironmentPromotion = new EnvironmentPromotion();
// fill the newEnvironmentPromotion object with test data
// ...

const createdEnvironmentPromotion = await environmentPromotionService.create(newEnvironmentPromotion);
expect(createdEnvironmentPromotion).toEqual(expect.objectContaining(newEnvironmentPromotion));
});
});

describe('findAll', () => {
it('should return an array of environment promotions', async () => {
const createdEnvironmentPromotion1 = await environmentPromotionService.create({ /* test data for first record */ });
const createdEnvironmentPromotion2 = await environmentPromotionService.create({ /* test data for second record */ });

const foundEnvironmentPromotions = await environmentPromotionService.findAll();
expect(foundEnvironmentPromotions).toContain(createdEnvironmentPromotion1);
expect(foundEnvironmentPromotions).toContain(createdEnvironmentPromotion2);
});
});

describe('findOne', () => {
it('should return the correct environment promotion when given a valid id', async () => {
const createdEnvironmentPromotion = await environmentPromotionService.create({ /* test data */ });
const foundEnvironmentPromotion = await environmentPromotionService.findOne(createdEnvironmentPromotion.id);
expect(foundEnvironmentPromotion).toEqual(createdEnvironmentPromotion);
});

it('should return null when given an invalid id', async () => {
const nonExistentId = 999;
const foundEnvironmentPromotion = await environmentPromotionService.findOne(nonExistentId);
expect(foundEnvironmentPromotion).toBeNull();
});
});

describe('update', () => {
it('should update an existing environment promotion', async () => {
const createdEnvironmentPromotion = await environmentPromotionService.create({ /* test data */ });
const updatedEnvironmentPromotionData = { /* new test data */ };
const updatedEnvironmentPromotion = await environmentPromotionService.update(createdEnvironmentPromotion.id, updatedEnvironmentPromotionData);
expect(updatedEnvironmentPromotion).toEqual(expect.objectContaining(updatedEnvironmentPromotionData));
});

it('should return null when given an invalid id', async () => {
const nonExistentId = 999;
const updatedEnvironmentPromotionData = { /* test data */ };
const updatedEnvironmentPromotion = await environmentPromotionService.update(nonExistentId, updatedEnvironmentPromotionData);
expect(updatedEnvironmentPromotion).toBeNull();
});
});

describe('remove', () => {
it('should remove an existing environment promotion', async () => {
const createdEnvironmentPromotion = await environmentPromotionService.create({ /* test data */ });
await environmentPromotionService.remove(createdEnvironmentPromotion.id);
const foundEnvironmentPromotion = await environmentPromotionService.findOne(createdEnvironmentPromotion.id);
expect(foundEnvironmentPromotion).toBeNull();
});

it('should return null when given an invalid id', async () => {
const nonExistentId = 999;
await environmentPromotionService.remove(nonExistentId);
const foundEnvironmentPromotion = await environmentPromotionService.findOne(nonExistentId);
expect(foundEnvironmentPromotion).toBeNull();
});
});
});
