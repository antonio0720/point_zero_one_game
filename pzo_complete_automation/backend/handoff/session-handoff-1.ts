import * as express from 'express';
import { Server } from 'ws';
import * as Redis from 'ioredis';
import _ from 'lodash';

const app = express();
const port = 3000;

// Redis client instance
const redis = new Redis({
host: 'localhost',
port: 6379,
});

// WebSocket server
const wss = new Server({ noServer: true });

let clients: Set<WebSocket> = new Set();

wss.on('connection', (ws) => {
// Add the client to our set
clients.add(ws);

// Send all current session data to the newly connected client
redis.get('sessions').then((sessionsStr) => {
const sessions = JSON.parse(sessionsStr || '[]');
ws.send(JSON.stringify({ event: 'init', data: sessions }));
});

ws.on('message', async (data) => {
const sessionData = JSON.parse(data);

switch (sessionData.event) {
case 'new':
redis.rpush('sessions', JSON.stringify(sessionData.data));
clients.forEach((client) => client.send(data));
break;

case 'update':
const index = _.findIndex(JSON.parse(await redis.lrange('sessions', 0, -1)), { id: sessionData.data.id });
if (index !== -1) {
await redis.lset('sessions', index, JSON.stringify(sessionData.data));
clients.forEach((client) => client.send(data));
}
break;

case 'delete':
const sessionsAfterDelete = _.filter(JSON.parse(await redis.lrange('sessions', 0, -1)), (session: any) => session.id !== sessionData.data.id);
await redis.ltrim('sessions', 0, sessionsAfterDelete.length - 1);
clients.forEach((client) => client.send(JSON.stringify({ event: 'update', data: { sessions: sessionsAfterDelete } })));
break;
}
});

ws.on('close', () => {
clients.delete(ws);
});
});

app.listen(port, () => console.log(`WebSocket server listening on port ${port}`));
