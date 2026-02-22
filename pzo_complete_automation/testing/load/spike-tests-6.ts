import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as request from 'supertest';
import { randomBytes } from 'crypto';

describe('Integration (e2e)', () => {
let app: INestApplication;

beforeAll(async () => {
const moduleFixture: TestingModule = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
await app.init();
});

afterAll(async () => {
await app.close();
});

it('/health-check should return 200', async () => {
return request(app.getHttpServer())
.get('/health-check')
.expect(200);
});

// Add more tests as per your application's routes and endpoints

it('performs chaos monkey test', async () => {
const randomEndpoint = `/endpoint-${randomBytes(4).toString('hex')}`;
return request(app.getHttpServer())
.delete(randomEndpoint)
.expect(500);
});
});
