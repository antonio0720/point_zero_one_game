import { createSession, findSessionsByToken, updateSession, deleteSession } from './session-management';
import { Session, SessionInput, TokenInput, User } from '../../models';
import { getRepository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import sinon from 'sinon';
import { expect } from 'chai';
import app, { init } from '../../../app';

describe('Session Management', () => {
let appInstance: any;
let sessionRepository: any;
let userRepository: any;

before(async () => {
appInstance = await init();
sessionRepository = getRepository(Session);
userRepository = getRepository(User);
});

afterEach(async () => {
sinon.restore();
await sessionRepository.createQueryBuilder('session').delete().execute();
await userRepository.createQueryBuilder('user').delete().execute();
});

describe('Create Session', () => {
it('should create a new session', async () => {
const user = new User();
user.id = 'test-user-id';

sinon.stub(userRepository, 'findOne').resolves(user);

const sessionInput: SessionInput = { token: uuidv4() };
const createdSession = await createSession(sessionInput);

expect(createdSession).to.have.property('id');
expect(createdSession).to.have.property('userId', user.id);
});
});

describe('Find Sessions By Token', () => {
it('should find a session by token', async () => {
const user = new User();
user.id = 'test-user-id';

sinon.stub(userRepository, 'findOne').resolves(user);

const session1 = new Session();
session1.token = uuidv4();
session1.userId = user.id;

const session2 = new Session();
session2.token = uuidv4();
session2.userId = user.id;

await sessionRepository.save([session1, session2]);

sinon.stub(sessionRepository, 'findBy').resolves([session1, session2]);

const foundSessions = await findSessionsByToken(user.id);

expect(foundSessions).to.have.lengthOf(2);
});
});

describe('Update Session', () => {
it('should update an existing session', async () => {
const user = new User();
user.id = 'test-user-id';

sinon.stub(userRepository, 'findOne').resolves(user);

const session = new Session();
session.id = uuidv4();
session.token = uuidv4();
session.userId = user.id;

await sessionRepository.save(session);

sinon.stub(sessionRepository, 'findOne').resolves(session);
const updatedSessionInput: SessionInput = { token: uuidv4() };

await updateSession(updatedSessionInput);

const updatedSession = await sessionRepository.findOne({ where: { id: session.id } });

expect(updatedSession).to.have.property('token', updatedSessionInput.token);
});
});

describe('Delete Session', () => {
it('should delete an existing session', async () => {
const user = new User();
user.id = 'test-user-id';

sinon.stub(userRepository, 'findOne').resolves(user);

const session = new Session();
session.id = uuidv4();
session.token = uuidv4();
session.userId = user.id;

await sessionRepository.save(session);

sinon.stub(sessionRepository, 'findOne').resolves(session);
const deletedSessionId = await deleteSession(session.id);

expect(deletedSessionId).to.equal(session.id);
const foundSession = await sessionRepository.findOne({ where: { id: session.id } });

expect(foundSession).to.be.null;
});
});
});
