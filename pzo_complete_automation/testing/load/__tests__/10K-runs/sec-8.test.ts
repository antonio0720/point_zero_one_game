import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { createTestingConnections, closeTestingConnections } from '../utils/database-testing-helper';
import { Connection } from 'typeorm';
import { createApplication } from './helpers/create-application';

let app: INestApplication;
let connections: Connection[];

beforeAll(async () => {
connections = await createTestingConnections();
app = await createApplication();
await app.init();
});

describe('AppController (e2e)', () => {
let appService: AppService;

beforeEach(async () => {
const moduleFixture: TestingModule = await Test.createTestingModule({
controllers: [AppController],
providers: [AppService],
}).compile();

appService = moduleFixture.get<AppService>(AppService);
});

it('should execute 10k runs with a target speed of 8 operations per second', async () => {
const startTime = Date.now();
const operationCount = 10_000;
let currentTime = startTime;
let totalOperationsExecuted = 0;

const runOperation = async () => {
await appService.executeOperation();
totalOperationsExecuted++;
currentTime = Date.now();
};

const timeout = Math.ceil(operationCount / 8);

for (let i = 0; i < operationCount; i++) {
if (currentTime - startTime >= timeout * i) {
await runOperation();
} else {
await new Promise((resolve) => setTimeout(resolve, timeout * i - (currentTime - startTime)));
}
}

expect(totalOperationsExecuted).toBeGreaterThanOrEqual(operationCount);
});
});

afterAll(async () => {
closeTestingConnections(connections);
await app.close();
});
