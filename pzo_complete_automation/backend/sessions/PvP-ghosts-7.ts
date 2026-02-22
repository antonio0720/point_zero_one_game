import * as express from 'express';
import { Server, Socket } from 'socket.io';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const io = new Server(server);

interface Player {
id: string;
socketId: string;
}

let players: Player[] = [];
let sessions: Record<string, Player[]> = {};

io.on('connection', (socket: Socket) => {
console.log(`New connection ${socket.id}`);

// Handle player joining
socket.on('join', ({ username }) => {
const player: Player = { id: username, socketId: socket.id };
players.push(player);
broadcast('playersUpdated', players);
});

// Matchmaking
setInterval(() => {
if (players.length >= 2) {
const sessionId = generateSessionId();
const player1 = players.shift()!;
const player2 = players.pop()!;

sessions[sessionId] = [player1, player2];

player1.socket.emit('match', sessionId);
player2.socket.emit('match', sessionId);
}
}, 500);

// Handle session creation and destruction
socket.on('disconnect', () => {
players = players.filter((player) => player.socketId !== socket.id);
broadcast('playersUpdated', players);

for (const session of Object.values(sessions)) {
if (session.includes(players[0])) {
const sessionId = Object.keys(sessions).find((key) => sessions[key] === session);
delete sessions[sessionId];
broadcast('matchDestroyed', sessionId);
}
}
});
});

function broadcast(event: string, data?: any) {
io.sockets.emit(event, data);
}

function generateSessionId(): string {
return crypto.randomUUID();
}

server.listen(3000, () => {
console.log('Server listening on port 3000');
});
