import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import redisClient from './redis-client';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';
const REFRESH_TOKEN_EXPIRATION_TIME = 24 * 60 * 60; // 1 day in seconds
const ACCESS_TOKEN_EXPIRATION_TIME = 30 * 60; // 30 minutes in seconds

interface User {
id: string;
refreshToken?: string;
}

async function createUser(userId: string): Promise<User> {
const user: User = { id: userId };
await redisClient.set(`refreshToken:${user.id}`, '', 'EX', REFRESH_TOKEN_EXPIRATION_TIME);
return user;
}

async function linkDevices(userId: string, deviceId: string): Promise<void> {
const refreshToken = await redisClient.get(`refreshToken:${userId}`);
if (!refreshToken) throw new Error('No refresh token found');

await redisClient.hset(`devices:${userId}`, deviceId, JSON.stringify({ id: deviceId }));
}

function generateAccessToken(userId: string): string {
return jwt.sign({ userId }, SECRET_KEY, { expiresIn: ACCESS_TOKEN_EXPIRATION_TIME });
}

async function generateAndSetRefreshToken(userId: string): Promise<string> {
const newRefreshToken = uuidv4();
await redisClient.set(`refreshToken:${userId}`, newRefreshToken, 'EX', REFRESH_TOKEN_EXPIRATION_TIME);
return newRefreshToken;
}

async function verifyAndUpdateRefreshToken(userId: string, refreshToken: string): Promise<void> {
const currentRefreshToken = await redisClient.get(`refreshToken:${userId}`);
if (currentRefreshToken !== refreshToken) throw new Error('Invalid refresh token');

await generateAndSetRefreshToken(userId);
}

async function recoverIdentity(deviceId: string): Promise<User | null> {
const devices = await redisClient.hgetall(`devices:*`);
for (const [userId, deviceList] of Object.entries(devices)) {
const userDeviceIds = JSON.parse(deviceList);
if (userDeviceIds.includes(deviceId)) {
const user: User = { id: userId };
await verifyAndUpdateRefreshToken(userId, await redisClient.get(`refreshToken:${userId}`));
return user;
}
}
return null;
}

export default {
createUser,
linkDevices,
generateAccessToken,
recoverIdentity,
};
