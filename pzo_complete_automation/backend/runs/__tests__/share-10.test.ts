import { Share10Service } from '../services/share-10.service';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken, Model } from '@nestjs/mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { share10Schema } from '../schemas/share-10.schema';

describe('Share10Service', () => {
let service: Share10Service;
let model: Model<any>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [
MongooseModule.forRoot('mongodb://localhost/test'),
MongooseModule.forFeature([{ name: 'Share10', schema: share10Schema }]),
],
providers: [Share10Service],
}).compile();

service = module.get<Share10Service>(Share10Service);
model = module.get(getModelToken('Share10'));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

it('should create a new share-10 instance', async () => {
const createdShare10 = await service.create();
expect(createdShare10).toBeDefined();
});

// Add more test cases as needed
});
