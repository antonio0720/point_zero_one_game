import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const redisClient = createClient();

interface User {
id: string;
username: string;
warnings: number;
ban: boolean;
}

function getUser(userId: string): Promise<User | null> {
return new Promise((resolve) => {
redisClient.hgetall(userId, (err, userData) => {
if (err) throw err;

const user = JSON.parse(userData);
resolve(user || null);
});
});
}

function setUser(userId: string, user: User): Promise<void> {
return new Promise((resolve) => {
redisClient.hmset(userId, JSON.stringify(user), (err) => {
if (err) throw err;
resolve();
});
});
}

function incrementWarnings(userId: string): Promise<void> {
return new Promise((resolve) => {
redisClient.hincrby(userId, 'warnings', 1, (err) => {
if (err) throw err;
resolve();
});
});
}

function banUser(userId: string): Promise<void> {
return new Promise((resolve) => {
redisClient.hset(userId, 'ban', true, (err) => {
if (err) throw err;
resolve();
});
});
}

function unbanUser(userId: string): Promise<void> {
return new Promise((resolve) => {
redisClient.hdel(userId, 'ban', (err) => {
if (err) throw err;
resolve();
});
});
}

function createUser(username: string): Promise<string> {
const userId = uuidv4();
return setUser(userId, { id: userId, username, warnings: 0, ban: false }).then(() => userId);
}

function isBanned(userId: string): Promise<boolean> {
return getUser(userId).then((user) => user?.ban || false);
}

function warnUser(userId: string): Promise<void> {
if (isBanned(userId)) throw new Error('Cannot warn a banned user');

return incrementWarnings(userId);
}
