import { Test, TestingModule } from '@nestjs/testing';
import { EscrowMilestones4Service } from './escrow-milestones-4.service';
import { EscrowMilestones4Controller } from './escrow-milestones-4.controller';

describe('EscrowMilestones4', () => {
let service: EscrowMilestones4Service;
let controller: EscrowMilestones4Controller;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [EscrowMilestones4Controller],
providers: [EscrowMilestones4Service],
}).compile();

service = module.get<EscrowMilestones4Service>(EscrowMilestones4Service);
controller = module.get<EscrowMilestones4Controller>(EscrowMilestones4Controller);
});

it('should be defined', () => {
expect(service).toBeDefined();
expect(controller).toBeDefined();
});

// Add your specific test cases here
});
