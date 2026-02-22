import { RefundService } from '../services/refund.service';
import { EntitlementService } from '../services/entitlement.service';
import { RefundDto, EntitlementDto } from '../dtos';
import { createRefund, createEntitlement } from './mocks';
import { Test, TestingModule } from '@nestjs/testing';

describe('RefundService', () => {
let refundService: RefundService;
let entitlementService: EntitlementService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [RefundService, EntitlementService],
}).compile();

refundService = module.get<RefundService>(RefundService);
entitlementService = module.get<EntitlementService>(EntitlementService);
});

it('should create a refund and check entitlement', async () => {
const refundData: RefundDto = createRefund();
const entitlementData: EntitlementDto = createEntitlement();

jest.spyOn(entitlementService, 'findOne').mockResolvedValue(entitlementData);

const result = await refundService.create(refundData.orderId, refundData.amount);

expect(result).toEqual(refundData);
expect(entitlementService.findOne).toHaveBeenCalledWith(entitlementData.customerId);
});

it('should throw an error if the entitlement is not found', async () => {
const refundData: RefundDto = createRefund();

jest.spyOn(entitlementService, 'findOne').mockResolvedValue(null);

await expect(refundService.create(refundData.orderId, refundData.amount)).rejects.toEqual(new Error('Entitlement not found'));
});
});
