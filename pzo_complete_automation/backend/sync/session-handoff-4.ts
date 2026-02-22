import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import WebSocket = require('ws');

interface ClientData {
id: string;
ws: WebSocket;
}

const clients: Map<string, ClientData> = new Map();
const sessions: Map<string, Set<string>> = new Map();

createServer((req, res) => {
res.writeHead(200);
res.end('Welcome to the Multi-client Sync and Handoff Server');
}).listen(3000, () => console.log('Server listening on port 3000'));

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
const clientId = uuidv4();
clients.set(clientId, { id: clientId, ws });

ws.on('message', (data) => {
const sessionId = JSON.parse(data).sessionId;
sessions.has(sessionId)
? sessions.get(sessionId).add(clientId)
: sessions.set(sessionId, new Set([clientId]));

const joinedMessage = `Client [${clientId}] joined session [${sessionId}]`;
broadcast({ type: 'join', data: joinedMessage }, clientId);

for (const client of sessions.get(sessionId)) {
if (client !== clientId) {
clients.get(client)!.ws.send(JSON.stringify({ type: 'sync', data: data }));
}
}
});

ws.on('close', () => {
clients.delete(clientId);

const leftMessage = `Client [${clientId}] left session [${sessionId || '-'}]`;
broadcast({ type: 'leave', data: leftMessage }, clientId);

sessions.forEach((clients, session) => {
if (clients.has(clientId)) clients.delete(clientId);
if (clients.size === 0) sessions.delete(session);
});
});
});

function broadcast(message: any, sender?: string) {
for (const client of clients.values()) {
if (sender !== client.id || message.type !== 'sync') {
client.ws.send(JSON.stringify(message));
}
}
}
