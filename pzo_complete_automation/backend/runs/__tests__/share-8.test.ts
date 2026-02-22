import { Test, TestingModule } from '@nestjs/testing';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Share, ShareSchema } from './schemas/share.schema';
import * as mongoose from 'mongoose';
import { INestApplication } from '@nestjs/common';

describe('ShareController (e2e)', () => {
let app: INestApplication;

beforeAll(async () => {
const moduleFixture = await Test.createTestingModule({
imports: [
MongooseModule.forRoot('mongodb://localhost/nest'),
MongooseModule.forFeature([{ name: Share.name, schema: ShareSchema }]),
],
controllers: [ShareController],
providers: [ShareService],
}).compile();

app = moduleFixture.createNestApplication();
await app.init();
});

afterAll(async () => {
const connection = mongoose.connection;
await connection.dropDatabase();
await connection.close();
await app.close();
});

describe('GET /share', () => {
it('/GET should return an array of shares', async () => {
// Your test code here
});
});

describe('POST /share', () => {
it('/POST should create a new share', async () => {
// Your test code here
});
});
});
