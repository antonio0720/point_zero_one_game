import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModerationActionsImpl } from '../moderation_actions/moderation_actions_impl';
import { EvidenceAttachment, Appeal } from '../../models';
import { createMockDate } from 'jest-mock-date';

createMockDate(); // Initialize mock date

let moderationActions: ModerationActionsImpl;

beforeEach(() => {
  moderationActions = new ModerationActionsImpl();
});

afterEach(() => {
  createMockDate.resetAllMocks();
});

describe('Evidence Attachment and Appeal Flow Timing', () => {
  it('should attach evidence correctly with a valid appeal', () => {
    const appeal = new Appeal({
      id: '123',
      createdAt: new Date(),
      status: 'PENDING',
      userId: 'user1',
      reason: 'Test reason',
    });

    const evidence = new EvidenceAttachment({
      id: '456',
      appealId: appeal.id,
      url: 'test_url',
      createdAt: new Date(),
    });

    moderationActions.attachEvidence(appeal, evidence);

    expect(appeal.evidenceAttachments).toHaveLength(1);
    expect(appeal.evidenceAttachments[0]).toEqual(evidence);
  });

  it('should not attach evidence if appeal is invalid', () => {
    const appeal = new Appeal({
      id: '123',
      createdAt: new Date(),
      status: 'REJECTED', // Invalid status
      userId: 'user1',
      reason: 'Test reason',
    });

    const evidence = new EvidenceAttachment({
      id: '456',
      appealId: appeal.id,
      url: 'test_url',
      createdAt: new Date(),
    });

    moderationActions.attachEvidence(appeal, evidence);

    expect(appeal.evidenceAttachments).toHaveLength(0);
  });

  it('should not attach evidence if appeal does not exist', () => {
    const evidence = new EvidenceAttachment({
      id: '456',
      appealId: 'non_existent_appeal_id', // Invalid appeal ID
      url: 'test_url',
      createdAt: new Date(),
    });

    moderationActions.attachEvidence(null, evidence);

    expect(evidence.appeal).toBeNull();
  });

  it('should handle edge cases for evidence attachment timestamps', () => {
    const appeal = new Appeal({
      id: '123',
      createdAt: new Date(),
      status: 'PENDING',
      userId: 'user1',
      reason: 'Test reason',
    });

    const evidence1 = new EvidenceAttachment({
      id: '456',
      appealId: appeal.id,
      url: 'test_url_1',
      createdAt: new Date(Date.now() - 86400000), // Yesterday
    });

    const evidence2 = new EvidenceAttachment({
      id: '789',
      appealId: appeal.id,
      url: 'test_url_2',
      createdAt: new Date(), // Today
    });

    moderationActions.attachEvidence(appeal, evidence1);
    moderationActions.attachEvidence(appeal, evidence2);

    expect(appeal.evidenceAttachments[0].createdAt).toBeLessThanOrEqual(appeal.evidenceAttachments[1].createdAt);
  });

  it('should handle edge cases for appeal status change timestamps', () => {
    const appeal = new Appeal({
      id: '123',
      createdAt: new Date(),
      status: 'PENDING',
      userId: 'user1',
      reason: 'Test reason',
    });

    moderationActions.changeAppealStatus(appeal, 'APPROVED');

    expect(appeal.updatedAt).toBeDefined();
  });

  it('should not change appeal status if appeal is invalid', () => {
    const invalidAppeal = new Appeal({
      id: '123',
      createdAt: new Date(),
      status: 'REJECTED', // Invalid status
      userId: 'user1',
      reason: 'Test reason',
    });

    moderationActions.changeAppealStatus(invalidAppeal, 'APPROVED');

    expect(invalidAppeal.status).toBe('REJECTED');
  });
});
