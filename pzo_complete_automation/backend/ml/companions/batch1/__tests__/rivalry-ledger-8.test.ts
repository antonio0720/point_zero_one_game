import { Test, TestingModule } from '@nestjs/testing';
import { RivalryLedger8Service } from './rivalry-ledger-8.service';
import { RivalryLedger8Controller } from './rivalry-ledger-8.controller';

describe('RivalryLedger8', () => {
let service: RivalryLedger8Service;
let controller: RivalryLedger8Controller;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [RivalryLedger8Controller],
providers: [RivalryLedger8Service],
}).compile();

service = module.get<RivalryLedger8Service>(RivalryLedger8Service);
controller = module.get<RivalryLedger8Controller>(RivalryLedger8Controller);
});

it('should be defined', () => {
expect(service).toBeDefined();
expect(controller).toBeDefined();
});

// Add your test cases here
});
