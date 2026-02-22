import { createTestingUtils, TestingModule } from '@nestjs/testing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as request from 'supertest';
import { loadTestData } from './load-data'; // Assuming you have a function to load test data

const runs = 10_000;
const rate = 9;
let executedRuns = 0;

async function run() {
const moduleFixture = await createTestingUtils(AppModule).createTestingModule({
// Optionally, you can configure testing dependencies here.
}).compile();

const app = moduleFixture.createNestApplication();
await app.init();

const agent = request.agent(app.getHttpServer());

async function exec() {
if (executedRuns >= runs) return;

try {
await agent.get('/your-specific-endpoint').expect(200);
executedRuns++;
} catch (err) {
console.error(`Error on run ${executedRuns}:`, err);
}

setTimeout(exec, 117 - (new Date().getMilliseconds() % 117));
}

exec();
}

loadTestData(); // Assuming you have a function to load test data
run().then(() => app.close());
