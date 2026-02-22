import { v4 as uuidv4 } from 'uuid';
import client from './redisClient'; // Assuming Redis is used for session storage

interface SessionData {
userId: string;
deviceId: string;
expiresAt: number; // Unix timestamp
}

const createSession = async (userId: string): Promise<string> => {
const deviceId = uuidv4();
const sessionData: SessionData = { userId, deviceId, expiresAt: Date.now() + (60 * 60 * 24) }; // Session expires after 1 day
await client.set(deviceId, JSON.stringify(sessionData));
return deviceId;
};

const getSessionData = async (deviceId: string): Promise<SessionData | null> => {
const sessionJson = await client.get(deviceId);
if (!sessionJson) return null;
return JSON.parse(sessionJson);
};

const updateSessionExpiration = async (deviceId: string, newExpiresAt: number): Promise<void> => {
const sessionData = await getSessionData(deviceId);
if (!sessionData) throw new Error('Session not found');
sessionData.expiresAt = newExpiresAt;
await client.set(deviceId, JSON.stringify(sessionData));
};

const recoverSession = async (userId: string): Promise<string | null> => {
const deviceIds = await client.keys(`*`); // Assuming you have a pagination mechanism for large results
for (let deviceId of deviceIds) {
const sessionData = await getSessionData(deviceId);
if (!sessionData || sessionData.userId !== userId) continue;
return deviceId;
}
return null;
};
