import { ViralMechanics11 } from '../../../src/backend/growth/referrals/viral-mechanics-11';
import { User } from '../../../src/models';
import { createTestUser } from '../helpers';

describe('Viral Mechanics 11', () => {
let viralMechanics: ViralMechanics11;
let user1: User;
let user2: User;

beforeAll(async () => {
// Initialize the ViralMechanics11 instance and create test users
viralMechanics = new ViralMechanics11();
[user1, user2] = await Promise.all([createTestUser(), createTestUser()]);
});

it('should reward user1 for referring user2', async () => {
// Perform the action that triggers the viral mechanics (e.g., user1 invites user2)
const result = await viralMechanics.reward(user1, user2);

// Assert that user1 has received the expected reward
expect(result).toEqual({ status: 'success', reward: /* expected reward for user1 */ });
});

it('should not reward user2 for self-referral', async () => {
// Try to reward user2 for referring themselves
const result = await viralMechanics.reward(user2, user2);

// Assert that user2 has not received any reward
expect(result).toEqual({ status: 'error', message: /* expected error message */ });
});
});
