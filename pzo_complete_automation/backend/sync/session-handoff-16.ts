import * as express from 'express';
import * as WebSocket from 'ws';
import * as redis from 'redis';

const app = express();
const port = process.env.PORT || 3000;
const clients = new Set<WebSocket>();
const clientSessions = new Map<string, string>();
const redisClient = redis.createClient();

app.use(express.static(__dirname));

const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', (ws) => {
clients.add(ws);

ws.on('message', async (data) => {
const jsonData: any = JSON.parse(data.toString());

if (jsonData.event === 'join') {
await joinSession(ws, jsonData.sessionId);
} else if (jsonData.event === 'sendMessage') {
const sessionMessages = clientSessions.get(jsonData.sessionId) || [];
sessionMessages.push(jsonData.message);
await saveSessionMessages(jsonData.sessionId, sessionMessages);
for (const client of clients) {
if (client !== ws && client.readyState === WebSocket.OPEN) {
client.send(JSON.stringify({ event: 'newMessage', sessionId, message: jsonData.message }));
}
}
}
});

ws.on('close', () => clients.delete(ws));
});

app.listen(port, () => console.log(`Server running on port ${port}`));

async function joinSession(client: WebSocket, sessionId: string) {
const currentSession = clientSessions.get(sessionId);

if (!currentSession) {
const messages = await loadSessionMessages(sessionId);
clientSessions.set(sessionId, JSON.stringify(messages));
for (const message of messages) {
client.send(JSON.stringify({ event: 'newMessage', sessionId, message }));
}
} else {
clientSessions.forEach((value, key) => {
if (key !== sessionId) {
clients.forEach((client) => {
if (client !== clientSockets[0] && client.readyState === WebSocket.OPEN) {
client.send(JSON.stringify({ event: 'newMessage', sessionId, message: value }));
}
});
}
});
}
}

async function saveSessionMessages(sessionId: string, messages: any[]) {
clientSessions.set(sessionId, JSON.stringify(messages));
redisClient.set(sessionId, JSON.stringify(messages), (err) => {
if (err) console.error('Error saving session', err);
});
}

async function loadSessionMessages(sessionId: string): Promise<any[]> {
const storedSession = await new Promise<string>((resolve, reject) => {
redisClient.get(sessionId, (err, result) => {
if (err) return reject(err);
resolve(result || '[]');
});
});

return JSON.parse(storedSession);
}
