import { RefundService } from '../../services/refund.service';
import { EntitlementService } from '../../services/entitlement.service';
import { Refund } from '../../models/refund';
import { Entitlement } from '../../models/entitlement';
import { createRefund, createEntitlement, RefundStatus } from '@test/factories';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Injectable, inject } from '@nestjs/common';

jest.mock('../../services/entitlement.service');

describe('RefundService', () => {
let refundService: RefundService;
let entitlementService: EntitlementService;

beforeAll(() => {
refundService = new RefundService(entitlementService as any);
});

afterEach(() => {
jest.clearAllMocks();
});

describe('processRefund', () => {
it('should process a valid refund with an available entitlement', async () => {
const refund = createRefund({ amount: 10, status: RefundStatus.PENDING });
const entitlement = createEntitlement({ balance: 20 });

entitlementService.findByCustomerIdAndName.mockResolvedValue(entitlement);

await refundService.processRefund(refund);

expect(entitlementService.updateBalance).toHaveBeenCalledWith(entitlement.id, entitlement.balance - refund.amount);
expect(refund.status).toEqual(RefundStatus.APPROVED);
});

it('should reject a refund when the entitlement balance is not sufficient', async () => {
const refund = createRefund({ amount: 25, status: RefundStatus.PENDING });
const entitlement = createEntitlement({ balance: 10 });

entitlementService.findByCustomerIdAndName.mockResolvedValue(entitlement);

await expect(refundService.processRefund(refund)).rejects.toThrow('Insufficient entitlement balance');
});
});
});
