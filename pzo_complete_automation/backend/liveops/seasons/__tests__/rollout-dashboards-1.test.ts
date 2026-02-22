import { Test, TestingModule } from '@nestjs/testing';
import { RolloutDashboards1Service } from './rollout-dashboards-1.service';
import { RolloutDashboards1Controller } from './rollout-dashboards-1.controller';

describe('RolloutDashboards1Controller', () => {
let controller: RolloutDashboards1Controller;
let service: RolloutDashboards1Service;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [RolloutDashboards1Controller],
providers: [RolloutDashboards1Service],
}).compile();

controller = module.get<RolloutDashboards1Controller>(RolloutDashboards1Controller);
service = module.get<RolloutDashboards1Service>(RolloutDashboards1Service);
});

it('should be defined', () => {
expect(controller).toBeDefined();
expect(service).toBeDefined();
});

describe('methodName', () => {
it('should do something', async () => {
// Add your test case implementation here
});
});
});
