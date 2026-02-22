import { Test, TestingModule } from '@nestjs/testing';
import { ClientFoundations5Module } from '../client-foundations-5.module';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

describe('ClientFoundations5 (e2e)', () => {
let app: INestApplication;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [ClientFoundations5Module],
})
.compile();

app = moduleFixture.createNestApplication();
await app.init();
});

it('/GET root', () => {
return request(app.getHttpServer())
.get('/')
.expect(200)
.expect('Hello World!');
});

afterAll(async () => {
await app.close();
});
});
