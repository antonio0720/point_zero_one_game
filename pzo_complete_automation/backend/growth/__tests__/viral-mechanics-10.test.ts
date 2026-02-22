import { ViralMechanics10 } from '../viral-mechanics-10';
import { User } from '../../user';
import { expect } from 'chai';
import sinon from 'sinon';
import { mockDeep } from 'jest-mock-extended';

describe('ViralMechanics10', () => {
let viralMechanics10: ViralMechanics10;
const userMock = mockDeep<User>();

beforeEach(() => {
viralMechanics10 = new ViralMechanics10();
sinon.stub(userMock, 'incrementDailyInvites').returnsPromise();
});

it('should correctly handle user with daily invites limit', async () => {
// Arrange
const user = userMock.object();
user.dailyInvitesLimit = 5;
user.invitesSentToday = 4;

// Act
await viralMechanics10.increaseUserInvites(user);

// Assert
expect(userMock.incrementDailyInvites).toHaveBeenCalledOnce();
expect(user.invitesSentToday).to.equal(5);
});

it('should correctly handle user without daily invites limit', async () => {
// Arrange
const user = userMock.object();
user.dailyInvitesLimit = null;
user.invitesSentToday = 0;

// Act
await viralMechanics10.increaseUserInvites(user);

// Assert
expect(userMock.incrementDailyInvites).toHaveBeenCalledOnce();
expect(user.invitesSentToday).to.equal(1);
});
});
