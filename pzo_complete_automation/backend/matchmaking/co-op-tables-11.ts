import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

interface Player {
id: string;
socketId: string;
}

interface Room {
id: string;
maxPlayers: number;
currentPlayers: Player[];
playersInQueue: Player[];
}

let rooms: { [key: string]: Room } = {};

io.on('connection', (socket) => {
socket.on('joinRoom', ({ roomId }) => {
const room = rooms[roomId] || createRoom(roomId);
joinRoom(socket, room);
updateRoom(room);
});

socket.on('disconnect', () => {
leaveRoom(socket);
updateRoom(getRoomBySocket(socket));
});
});

function createRoom(id: string): Room {
return { id, maxPlayers: 4, currentPlayers: [], playersInQueue: [] };
}

function joinRoom(socket: Socket, room: Room) {
if (room.currentPlayers.length < room.maxPlayers && !room.playersInQueue.some((p) => p.socketId === socket.id)) {
const player: Player = { id: socket.id, socketId: socket.id };
room.currentPlayers.push(player);
socket.join(room.id);
} else if (room.playersInQueue.length > 0) {
const player: Player = room.playersInQueue.shift();
joinRoom(socket, rooms[player.id]);
}
}

function leaveRoom(socket: Socket) {
const currentRoom = getRoomBySocket(socket);
if (currentRoom) {
const playerIndex = currentRoom.currentPlayers.findIndex((p) => p.socketId === socket.id);
if (playerIndex !== -1) currentRoom.currentPlayers.splice(playerIndex, 1);

if (currentRoom.playersInQueue.length < currentRoom.maxPlayers && currentRoom.currentPlayers.length > 0) {
const player = currentRoom.currentPlayers[0];
currentRoom.playersInQueue.push(player);
leaveRoom(socketForPlayer(player));
} else if (currentRoom.playersInQueue.length === 0) {
delete rooms[currentRoom.id];
}
}
}

function getRoomBySocket(socket: Socket): Room | undefined {
return Object.values(rooms).find((room) => room.currentPlayers.some((p) => p.socketId === socket.id));
}

function socketForPlayer(player: Player): Socket {
const sockets = io.sockets.sockets;
return sockets.find((s: any) => s.handshake.query.roomId === player.id && s.id === player.socketId);
}

function updateRoom(room: Room) {
rooms[room.id] = room;
io.to(room.id).emit('roomState', { players: room.currentPlayers, queue: room.playersInQueue });
}

app.use(express.static('public'));
server.listen(3000);
