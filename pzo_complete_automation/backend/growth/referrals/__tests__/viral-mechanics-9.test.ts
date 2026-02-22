import { ViralMechanics9 } from '../viral-mechanics-9';
import { User } from '../../../user/entities/user.entity';
import { Connection } from 'typeorm';
import { createConnection } from 'typeorm-testing';
import { expect } from 'chai';

describe('ViralMechanics9', () => {
let connection: Connection;
let viralMechanics9: ViralMechanics9;

beforeAll(async () => {
connection = await createConnection();
viralMechanics9 = new ViralMechanics9(connection);
});

afterAll(async () => {
await connection.close();
});

describe('rewardPoints', () => {
let user1: User;
let user2: User;
let user3: User;

beforeEach(async () => {
// Create users for the test
user1 = await connection.manager.save(new User());
user2 = await connection.manager.save(new User());
user3 = await connection.manager.save(new User());
});

it('should reward points correctly when user 1 invites user 2', async () => {
// Invite user 2 by user 1
const result = await viralMechanics9.invite(user1, user2);

expect(result).to.be.equal(50); // User 1 earns 50 points for inviting user 2
expect(user1.points).to.be.equal(50);
expect(user2.points).to.be.equal(0);

// Invite user 3 by user 2 (who has been invited by user 1)
const result2 = await viralMechanics9.invite(user2, user3);

expect(result2).to.be.equal(5); // User 2 earns 5 points for inviting user 3
expect(user2.points).to.be.equal(55);
expect(user3.points).to.be.equal(0);
});

it('should not reward points when a user is already registered', async () => {
// Invite an already registered user (user1) by user2
const result = await viralMechanics9.invite(user2, user1);

expect(result).to.be.equal(0); // No points are rewarded since user1 is already registered
expect(user1.points).to.be.equal(50);
expect(user2.points).to.be.equal(55);
});
});
});
