///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/src/security/creator_security.test.ts

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CreatorSecurity,
  type CreatorReceipt,
} from './creator_security';

describe('Creator Security', () => {
  let creatorSecurity: CreatorSecurity;
  let validToken: string;

  beforeEach(() => {
    creatorSecurity = new CreatorSecurity({
      authSecret: 'test-auth-secret',
      receiptSecret: 'test-receipt-secret',
      now: () => 1_710_000_000_000,
    });

    validToken = creatorSecurity.issueToken({
      creatorId: 'creator_01',
      scopes: ['creator:read', 'creator:receipts:read'],
      ttlSeconds: 60 * 15,
    });

    creatorSecurity.registerResource({
      resourceId: 'submission_001',
      ownerCreatorId: 'creator_01',
      kind: 'submission',
      visibility: 'private',
      payload: {
        title: 'Founding Era Build',
        state: 'draft',
      },
    });

    creatorSecurity.registerResource({
      resourceId: 'submission_public_001',
      ownerCreatorId: 'creator_02',
      kind: 'submission',
      visibility: 'public',
      payload: {
        title: 'Public Creator Drop',
        state: 'published',
      },
    });
  });

  describe('Auth Boundaries', () => {
    it('rejects unauthorized requests', async () => {
      await expect(
        creatorSecurity.authenticate('invalid_token'),
      ).rejects.toThrowError();
    });

    it('authenticates valid tokens', async () => {
      await expect(
        creatorSecurity.authenticate(validToken),
      ).resolves.toMatchObject({
        creatorId: 'creator_01',
        scopes: ['creator:read', 'creator:receipts:read'],
      });
    });
  });

  describe('Enumeration Resistance', () => {
    it('returns a stable not-found surface for missing resources', async () => {
      const responseA = await creatorSecurity.getResource(
        'missing_001',
        validToken,
      );
      const responseB = await creatorSecurity.getResource(
        'missing_001',
        validToken,
      );

      expect(responseA.status).toBe(404);
      expect(responseB.status).toBe(404);
      expect(responseA.publicCode).toBe('RESOURCE_NOT_FOUND');
      expect(responseB.publicCode).toBe('RESOURCE_NOT_FOUND');
      expect(responseA.body.message).toBe(responseB.body.message);
      expect(responseA.body.resource).toBeNull();
      expect(responseB.body.resource).toBeNull();
      expect(responseA.opaqueRequestId).not.toBe(responseB.opaqueRequestId);
    });

    it('does not reveal private resource existence to another creator', async () => {
      const nonOwnerToken = creatorSecurity.issueToken({
        creatorId: 'creator_99',
        scopes: ['creator:read'],
      });

      const response = await creatorSecurity.getResource(
        'submission_001',
        nonOwnerToken,
      );

      expect(response.status).toBe(404);
      expect(response.publicCode).toBe('RESOURCE_NOT_FOUND');
      expect(response.body.resource).toBeNull();
      expect(response.body.message).toBe('Creator resource was not found.');
    });

    it('allows authorized access to owned private resources', async () => {
      const response = await creatorSecurity.getResource(
        'submission_001',
        validToken,
      );

      expect(response.status).toBe(200);
      expect(response.publicCode).toBe('RESOURCE_OK');
      expect(response.body.resource).toMatchObject({
        resourceId: 'submission_001',
        kind: 'submission',
        visibility: 'private',
      });
    });

    it('keeps public resources readable without leaking extra fields', async () => {
      const anotherCreatorToken = creatorSecurity.issueToken({
        creatorId: 'creator_77',
        scopes: ['creator:read'],
      });

      const response = await creatorSecurity.getResource(
        'submission_public_001',
        anotherCreatorToken,
      );

      expect(response.status).toBe(200);
      expect(response.body.resource).toMatchObject({
        resourceId: 'submission_public_001',
        kind: 'submission',
        visibility: 'public',
      });
    });
  });

  describe('Receipt Integrity', () => {
    it('verifies the integrity of a valid receipt', async () => {
      const validReceipt: CreatorReceipt = creatorSecurity.issueReceipt({
        receiptId: 'receipt_001',
        creatorId: 'creator_01',
        subjectId: 'submission_001',
        amountCents: 4_900,
        currency: 'USD',
        nonce: 'nonce_valid_001',
      });

      await expect(
        creatorSecurity.verifyReceipt(validReceipt),
      ).resolves.toBe(true);
    });

    it('rejects invalid or tampered receipts', async () => {
      const validReceipt = creatorSecurity.issueReceipt({
        receiptId: 'receipt_002',
        creatorId: 'creator_01',
        subjectId: 'submission_001',
        amountCents: 12_500,
        currency: 'USD',
        nonce: 'nonce_valid_002',
      });

      const invalidReceipt: CreatorReceipt = {
        ...validReceipt,
        amountCents: 99_999,
      };

      await expect(
        creatorSecurity.verifyReceipt(invalidReceipt),
      ).rejects.toThrowError(/signature mismatch/i);
    });

    it('rejects malformed receipts before signature verification', async () => {
      const malformedReceipt = {
        receiptId: '',
        creatorId: 'creator_01',
        subjectId: 'submission_001',
        amountCents: -1,
        currency: 'usdollars',
        issuedAt: 0,
        nonce: '',
        signature: '',
      } as unknown as CreatorReceipt;

      await expect(
        creatorSecurity.verifyReceipt(malformedReceipt),
      ).rejects.toThrowError();
    });
  });
});