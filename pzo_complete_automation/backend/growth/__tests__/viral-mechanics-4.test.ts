import { Test, TestingModule } from '@nestjs/testing';
import { ViralMechanics4Service } from './viral-mechanics-4.service';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('ViralMechanics4 (e2e)', () => {
let app: INestApplication;
let service: ViralMechanics4Service;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
service = moduleFixture.get<ViralMechanics4Service>(ViralMechanics4Service);
await app.init();
});

afterAll(async () => {
await app.close();
});

describe('GET /viral-mechanics/4', () => {
it('/GET should return the result of ViralMechanics4Service', async () => {
const response = await request(app.getHttpServer()).get('/viral-mechanics/4');
expect(response.statusCode).toEqual(200);
expect(response.body).toEqual(expect.any(Number));
});
});
});
