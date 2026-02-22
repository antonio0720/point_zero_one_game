import { Test, TestingModule } from '@nestjs/testing';
import { ReplayToolingService } from './replay-tooling.service';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('ReplayToolingService', () => {
let app: INestApplication;
let service: ReplayToolingService;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
service = moduleFixture.get<ReplayToolingService>(ReplayToolingService);
await app.init();
});

afterAll(async () => {
await app.close();
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('replay-tooling-10', () => {
// Add your test cases here for replay-tooling-10
});
});
