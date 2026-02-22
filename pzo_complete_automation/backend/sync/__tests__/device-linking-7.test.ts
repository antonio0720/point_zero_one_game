import { beforeEach, describe, expect, it } from '@jest';
import { createTestApp, createTestUser, TestApp, TestUser } from 'test/helpers';
import { configure, getState, setState } from 'redux-zero';
import { deviceLinkingReducer } from './device-linking.ts';
import { DeviceLinking, DeviceLinkingActions } from './types';
import { DEVICE_LINKING_ACTION_TYPES } from './actions';
import { createDeviceLinkingStore } from './store';
import { setupTestMiddleware } from 'test/middleware';
import { Request, Response } from 'express';

const initialState: DeviceLinking = {
activeSessionId: null,
deviceTokensBySessionId: {},
};

let app: TestApp;
let user: TestUser;
let store: ReturnType<typeof createDeviceLinkingStore>;

beforeEach(async () => {
app = await createTestApp();
const { client } = await createTestUser(app);
user = client.user;
store = configure({ reducer: deviceLinkingReducer, initialState })().create();
});

describe('Multi-client sync + handoff - device-linking-7', () => {
it('should handle multiple clients with different devices', async () => {
// Create second client and user
const { client: client2 } = await createTestUser(app);
const user2 = client2.user;

// Initialize the second store for user2
const user2Store = configure({ reducer: deviceLinkingReducer, initialState })().create();

// Simulate device registration for both users
setupTestMiddleware(app);
await request(app.server)
.post('/api/device-linking/register')
.set('Authorization', `Bearer ${user.token}`)
.send({ deviceToken: 'device1_token' })
.expect(200);

await request(app.server)
.post('/api/device-linking/register')
.set('Authorization', `Bearer ${user2.token}`)
.send({ deviceToken: 'device2_token' })
.expect(200);

// Simulate a session start for user on device1
await request(app.server)
.post('/api/session')
.set('Authorization', `Bearer ${user.token}`)
.send({ name: 'Session 1' })
.expect(200);

const state = getState(store);
expect(state.activeSessionId).toBe('Session 1');
expect(state.deviceTokensBySessionId['Session 1']).toEqual(['device1_token']);

// Simulate a session start for user2 on device2
await request(app.server)
.post('/api/session')
.set('Authorization', `Bearer ${user2.token}`)
.send({ name: 'Session 2' })
.expect(200);

const state2 = getState(user2Store);
expect(state2.activeSessionId).toBe('Session 2');
expect(state2.deviceTokensBySessionId['Session 2']).toEqual(['device2_token']);

// Simulate handoff from device1 to device2
await request(app.server)
.post('/api/session-handoff')
.set('Authorization', `Bearer ${user.token}`)
.send({ sessionId: 'Session 1', deviceToken: 'device2_token' })
.expect(200);

const finalState = getState(store);
expect(finalState.activeSessionId).toBeNull();
expect(finalState.deviceTokensBySessionId).toEqual({});

const finalState2 = getState(user2Store);
expect(finalState2.activeSessionId).toBe('Session 1');
expect(finalState2.deviceTokensBySessionId['Session 1']).toEqual(['device2_token']);
});

it('should handle multiple clients with the same device', async () => {
// Create second client and user using the same device token as user1
const { client: client2 } = await createTestUser(app, 'device1_token');
const user2 = client2.user;

// Simulate device registration for both users with the same device token
setupTestMiddleware(app);
await request(app.server)
.post('/api/device-linking/register')
.set('Authorization', `Bearer ${user.token}`)
.send({ deviceToken: 'device1_token' })
.expect(200);

await request(app.server)
.post('/api/device-linking/register')
.set('Authorization', `Bearer ${user2.token}`)
.send({ deviceToken: 'device1_token' })
.expect(200);

// Simulate a session start for user on device1
await request(app.server)
.post('/api/session')
.set('Authorization', `Bearer ${user.token}`)
.send({ name: 'Session 1' })
.expect(200);

const state = getState(store);
expect(state.activeSessionId).toBe('Session 1');
expect(state.deviceTokensBySessionId['Session 1']).toEqual(['device1_token']);

// Simulate a session start for user2 on device1
await request(app.server)
.post('/api/session')
.set('Authorization', `Bearer ${user2.token}`)
.send({ name: 'Session 2' })
.expect(200);

const state2 = getState(user2Store);
expect(state2.activeSessionId).toBe('Session 2');
expect(state2.deviceTokensBySessionId['Session 2']).toEqual(['device1_token']);

// Simulate handoff from device1 to another device for user2 (e.g., user1 logs in on a new device)
await request(app.server)
.post('/api/session-handoff')
.set('Authorization', `Bearer ${user2.token}`)
.send({ sessionId: 'Session 2', deviceToken: 'device3_token' })
.expect(200);

const finalState = getState(store);
expect(finalState.activeSessionId).toBe('Session 1');
expect(finalState.deviceTokensBySessionId['Session 1']).toEqual(['device1_token']);

const finalState2 = getState(user2Store);
expect(finalState2.activeSessionId).toBeNull();
expect(finalState2.deviceTokensBySessionId).toEqual({});
});

it('should handle session deletion by client', async () => {
// Simulate device registration and session start for user on device1
setupTestMiddleware(app);
await request(app.server)
.post('/api/device-linking/register')
.set('Authorization', `Bearer ${user.token}`)
.send({ deviceToken: 'device1_token' })
.expect(200);

await request(app.server)
.post('/api/session')
.set('Authorization', `Bearer ${user.token}`)
.send({ name: 'Session 1' })
.expect(200);

const state = getState(store);
expect(state.activeSessionId).toBe('Session 1');
expect(state.deviceTokensBySessionId['Session 1']).toEqual(['device1_token']);

// Simulate deletion of the session by user on device1
await request(app.server)
.post('/api/session')
.set('Authorization', `Bearer ${user.token}`)
.send({ action: DeviceLinkingActions.DELETE_SESSION, sessionId: 'Session 1' })
.expect(200);

const finalState = getState(store);
expect(finalState.activeSessionId).toBeNull();
expect(finalState.deviceTokensBySessionId).toEqual({});
});

it('should handle session creation by client', async () => {
// Simulate device registration for user on device1
setupTestMiddleware(app);
await request(app.server)
.post('/api/device-linking/register')
.set('Authorization', `Bearer ${user.token}`)
.send({ deviceToken: 'device1_token' })
.expect(200);

const state = getState(store);
expect(state.activeSessionId).toBeNull();
expect(state.deviceTokensBySessionId).toEqual({});

// Simulate creation of a new session by user on device1
await request(app.server)
.post('/api/session')
.set('Authorization', `Bearer ${user.token}`)
.send({ name: 'Session 1' })
.expect(200);

const finalState = getState(store);
expect(finalState.activeSessionId).toBe('Session 1');
expect(finalState.deviceTokensBySessionId['Session 1']).toEqual(['device1_token']);
});
});
