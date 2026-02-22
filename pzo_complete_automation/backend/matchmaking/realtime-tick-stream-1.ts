import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface SessionData {
id: string;
players: string[];
}

class Matchmaking {
private io: Server;
private sessions: Map<string, SessionData> = new Map();

constructor(socketIoServer) {
this.io = new Server(socketIoServer);

this.io.on('connection', (socket) => {
socket.on('join-match', (playerName) => {
const sessionId = uuidv4();
this.sessions.set(sessionId, { id: sessionId, players: [playerName] });
socket.join(sessionId);

this.io.to(sessionId).emit('new-session', { sessionId });
});

socket.on('join-session', (sessionId) => {
const session = this.sessions.get(sessionId);
if (!session) return;

session.players.push(socket.id);
this.broadcastTickStream(sessionId, 'player-joined', { playerName: socket.id });
});

socket.on('disconnect', () => {
for (const [sessionId, sessionData] of this.sessions) {
const playerIndex = sessionData.players.indexOf(socket.id);
if (playerIndex !== -1) {
sessionData.players.splice(playerIndex, 1);
this.broadcastTickStream(sessionId, 'player-left', { playerName: socket.id });
}
}
});

socket.on('send-tick', (data) => {
for (const [sessionId, sessionData] of this.sessions.values()) {
if (!sessionData.players.includes(socket.id)) continue;

const eventName = `send-tick-${sessionId}`;
socket.broadcast.to(sessionId).emit(eventName, data);
}
});
});
}

private broadcastTickStream(sessionId: string, eventName: string, data: any) {
this.io.to(sessionId).emit(eventName, data);
}
}

// Usage:
const matchmaking = new Matchmaking(server);
