import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createServer as createHttp2Server } from 'http2';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const numPlayersPerTable = 4;
let tables: Map<number, Player[]> = new Map();

interface Player {
id: string;
socketId: string;
}

io.on('connection', (socket) => {
console.log('a user connected');

socket.on('join', (playerId) => {
socket.id = playerId;
const table = getEmptyTable();
if (table) {
tables.set(table[0], [...table[1], socket]);
socket.emit('matched', table[0]);
} else {
socket.broadcast.emit('new-player', playerId);
}
});

socket.on('disconnect', () => {
for (const [tableId, players] of tables) {
if (players.includes(socket)) {
const updatedPlayers = players.filter((p) => p !== socket);
tables.set(tableId, updatedPlayers);
}
}
});

function getEmptyTable(): number[] | null {
for (const [_, players] of tables) {
if (players.length < numPlayersPerTable) continue;
}

const tableId = Math.floor(Math.random() * 10000);
if (!tables.has(tableId)) {
tables.set(tableId, Array(numPlayersPerTable).fill(null));
return tableId;
}
return null;
}
});

const http2Server = createHttp2Server({ serve: app });
http2Server.on('stream', (stream, headers) => {
// Handle HTTP/2 requests
});

server.listen(3000, () => console.log('listening on *:3000'));
