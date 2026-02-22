import { createClient } from 'redis';
import { promisify } from 'util';

const redisClient = createClient();
const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);
const hsetAsync = promisify(redisClient.hset).bind(redisClient);
const hgetallAsync = promisify(redisClient.hgetall).bind(redisClient);
const hlenAsync = promisify(redisClient.hlen).bind(redisClient);

class SessionHandoff13 {
constructor(private clientId: string, private sessionKeyPrefix: string) {}

async startSession(sessionId: string): Promise<void> {
await this.createOrUpdateSession(sessionId, {});
}

async updateSession(sessionId: string, data: any): Promise<void> {
await this.createOrUpdateSession(sessionId, data);
}

private async createOrUpdateSession(sessionId: string, data: any): Promise<void> {
const sessionKey = this.getSessionKey(sessionId);
const clients = await this.getClients();

if (!clients[this.clientId]) {
await setAsync(sessionKey, JSON.stringify({ clientId, data }));
await hsetAsync(`${this.sessionKeyPrefix}:sessions`, sessionId, this.clientId);
clients[this.clientId] = true;
} else {
const currentSessionData = await getAsync(sessionKey);
if (!currentSessionData) {
await setAsync(sessionKey, JSON.stringify({ clientId, data }));
} else {
const mergedData = { ...JSON.parse(currentSessionData), ...data };
await setAsync(sessionKey, JSON.stringify(mergedData));
}
}

await this.saveClients(clients);
}

async getSession(sessionId: string): Promise<any> {
const sessionKey = this.getSessionKey(sessionId);
return getAsync(sessionKey);
}

private getSessionKey(sessionId: string): string {
return `session:${this.clientId}:${sessionId}`;
}

async endSession(sessionId: string): Promise<void> {
const sessionKey = this.getSessionKey(sessionId);
await delAsync(sessionKey);

const clients = await this.getClients();
delete clients[this.clientId];
await this.saveClients(clients);
}

private async getClients(): Promise<{ [key: string]: boolean }> {
return hgetallAsync(`${this.sessionKeyPrefix}:sessions`);
}

private async saveClients(clients: { [key: string]: boolean }): Promise<void> {
await hsetAsync(`${this.sessionKeyPrefix}:sessions`, {}, JSON.stringify(clients));
}
}

const sessionHandoff13 = new SessionHandoff13('my-client-id', 'my-session-prefix');

async function test() {
await sessionHandoff13.startSession('test-session');
const data = await sessionHandoff13.getSession('test-session');
console.log(data);

// Update the session
await sessionHandoff13.updateSession('test-session', { key: 'value' });
const updatedData = await sessionHandoff13.getSession('test-session');
console.log(updatedData);

// Another client connects and updates the same session
const anotherClient = new SessionHandoff13('another-client-id', 'my-session-prefix');
await anotherClient.updateSession('test-session', { anotherKey: 'anotherValue' });
const sharedData = await anotherClient.getSession('test-session');
console.log(sharedData);

// End the session
await sessionHandoff13.endSession('test-session');
}

test().catch((err) => console.error(err));
