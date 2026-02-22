import { Test, TestingModule } from '@nestjs/testing';
import { TrafficProfiles3Service } from './traffic-profiles-3.service';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('TrafficProfiles3 (e2e)', () => {
let app: INestApplication;
let service: TrafficProfiles3Service;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
service = moduleFixture.get<TrafficProfiles3Service>(TrafficProfiles3Service);
await app.init();
});

afterAll(async () => {
await app.close();
});

describe('/profiles (GET)', () => {
it('should return all traffic profiles', async () => {
const response = await request(app.getHttpServer()).get('/api/traffic-profiles/3');
expect(response.statusCode).toBe(200);
// Additional assertions on the response data if needed
});
});

describe('/profiles/:id (GET)', () => {
it('should return a single traffic profile', async () => {
const profileId = 'example_profile_id';
const response = await request(app.getHttpServer()).get(`/api/traffic-profiles/3/${profileId}`);
expect(response.statusCode).toBe(200);
// Additional assertions on the response data if needed
});
});

describe('/profiles/:id (PUT)', () => {
it('should update a traffic profile', async () => {
const profileId = 'example_profile_id';
const updatedProfileData = {}; // Example data for updating the profile
const response = await request(app.getHttpServer())
.put(`/api/traffic-profiles/3/${profileId}`)
.send(updatedProfileData);
expect(response.statusCode).toBe(200);
// Additional assertions on the response data if needed
});
});

describe('/profiles/:id (DELETE)', () => {
it('should delete a traffic profile', async () => {
const profileId = 'example_profile_id';
const response = await request(app.getHttpServer()).delete(`/api/traffic-profiles/3/${profileId}`);
expect(response.statusCode).toBe(204);
});
});
});
