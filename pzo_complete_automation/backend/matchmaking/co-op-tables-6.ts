import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Data structures
interface Player {
id: string;
name: string;
roomId?: string;
}

interface Room {
id: string;
players: Player[];
gameState?: any; // Customize to fit your game's state
}

let rooms: Room[] = [];
let players: Player[] = [];

io.on('connection', (socket) => {
socket.on('join', ({ name }) => {
const player: Player = { id: socket.id, name };
players.push(player);

socket.broadcast.emit('playerJoin', { player });

// Try to match the player with an existing room or create a new one
const findRoom = () => {
for (const room of rooms) {
if (room.players.length < 4) { // Adjust this number according to your game's needs
room.players.push(player);
socket.join(room.id);
socket.emit('joinRoom', room);
return;
}
}

const newRoom: Room = { id: crypto.randomUUID(), players: [player] };
rooms.push(newRoom);
};

findRoom();
});

socket.on('disconnect', () => {
const playerIndex = players.findIndex((p) => p.id === socket.id);
if (playerIndex !== -1) {
const roomId = players[playerIndex].roomId;
if (roomId) {
const room = rooms.find((r) => r.id === roomId);
if (room && room.players.length > 1) {
room.players = room.players.filter((p) => p.id !== socket.id);
io.to(roomId).emit('playerLeave', players.find((p) => p.id === socket.id));
}
}
players = players.filter((p) => p.id !== socket.id);
}
});
});

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
