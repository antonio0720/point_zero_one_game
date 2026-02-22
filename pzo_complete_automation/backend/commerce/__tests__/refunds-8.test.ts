import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { RefundRepository } from './refund.repository';
import { EntitlementService } from '../entitlements/entitlement.service';
import { getModelToken, Model } from '@nestjs/mongoose';
import { Order, OrderDocument } from 'src/commerce/schemas/order.schema';
import { Refund, RefundDocument } from './schemas/refund.schema';
import { Product, ProductDocument } from 'src/commerce/products/schemas/product.schema';
import { User, UserDocument } from 'src/auth/schemas/user.schema';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RefundEntity } from './refund.entity';
import { EntitlementEntity } from '../entitlements/entities/entitlement.entity';
import { createRefund, createEntitlement, createOrder, createProduct, createUser } from './test-utils';

describe('RefundService', () => {
let service: RefundService;
let refundRepository: RefundRepository;
let entitlementService: EntitlementService;
let orderRepository: Model<OrderDocument>;
let productRepository: Model<ProductDocument>;
let userRepository: Model<UserDocument>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
RefundService,
{ provide: RefundRepository, useValue: jest.fn() },
EntitlementService,
{ provide: getModelToken(Order.name), useValue: Model },
{ provide: getModelToken(Product.name), useValue: Model },
{ provide: getModelToken(User.name), useValue: Model },
],
}).compile();

service = module.get<RefundService>(RefundService);
refundRepository = module.get<RefundRepository>(RefundRepository);
entitlementService = module.get<EntitlementService>(EntitlementService);
orderRepository = module.get(getModelToken(Order.name));
productRepository = module.get(getModelToken(Product.name));
userRepository = module.get(getModelToken(User.name));
});

it('should implement createRefund', async () => {
// Setup
const order = await createOrder();
const product = await createProduct();
const user = await createUser();
jest.spyOn(refundRepository, 'create').mockResolvedValue(new RefundEntity());
jest.spyOn(entitlementService, 'updateEntitlement').mockResolvedValue(new EntitlementEntity());

// Test
await service.createRefund(createRefund({ order, product, user }));

// Verify
expect(refundRepository.create).toHaveBeenCalledWith(createRefund({ order, product, user }));
expect(entitlementService.updateEntitlement).toHaveBeenCalled();
});

it('should implement findAllRefunds', async () => {
// Setup
const refund1 = new RefundEntity();
const refund2 = new RefundEntity();

jest.spyOn(refundRepository, 'find').mockResolvedValue([refund1, refund2]);

// Test
const result = await service.findAllRefunds();

// Verify
expect(result).toEqual([refund1, refund2]);
});

it('should implement findOneRefund', async () => {
// Setup
const id = 'test-id';
const refund = new RefundEntity();

jest.spyOn(refundRepository, 'findOne').mockResolvedValue(refund);

// Test
const result = await service.findOneRefund(id);

// Verify
expect(result).toEqual(refund);
});

it('should implement updateRefund', async () => {
// Setup
const id = 'test-id';
const refund = new RefundEntity();

jest.spyOn(refundRepository, 'findOneAndUpdate').mockResolvedValue(refund);

// Test
const result = await service.updateRefund(id, refund);

// Verify
expect(result).toEqual(refund);
});

it('should implement deleteRefund', async () => {
// Setup
const id = 'test-id';

jest.spyOn(refundRepository, 'findOneAndDelete').mockResolvedValue({ deletedCount: 1 });

// Test
await service.deleteRefund(id);

// Verify
expect(refundRepository.findOneAndDelete).toHaveBeenCalledWith({ _id: id });
});
});
