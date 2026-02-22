import { appeals4 } from '../../src/backend/moderation/appeals/appeals-4';
import { User, Appeal, Ban } from '../../src/interfaces';
import { createMockUser, createMockAppeal, createMockBan } from '../mocks';
import { expect } from 'chai';

describe('Abuse + ban management - appeals-4', () => {
let user: User;
let appeal: Appeal;
let ban: Ban;

beforeEach(() => {
user = createMockUser();
appeal = createMockAppeal(user);
ban = createMockBan(user);
});

it('should handle unban on valid appeal', async () => {
// Given a banned user with an approved appeal
appeals4.handleAppeal(appeal, 'approved');
expect(ban.status).to.equal('unbanned');
});

it('should reject unban on invalid or non-existent appeal', async () => {
// Given a banned user with an invalid or non-existent appeal
const invalidAppeal = { ...appeal, id: 'invalid' };
const nonExistentAppeal = null;

await expect(appeals4.handleAppeal(invalidAppeal, 'approved')).to.be.rejected;
await expect(appeals4.handleAppeal(nonExistentAppeal, 'approved')).to.be.rejected;
});

it('should reject unban on a non-banned user', async () => {
// Given a non-banned user
ban = createMockBan({ ...user, status: 'unbanned' });

await expect(appeals4.handleAppeal(appeal, 'approved')).to.be.rejected;
});
});
