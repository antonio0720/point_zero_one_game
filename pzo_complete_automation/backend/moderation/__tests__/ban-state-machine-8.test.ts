import { BanStateMachine } from '../../ban-state-machine';
import { User, AbuseReport } from '../../../domain/entities';
import { BanReason } from '../../../domain/enums';
import { IBanRepository } from '../../repositories';
import { NotFoundError } from '../../../domain/errors';
import sinon from 'sinon';
import { expect } from 'chai';

describe('Abuse + ban management - ban-state-machine', () => {
let banStateMachine: BanStateMachine;
let banRepositoryStub: Partial<IBanRepository>;
let user: User;
let abuseReport: AbuseReport;

beforeEach(() => {
banRepositoryStub = {
createBan: sinon.stub(),
updateBanStatus: sinon.stub(),
getBanByUserId: sinon.stub().resolves(null),
getBannedUserById: sinon.stub().resolves(user),
};

banStateMachine = new BanStateMachine(banRepositoryStub as IBanRepository);

user = new User({ id: 1, username: 'testUser' });
abuseReport = new AbuseReport({
userId: 1,
reason: BanReason.OffensiveContent,
createdAt: new Date(),
});
});

describe('createBan', () => {
it('should create a ban when an abuse report is received and the user is not banned', async () => {
banRepositoryStub.getBanByUserId.withArgs(1).resolves(null);

await banStateMachine.createBan(abuseReport);

sinon.assert.calledOnce(banRepositoryStub.createBan);
sinon.assert.calledWithExact(banRepositoryStub.createBan, abuseReport);
});

it('should not create a ban when the user is already banned', async () => {
banRepositoryStub.getBanByUserId.withArgs(1).resolves({ id: 1 });

await expect(banStateMachine.createBan(abuseReport)).to.be.rejectedWith(NotFoundError);
sinon.assert.notCalled(banRepositoryStub.createBan);
});
});

describe('updateBanStatus', () => {
it('should update the ban status when a report is received for a banned user', async () => {
await banStateMachine.createBan(abuseReport);

sinon.assert.notCalled(banRepositoryStub.createBan);
sinon.assert.calledOnce(banRepositoryStub.getBannedUserById);
sinon.assert.calledWithExact(banRepositoryStub.getBannedUserById, 1);

const bannedUser = user;
banRepositoryStub.getBannedUserById.resolves(bannedUser);

await banStateMachine.updateBanStatus(abuseReport);

sinon.assert.calledOnce(banRepositoryStub.updateBanStatus);
sinon.assert.calledWithExact(banRepositoryStub.updateBanStatus, 1, 'active');
});

it('should not update the ban status when a report is received for an unbanned user', async () => {
await expect(banStateMachine.updateBanStatus(abuseReport)).to.be.rejectedWith(NotFoundError);
sinon.assert.notCalled(banRepositoryStub.updateBanStatus);
});
});
});
