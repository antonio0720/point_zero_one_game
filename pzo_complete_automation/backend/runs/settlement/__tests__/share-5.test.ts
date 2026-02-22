import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CreateNestApplicationContext, SharedModule, ModuleRef } from '@nestjs/common';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';
import { SettlementModule } from './settlement.module';
import * as request from 'supertest';

describe('share-5', () => {
let app: INestApplication;
let moduleRef: ModuleRef;

beforeAll(async () => {
const moduleFixture: TestingModule = await Test.createTestingModule({
imports: [SharedModule, SettlementModule],
controllers: [AppController],
})
.overrideProvider(AppService)
.useValue({})
.compile();

app = moduleFixture.createNestApplication();
moduleRef = moduleFixture.get<ModuleRef>(SharedModule);
});

afterAll(async () => {
await app.close();
});

it('should call share-5 lifecycle', async () => {
// Your test logic here
});
});
