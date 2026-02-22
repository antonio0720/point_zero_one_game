import { Test, TestingModule } from '@nestjs/testing';
import { RefundRulesService } from '../refund-rules.service';
import { RefundRulesController } from '../refund-rules.controller';
import { DisputeResolutionService } from '../../dispute-resolution/dispute-resolution.service';
import { CreateRefundRuleDto, UpdateRefundRuleDto } from '../dto';

describe('RefundRulesController', () => {
let controller: RefundRulesController;
let service: RefundRulesService;
let disputeResolutionService: DisputeResolutionService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [RefundRulesController],
providers: [RefundRulesService, DisputeResolutionService],
}).compile();

controller = module.get<RefundRulesController>(RefundRulesController);
service = module.get<RefundRulesService>(RefundRulesService);
disputeResolutionService = module.get<DisputeResolutionService>(DisputeResolutionService);
});

describe('create', () => {
it('should create a new refund rule', async () => {
const createRefundRuleDto: CreateRefundRuleDto = {};
jest.spyOn(service, 'create').resolves({ id: 1 });

expect(await controller.create(createRefundRuleDto)).toEqual({ id: 1 });
});
});

describe('findOne', () => {
it('should return the refund rule with given id', async () => {
const ruleId = 1;
jest.spyOn(service, 'findOne').resolves({ id: ruleId });

expect(await controller.findOne(ruleId)).toEqual({ id: ruleId });
});
});

describe('update', () => {
it('should update the refund rule with given id', async () => {
const ruleId = 1;
const updateRefundRuleDto: UpdateRefundRuleDto = {};
jest.spyOn(service, 'update').resolves({ id: ruleId });

expect(await controller.update(ruleId, updateRefundRuleDto)).toEqual({ id: ruleId });
});
});

describe('remove', () => {
it('should delete the refund rule with given id', async () => {
const ruleId = 1;
jest.spyOn(service, 'remove').resolves();

expect(await controller.remove(ruleId)).toBeUndefined();
});
});
});
