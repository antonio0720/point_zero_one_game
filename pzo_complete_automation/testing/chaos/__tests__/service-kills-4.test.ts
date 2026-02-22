import { Test, TestingModule } from '@nestjs/testing';
import { ServiceKillsService } from '../service-kills.service';
import { ServiceKillsController } from '../service-kills.controller';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

describe('ServiceKills (e2e)', () => {
let app: INestApplication;
let serviceKillsService: ServiceKillsService;
let serviceKillsController: ServiceKillsController;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
controllers: [ServiceKillsController],
providers: [ServiceKillsService],
}).compile();

app = moduleFixture.createNestApplication();
serviceKillsService = moduleFixture.get<ServiceKillsService>(ServiceKillsService);
serviceKillsController = moduleFixture.get<ServiceKillsController>(ServiceKillsController);
await app.init();
});

afterAll(async () => {
await app.close();
});

describe('LOAD TEST', () => {
it('/GET should return initial service kills data', async () => {
const response = await request(app.getHttpServer()).get('/service-kills');
expect(response.statusCode).toBe(200);
// Add expectation for the response data, e.g., expect(response.body).toEqual(expectedServiceKillsData);
});
});

describe('STRESS TEST', () => {
it('/GET should handle many requests without errors', async () => {
const numberOfRequests = 100; // Adjust this to fit your test environment and needs
let responsePromises = [];

for (let i = 0; i < numberOfRequests; i++) {
responsePromises.push(request(app.getHttpServer()).get('/service-kills'));
}

await Promise.all(responsePromises);

// Add expectations for all responses, e.g., expect(responsePromises.map(res => res.statusCode)).toEqual(Array(numberOfRequests).fill(200));
});
});

describe('CHAOS TEST', () => {
it('/POST should kill service and return proper error message when receiving malformed data', async () => {
const invalidData = {}; // Add malformed data here, e.g., missing required properties or invalid types
const response = await request(app.getHttpServer()).post('/service-kills').send(invalidData);
expect(response.statusCode).toBe(400);
// Add expectation for the error message, e.g., expect(response.body.error).toEqual('Invalid service kill data');
});
});
});
