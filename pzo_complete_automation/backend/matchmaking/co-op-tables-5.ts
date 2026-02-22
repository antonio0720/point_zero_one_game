import * as express from 'express';
import { Server } from 'socket.io';
import http from 'http';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

interface Player {
id: string;
socketId: string;
}

let players: Player[] = [];
let gameSessions: any[] = [];

io.on('connection', (socket) => {
console.log(`User connected: ${socket.id}`);

// Player joining the lobby
socket.on('join', (playerId) => {
const player = { id: playerId, socketId: socket.id };
players.push(player);

// If there are enough players for a game session, create one and invite them
if (players.length === 2 || players.length === 4) {
const newSession = { players: [], id: Date.now() };
gameSessions.push(newSession);

// Invite players to join the session
for (const p of players) {
if (!newSession.players.includes(p)) {
newSession.players.push(p);
socket.join(newSession.id.toString());
socket.emit('sessionInvite', newSession);
}
}
}
});

// Player joining a game session
socket.on('joinSession', (sessionId) => {
const session = gameSessions.find((s) => s.id === parseInt(sessionId));
if (session) {
session.players.forEach((p) => {
io.to(p.socketId).emit('newPlayer', { playerId: socket.id });
});
}
});

// Player leaving the lobby or a game session
socket.on('leave', () => {
players = players.filter((player) => player.socketId !== socket.id);

for (let i = 0; i < gameSessions.length; ++i) {
const session = gameSessions[i];
if (session.players.includes({ id: socket.id })) {
session.players = session.players.filter((player) => player.socketId !== socket.id);

if (session.players.length === 0) {
gameSessions.splice(i, 1);
}
}
}
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
