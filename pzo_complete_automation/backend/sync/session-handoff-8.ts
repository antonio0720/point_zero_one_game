import * as express from 'express';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = app.listen(3000);
const io = new Server(server);

interface SessionData {
id: string;
participants: Set<string>;
history: Message[][];
}

type Client = {
socket: SocketIOClient.Socket;
sessionId?: string;
handoffTarget?: string | null;
};

const sessions: Record<string, SessionData> = {};
const clients: Record<string, Client> = {};

io.on('connection', (socket) => {
const client: Client = { socket };
clients[socket.id] = client;

socket.on('joinSession', ({ sessionId }) => {
if (!sessionId || sessions[sessionId]) {
// Create new session or join an existing one
const sessionData: SessionData = sessions[sessionId] ?? {
id: sessionId || uuidv4(),
participants: new Set([socket.id]),
history: [],
};
sessions[sessionId] = sessionData;
client.sessionId = sessionId;
}

// Send current session data to the client
socket.emit('initSession', sessions[client.sessionId]);

// Update all connected clients about new participants in the session
for (const otherClient of Object.values(clients).filter((c) => c.sessionId === sessionData.id)) {
otherClient.socket.emit('updateParticipants', Array.from(sessionData.participants));
}
});

socket.on('leaveSession', () => {
if (!client.sessionId) return;

const sessionData = sessions[client.sessionId];
const handoffTarget = findNextClientInSession(client, sessionData);

if (handoffTarget) {
// Hand off data to the next client in the same session
const historyDiff = sessionData.history.splice(0, sessionData.history.length - sessionData.history[sessionData.history.length - 1].length);
clients[handoffTarget].socket.emit('receiveHistory', historyDiff);
}

// Remove the disconnected client from the session and all clients' lists
delete clients[client.sessionId];
delete clients[client.id];
sessionData.participants.delete(client.id);
if (sessionData.participants.size === 0) {
delete sessions[client.sessionId];
}

// Update all connected clients about the changes in the session participants
for (const otherClient of Object.values(clients)) {
otherClient.socket.emit('updateParticipants', Array.from(sessions[otherClient.sessionId]?.participants ?? []));
}
});

socket.on('sendMessage', ({ content }) => {
if (!client.sessionId) return;

const sessionData = sessions[client.sessionId];
sessionData.history.push([new Date(), client.id, content]);

// Send the message to all clients in the same session
for (const otherClient of Object.values(clients).filter((c) => c.sessionId === sessionData.id)) {
otherClient.socket.emit('receiveMessage', { sender: client.id, content });
}
});

socket.on('disconnect', () => {
if (client.sessionId) leaveSession(client);
});
});

function findNextClientInSession(leavingClient: Client, sessionData: SessionData): string | null {
return Array.from(sessionData.participants).find((id) => id !== leavingClient.id) ?? null;
}

function leaveSession(client: Client) {
if (!client.sessionId) return;

const sessionData = sessions[client.sessionId];
const handoffTarget = findNextClientInSession(client, sessionData);

if (handoffTarget) {
// Hand off data to the next client in the same session
const historyDiff = sessionData.history.splice(0, sessionData.history.length - sessionData.history[sessionData.history.length - 1].length);
clients[handoffTarget].socket.emit('receiveHistory', historyDiff);
}
}
