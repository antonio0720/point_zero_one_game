import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CommerceModule } from '../commerce/commerce.module';
import { RefundDto, CreateRefundDto } from './dto/refund.dto';
import { Refund } from './entities/refund.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, InjectEntityManager } from '@nestjs/typeorm';
import { EntitlementService } from '../entitlements/entitlement.service';
import { CommerceService } from '../commerce/commerce.service';

describe('RefundService', () => {
let refundService: RefundService;
let entityManager: EntityManager;
let entitlementService: EntitlementService;
let commerceService: CommerceService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
imports: [CommerceModule, EntitlementsModule],
providers: [RefundService, RefundDto, CreateRefundDto, Refund, getRepositoryToken(Refund), EntityManager, InjectEntityManager(), EntitlementService, CommerceService],
}).compile();

refundService = module.get<RefundService>(RefundService);
entityManager = module.get<EntityManager>(EntityManager);
entitlementService = module.get<EntitlementService>(EntitlementService);
commerceService = module.get<CommerceService>(CommerceService);
});

describe('createRefund', () => {
const createRefundDto: CreateRefundDto = {};

it('should create a refund and update entitlement balance', async () => {
// arrange

// act
const createdRefund: Refund = await refundService.createRefund(createRefundDto);

// assert
expect(createdRefund).toBeDefined();
expect(await entitlementService.getBalance()).toEqual(expect.not.toBeNull());
});
});

describe('processRefund', () => {
const refund: Refund = new Refund();

it('should process a refund and update commerce inventory', async () => {
// arrange

// act
await refundService.processRefund(refund);

// assert
expect(await commerceService.getInventory()).toEqual(expect.not.toBeNull());
});
});
});
