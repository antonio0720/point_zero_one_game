import * as express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const io = new Server(server);

interface Player {
id: string;
x: number;
y: number;
}

let players: Player[] = [];

io.on('connection', (socket) => {
socket.emit('connect');

// Send all current players when a new client connects
socket.emit('playersUpdate', players);

// Listen for updates from clients
socket.on('playerMove', ({ id, x, y }) => {
const playerIndex = players.findIndex((p) => p.id === id);

if (playerIndex !== -1) {
players[playerIndex] = { ...players[playerIndex], x, y };
socket.broadcast.emit('playersUpdate', players);
}
});

// Handle client disconnection
socket.on('disconnect', () => {
const playerToRemove = players.find((p) => p.id === socket.id);

if (playerToRemove) {
players = players.filter((p) => p.id !== socket.id);
io.emit('playersUpdate', players);
}
});
});

server.listen(3000, () => console.log(`Gameplay server listening on port 3000`));
