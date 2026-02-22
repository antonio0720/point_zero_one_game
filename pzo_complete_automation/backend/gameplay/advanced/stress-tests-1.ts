import * as express from 'express';
import { Server } from 'socket.io';

const app = express();
const server = require('http').createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

interface Player {
id: string;
x: number;
y: number;
}

let players: Player[] = [];

io.on('connection', (socket) => {
console.log('A user connected');

socket.on('join', ({ name }) => {
const player: Player = { id: socket.id, x: 0, y: 0 };
players.push(player);
socket.emit('welcome', { name });
});

socket.on('move', ({ x, y }) => {
const index = players.findIndex((player) => player.id === socket.id);
if (index !== -1) {
players[index].x = x;
players[index].y = y;
io.emit('update', players);
}
});
});

server.listen(3000, () => console.log('Listening on port 3000'));
