import { RegulatoryFilings11Service } from '../services/regulatory-filings-11.service';
import { createTestingConnections, closeTestingConnections, rebuildTestingDatabases } from '@nestjs/typeorm/dist/testing';
import { DataSource } from 'typeorm';
import { RegulatoryFiling11 } from '../entities/regulatory-filing.entity';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';

describe('RegulatoryFilings11 (e2e)', () => {
let app: INestApplication;
let connection: DataSource;
let regulatoryFilings11Service: RegulatoryFilings11Service;

beforeAll(async () => {
connection = await createTestingConnections([__dirname + '/../entities/**/*{.ts,.js}']);
app = await NestFactory.createApplicationContext(AppModule);
regulatoryFilings11Service = app.get(RegulatoryFilings11Service);
});

it('should create a new regulatory filing', async () => {
const result = await regulatoryFilings11Service.createRegulatoryFiling({
// provide sample data for the test case
});
expect(result).toBeDefined();
});

it('should return all regulatory filings', async () => {
const filings = await regulatoryFilings11Service.findAll();
expect(filings.length).not.toBe(0);
});

// Add more test cases as needed, e.g., testing update and delete operations

afterEach(async () => {
// Clear the database between tests
await rebuildTestingDatabases(connection);
});

afterAll(async () => {
// Close the testing connections
await closeTestingConnections(connection);
await app.close();
});
});
