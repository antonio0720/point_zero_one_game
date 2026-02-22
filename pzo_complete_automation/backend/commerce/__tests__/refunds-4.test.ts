import { RefundService } from '../services/refund-service';
import { CommerceClient } from '@commerce/client';
import { EntitlementService } from '@entitlements/services';
import { RefundInput } from '../dtos/refund.input';
import { Refund } from '../entities/refund.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { RefundRepository } from '../repositories/refund.repository';
import { OrderRepository } from '@commerce/repositories/order.repository';
import { EntitlementRepository } from '@entitlements/repositories/entitlement.repository';

describe('RefundService', () => {
let refundService: RefundService;
let refundRepository: RefundRepository;
let orderRepository: OrderRepository;
let entitlementRepository: EntitlementRepository;
let commerceClient: CommerceClient;
let entitlementService: EntitlementService;
let sequelize: Sequelize;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
RefundService,
{ provide: Sequelize, useValue: new Sequelize() },
{ provide: getModelToken(Refund.name), useValue: Refund },
{ provide: RefundRepository, useClass: RefundRepository },
{ provide: OrderRepository, useClass: OrderRepository },
{ provide: EntitlementRepository, useClass: EntitlementRepository },
CommerceClient,
EntitlementService,
],
})
.overrideProvider(CommerceClient)
.useValue({})
.overrideProvider(EntitlementService)
.useValue({});

refundService = module.get<RefundService>(RefundService);
refundRepository = module.get<RefundRepository>(RefundRepository);
orderRepository = module.get<OrderRepository>(OrderRepository);
entitlementRepository = module.get<EntitlementRepository>(EntitlementRepository);
sequelize = module.get<Sequelize>(Sequelize);
commerceClient = module.get(CommerceClient);
entitlementService = module.get(EntitlementService);

await sequelize.sync();
});

describe('createRefund', () => {
const orderId = 'order-123';
const refundInput: RefundInput = {
orderId,
reason: 'Item defective',
amount: 50,
};

it('should create a new refund and return the created refund object', async () => {
// Create test data for order and entitlements
const order = await orderRepository.create({ id: orderId });
const entitlement = await entitlementRepository.create({});

// Assuming commerceClient and entitlementService have methods to handle order details and entitlement checks
jest.spyOn(commerceClient, 'getOrder').mockResolvedValue(order);
jest.spyOn(entitlementService, 'checkEntitlement').mockResolvedValue(true);

const createdRefund = await refundService.createRefund(refundInput);

expect(createdRefund).toBeInstanceOf(Refund);
expect(createdRefund.orderId).toEqual(orderId);
// Add more assertions for specific fields based on your data model
});
});
});
