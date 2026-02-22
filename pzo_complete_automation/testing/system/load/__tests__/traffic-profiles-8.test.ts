import { Test, TestingModule } from '@nestjs/testing';
import { TrafficProfilesService } from '../traffic-profiles.service';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { createApp } from '../../../utils/create-app';

describe('TrafficProfiles (e2e)', () => {
let app: INestApplication;
let trafficProfilesService: TrafficProfilesService;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
await app.init();
trafficProfilesService = moduleFixture.get<TrafficProfilesService>(TrafficProfilesService);
});

afterAll(async () => {
await app.close();
});

describe('GET /traffic-profiles', () => {
it('/should return all traffic profiles', () =>
request(app.getHttpServer())
.get('/api/v1/traffic-profiles')
.expect(200)
.expect((res) => {
expect(res.body).toBeDefined();
// add assertions for the expected response structure and data here
}));
});

describe('GET /traffic-profiles/:id', () => {
const sampleTrafficProfileId = '123456';

it('/should return a specific traffic profile by id', () =>
request(app.getHttpServer())
.get(`/api/v1/traffic-profiles/${sampleTrafficProfileId}`)
.expect(200)
.expect((res) => {
expect(res.body).toBeDefined();
// add assertions for the expected response structure and data here
}));
});

describe('POST /traffic-profiles', () => {
const createTrafficProfileInput = {}; // define your input object

it('/should create a new traffic profile', () =>
request(app.getHttpServer())
.post('/api/v1/traffic-profiles')
.send(createTrafficProfileInput)
.expect(201)
.expect((res) => {
expect(res.body).toBeDefined();
// add assertions for the expected response structure and data here
}));
});

describe('PUT /traffic-profiles/:id', () => {
const sampleTrafficProfileId = '123456';
const updateTrafficProfileInput = {}; // define your input object

it('/should update a specific traffic profile by id', () =>
request(app.getHttpServer())
.put(`/api/v1/traffic-profiles/${sampleTrafficProfileId}`)
.send(updateTrafficProfileInput)
.expect(200)
.expect((res) => {
expect(res.body).toBeDefined();
// add assertions for the expected response structure and data here
}));
});

describe('DELETE /traffic-profiles/:id', () => {
const sampleTrafficProfileId = '123456';

it('/should remove a specific traffic profile by id', () =>
request(app.getHttpServer())
.delete(`/api/v1/traffic-profiles/${sampleTrafficProfileId}`)
.expect(200)
.expect((res) => {
expect(res.body).toBeDefined();
// add assertions for the expected response structure and data here
}));
});
});
