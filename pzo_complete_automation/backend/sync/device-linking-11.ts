import redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const redisClient = new redis({});

interface SessionData {
clientId: string;
deviceId: string;
lastConnectedAt: number;
}

function createSession(clientId: string): Promise<string> {
const sessionId = uuidv4();
return redisClient.hset('sessions', sessionId, { clientId, deviceId: '', lastConnectedAt: Date.now() }).then(() => sessionId);
}

function getSession(sessionId: string): Promise<SessionData | null> {
return redisClient.hgetall(sessionId).then((data) => {
if (data) {
const sessionData = JSON.parse(JSON.stringify(data)) as SessionData;
return sessionData;
}
return null;
});
}

function updateSession(sessionId: string, deviceId?: string): Promise<void> {
return redisClient.hset('sessions', sessionId, { deviceId: deviceId || '', lastConnectedAt: Date.now() }).then(() => {});
}

function transferSession(sourceSessionId: string, targetSessionId: string): Promise<void> {
return redisClient.hgetall(sourceSessionId).then((data) => {
const sessionData = JSON.parse(JSON.stringify(data)) as SessionData;
return redisClient.hset('sessions', targetSessionId, sessionData).then(() => {
return redisClient.del(sourceSessionId);
});
});
}
