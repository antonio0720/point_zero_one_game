import { Test, TestingModule } from '@nestjs/testing';
import { ArbitrationService5 } from '../arbitration-5.service';
import { Arbitration5Controller } from '../arbitration-5.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Arbitration5Entity } from '../entities/arbitration-5.entity';

describe('ArbitrationService5', () => {
let service: ArbitrationService5;
let controller: Arbitration5Controller;
let repository: Repository<Arbitration5Entity>;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [Arbitration5Controller],
providers: [ArbitrationService5, Arbitration5Repository],
}).compile();

service = module.get<ArbitrationService5>(ArbitrationService5);
controller = module.get<Arbitration5Controller>(Arbitration5Controller);
repository = module.get<Repository<Arbitration5Entity>>(getRepositoryToken(Arbitration5Entity));
});

it('should be defined', () => {
expect(service).toBeDefined();
});

describe('arbitration methods', () => {
// Add your test cases for the arbitration methods here
});
});
