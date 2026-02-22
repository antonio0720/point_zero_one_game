import express from 'express';
import { Server } from 'socket.io';

const app = express();
const server = require('http').Server(app);
const io = new Server(server);

interface Player {
id: string;
socketId: string;
}

let players: Player[] = [];

io.on('connection', (socket) => {
const player: Player = {
id: socket.handshake.query.playerId,
socketId: socket.id,
};

players.push(player);

socket.on('disconnect', () => {
players = players.filter((p) => p.socketId !== player.socketId);
});

// Matchmaking logic here (e.g., finding an opponent for a player)

socket.join(player.id);

socket.on('message', (data: any) => {
io.to(`${player.id}`).emit('message', data);
});
});

app.use(express.json());
app.post('/new-session', (req, res) => {
const newPlayerId = generateUniqueID(); // Use a function to generate unique IDs for players
res.send({ playerId: newPlayerId });
});

function generateUniqueID(): string {
return `player_${Math.random().toString(36).substring(7)}`;
}

server.listen(3000, () => {
console.log('Server running on port 3000');
});
