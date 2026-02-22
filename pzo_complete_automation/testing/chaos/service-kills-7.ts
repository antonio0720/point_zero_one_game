import { TestingModule, createNestApplication } from '@nestjs/testing';
import * as request from 'supertest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { INestApplication } from '@nestjs/common';
import { Service1Module } from './service1/service1.module';
import { Service2Module } from './service2/service2.module';
import { Service3Module } from './service3/service3.module';

describe('Load + stress + chaos testing - service-kills-7', () => {
let app: INestApplication;

beforeAll(async () => {
const moduleFixture = await TestingModule
.forRootAsync({
imports: [Service1Module, Service2Module, Service3Module],
})
.compile();

app = moduleFixture.createNestApplication();
app.controller(AppController);
await app.init();
});

it('should be able to start all services', async () => {
// test the health checks of all services before killing some
const service1HealthCheck = await request(app.getHttpServer())
.get('/service1/health')
.expect(200);

const service2HealthCheck = await request(app.getHttpServer())
.get('/service2/health')
.expect(200);

const service3HealthCheck = await request(app.getHttpServer())
.get('/service3/health')
.expect(200);
});

it('should be able to kill services and still have the application running', async () => {
// kill Service1, Service2 and Service3 using any method available in your environment (e.g., `kill` command, Docker, Kubernetes...)
// ...

// test the health checks again after killing some services
const service1HealthCheck = await request(app.getHttpServer())
.get('/service1/health')
.expect(503); // Service1 should be down

const service2HealthCheck = await request(app.getHttpServer())
.get('/service2/health')
.expect(503); // Service2 should be down

const service3HealthCheck = await request(app.getHttpServer())
.get('/service3/health')
.expect(200); // Service3 should still be up
});
});
