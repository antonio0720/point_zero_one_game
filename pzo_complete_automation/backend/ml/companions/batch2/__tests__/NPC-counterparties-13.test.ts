import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { NPCCounterpartiesService } from './npc-counterparties.service';

describe('NPC Counterparties (e2e)', () => {
let app: INestApplication;
let service: NPCCounterpartiesService;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
service = moduleFixture.get<NPCCounterpartiesService>(NPCCounterpartiesService);
await app.init();
});

afterAll(async () => {
await app.close();
})

describe('Counterparties', () => {
it('/counterparties should return counterparty data', async () => {
const counterparties = await service.getCounterparties();
expect(Array.isArray(counterparties)).toBeTruthy();
});

it('/counterparties/:id should return the specific counterparty data', async () => {
const id = 1; // replace with a valid counterparty ID
const counterparty = await service.getCounterpartyById(id);
expect(counterparty).toBeDefined();
});

it('/create-counterparty should create new counterparty', async () => {
// prepare the data to be sent
const newCounterpartyData = {}; // replace with actual data structure and content

const createdCounterparty = await service.createCounterparty(newCounterpartyData);
expect(createdCounterparty).toBeDefined();
});
});
});
