import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { RefundResolver } from './refund.resolver';
import { Refund } from './entities/refund.entity';
import { EntitlementService } from '../entitlements/entitlement.service';
import { CommerceService } from '../commerce/commerce.service';
import { getConnection, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Product } from '../commerce/entities/product.entity';
import { Purchase } from '../purchases/entities/purchase.entity';
import { EntitlementType } from '../entitlements/enums/entitlement-type.enum';
import { CreateRefundInput } from './dto/create-refund.input';
import { UpdateRefundInput } from './dto/update-refund.input';
import { RefundStatus } from './enums/refund-status.enum';

describe('RefundResolver', () => {
let refundService: RefundService;
let refundResolver: RefundResolver;
let entitlementService: EntitlementService;
let commerceService: CommerceService;
let refundRepository: Repository<Refund>;
let userRepository: Repository<User>;
let productRepository: Repository<Product>;
let purchaseRepository: Repository<Purchase>;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [
RefundService,
RefundResolver,
EntitlementService,
CommerceService,
{ provide: getConnection, useValue: getConnection() },
{ provide: Repository, useValue: jest.fn(), isScoped: true },
],
})
.overrideProvider(Repository)
.useClass((token) => {
if (token === Refund) return refundRepository;
if (token === User) return userRepository;
if (token === Product) return productRepository;
if (token === Purchase) return purchaseRepository;
return super.provide(token);
})
.compile();

refundService = module.get<RefundService>(RefundService);
refundResolver = module.get<RefundResolver>(RefundResolver);
entitlementService = module.get<EntitlementService>(EntitlementService);
commerceService = module.get<CommerceService>(CommerceService);
refundRepository = module.get(getConnection).getRepository(Refund);
userRepository = module.get(getConnection).getRepository(User);
productRepository = module.get(getConnection).getRepository(Product);
purchaseRepository = module.get(getConnection).getRepository(Purchase);
});

describe('refund', () => {
const user = new User();
const product = new Product();
const purchase = new Purchase();

beforeEach(() => {
user.id = 1;
product.id = 1;
purchase.id = 1;
purchase.userId = user.id;
purchase.productId = product.id;
// Assume data is seeded and pre-populated
});

it('should create a refund', async () => {
const createRefundInput: CreateRefundInput = {
purchaseId: purchase.id,
reason: 'Test Refund',
status: RefundStatus.PENDING,
entitlementType: EntitlementType.CREDIT,
amount: 10,
};

jest.spyOn(commerceService, 'getEntitlementBalance').mockResolvedValue(50);
jest.spyOn(refundService, 'createRefund').mockResolvedValue(new Refund());

const result = await refundResolver.mutate({ createRefundInput });
expect(result).toEqual(new Refund());
});

it('should update a refund', async () => {
const refund = new Refund();
refund.id = 1;
refund.purchaseId = purchase.id;
refundRepository.save(refund); // Assume the refund is saved to the database

const updateRefundInput: UpdateRefundInput = {
id: refund.id,
reason: 'Updated Reason',
status: RefundStatus.APPROVED,
};

jest.spyOn(refundService, 'updateRefund').mockResolvedValue(refund);

const result = await refundResolver.mutate({ updateRefundInput });
expect(result).toEqual(refund);
});
});
});
