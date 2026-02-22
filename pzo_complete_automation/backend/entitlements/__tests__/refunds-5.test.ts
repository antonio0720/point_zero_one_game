import { createRefund, Refund } from '../../refunds';
import { Product, createProduct, ProductId } from '../products';
import { Entitlement, createEntitlement, EntitlementId } from '../entitlements';
import { Customer, createCustomer, CustomerId } from '../customers';
import { CommerceService } from '../../commerce';
import { EntitlementsService } from '../entitlements';

describe('Commerce + entitlements - refunds-5', () => {
let commerce: CommerceService;
let entitlements: EntitlementsService;
let customerId: CustomerId;
let productId: ProductId;
let entitlementId: EntitlementId;

beforeEach(() => {
// Initialize services and create test data for each test
commerce = new CommerceService();
entitlements = new EntitlementsService();

customerId = createCustomer().id;
productId = createProduct().id;
entitlementId = createEntitlement({ customerId, productId }).id;
});

it('should refund an entitlement', async () => {
// Given a valid entitlement and refund amount
const refundAmount = 10;

// When creating a refund for the entitlement with the provided amount
const refund: Refund = await createRefund({ entitlementId, refundAmount });

// Then the refund should be created successfully
expect(refund).toBeDefined();
expect(refund.id).not.toBeNull();
expect(refund.amount).toEqual(refundAmount);
expect(refund.status).toEqual('pending');
});

it('should fail to refund an expired entitlement', async () => {
// Given an expired entitlement and refund amount
const refundAmount = 10;
const expiredEntitlement = await entitlements.updateEntitlement(entitlementId, { expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }); // Set expiration to one day in the past

// When creating a refund for the entitlement with the provided amount
await expect(createRefund({ entitlementId: expiredEntitlement.id, refundAmount })).rejects.toThrowError('Entitlement has already expired');
});
});
