import { Test, TestingModule } from '@nestjs/testing';
import { RivalryLedger18Service } from './rivalry-ledger-18.service';
import { RivalryLedger18Controller } from './rivalry-ledger-18.controller';

describe('RivalryLedger18', () => {
let service: RivalryLedger18Service;
let controller: RivalryLedger18Controller;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [RivalryLedger18Controller],
providers: [RivalryLedger18Service],
}).compile();

service = module.get<RivalryLedger18Service>(RivalryLedger18Service);
controller = module.get<RivalryLedger18Controller>(RivalryLedger18Controller);
});

describe('controller', () => {
it('should be defined', () => {
expect(controller).toBeDefined();
});

it('should call service method correctly', async () => {
const result = await controller.yourMethodName();
// Add your assertions here
});
});

describe('service', () => {
// Write tests for the RivalryLedger18Service methods here
});
});
