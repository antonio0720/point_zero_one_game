import { Session, User } from '../../models';
import request from 'supertest';
import app from '../../../index';
import { createUser, signIn } from '../utils/db-functions';

describe('Session Management (Matchmaking + sessions - session-management-6)', () => {
beforeAll(async () => {
await Session.destroy({ where: {} });
await User.destroy({ where: {} });
});

let user1, user2, token1, token2;

beforeEach(async () => {
user1 = await createUser('user1@example.com', 'password1');
user2 = await createUser('user2@example.com', 'password2');

const signInResponse1 = await signIn(user1);
token1 = signInResponse1.token;

const signInResponse2 = await signIn(user2);
token2 = signInResponse2.token;
});

it('should not allow user to match with himself', async () => {
const response = await request(app)
.post('/api/match')
.set('Authorization', `Bearer ${token1}`);

expect(response.status).toEqual(403);
});

it('should allow users to match', async () => {
const response = await request(app)
.post('/api/match')
.set('Authorization', `Bearer ${token1}`);

expect(response.status).toEqual(200);
expect(response.body).toHaveProperty('opponent');
});

it('should not allow user to match with a user he is already matched with', async () => {
const matchResponse = await request(app)
.post('/api/match')
.set('Authorization', `Bearer ${token1}`);

const opponentId = matchResponse.body.opponent;

const secondMatchResponse = await request(app)
.post('/api/match')
.set('Authorization', `Bearer ${token1}`);

expect(secondMatchResponse.status).toEqual(403);
expect(secondMatchResponse.body).toHaveProperty('error');
});

it('should update the session with the opponent and game status', async () => {
const matchResponse = await request(app)
.post('/api/match')
.set('Authorization', `Bearer ${token1}`);

const opponentId = matchResponse.body.opponent;
const opponentSession = await Session.findOne({ where: { userId: opponentId } });

expect(opponentSession.status).toEqual('waiting');
});

it('should not allow user to play with an offline opponent', async () => {
const matchResponse = await request(app)
.post('/api/match')
.set('Authorization', `Bearer ${token1}`);

const opponentId = matchResponse.body.opponent;
await User.update(
{ online: false },
{ where: { id: opponentId } }
);

const playResponse = await request(app)
.post('/api/play')
.set('Authorization', `Bearer ${token1}`);

expect(playResponse.status).toEqual(403);
});
});
