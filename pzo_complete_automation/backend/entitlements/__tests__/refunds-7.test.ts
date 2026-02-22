import { Test, TestingModule } from '@nestjs/testing';
import { RefundsService } from './refunds.service';
import { RefundRepository } from 'src/repositories/refund.repository';
import { ProductRepository } from 'src/repositories/product.repository';
import { CustomerRepository } from 'src/repositories/customer.repository';
import { EntitlementRepository } from 'src/repositories/entitlement.repository';
import { CreateRefundDto } from './dto/create-refund.dto';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';

describe('RefundsService', () => {
let service: RefundsService;
let refundRepository: RefundRepository;
let productRepository: ProductRepository;
let customerRepository: CustomerRepository;
let entitlementRepository: EntitlementRepository;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [RefundsService, RefundRepository, ProductRepository, CustomerRepository, EntitlementRepository],
}).compile();

service = module.get<RefundsService>(RefundsService);
refundRepository = module.get<RefundRepository>(RefundRepository);
productRepository = module.get<ProductRepository>(ProductRepository);
customerRepository = module.get<CustomerRepository>(CustomerRepository);
entitlementRepository = module.get<EntitlementRepository>(EntitlementRepository);
});

describe('create', () => {
const createRefundDto: CreateRefundDto = {
orderId: 'order_123',
customerId: 'customer_456',
entitlementId: 'entitlement_789',
productId: 'product_abc',
amount: 10,
};

it('should create a refund and return the created refund', async () => {
jest.spyOn(refundRepository, 'create').mockResolvedValue(1);
jest.spyOn(refundRepository, 'save').mockResolvedValue({ ...createRefundDto, id: 1 });

const result = await service.create(createRefundDto);

expect(result).toEqual({ ...createRefundDto, id: 1 });
});

it('should throw NotFoundException when the customer is not found', async () => {
jest.spyOn(customerRepository, 'findOne').mockResolvedValue(null);

await expect(service.create(createRefundDto)).rejects.toThrow(NotFoundException);
});

it('should throw NotFoundException when the product is not found', async () => {
jest.spyOn(productRepository, 'findOne').mockResolvedValue(null);

await expect(service.create(createRefundDto)).rejects.toThrow(NotFoundException);
});

it('should throw NotFoundException when the entitlement is not found', async () => {
jest.spyOn(entitlementRepository, 'findOne').mockResolvedValue(null);

await expect(service.create(createRefundDto)).rejects.toThrow(NotFoundException);
});

it('should throw InternalServerErrorException when an error occurs during the refund creation', async () => {
jest.spyOn(refundRepository, 'create').mockRejectedValue(new Error('An error occurred'));

await expect(service.create(createRefundDto)).rejects.toThrow(InternalServerErrorException);
});
});
});
