import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

interface Player {
id: string;
socketId: string;
name: string;
}

interface Room {
id: string;
players: Player[];
maxPlayers: number;
gameState?: any; // Replace this with the actual game state data structure
}

const io = new Server();
let rooms: Record<string, Room> = {};

io.on('connection', (socket: Socket) => {
socket.on('join', ({ name }) => {
const player: Player = { id: uuidv4(), socketId: socket.id, name };
if (!rooms['lobby']) rooms['lobby'] = { id: 'lobby', players: [player], maxPlayers: 10, gameState: null };
else {
for (const roomId in rooms) {
const room = rooms[roomId];
if (room.players.length < room.maxPlayers) {
room.players.push(player);
socket.join(roomId);
socket.emit('room-joined', room);
io.to(roomId).emit('player-joined', player);
break;
}
}
}
});

socket.on('start-game', (roomId) => {
const room = rooms[roomId];
if (!room || room.gameState) return; // Prevent starting multiple games at the same time

room.gameState = generateInitialGameState(); // Replace this with the actual game state generation logic
io.to(roomId).emit('game-started', room.gameState);
});

socket.on('disconnect', () => {
for (const roomId in rooms) {
const room = rooms[roomId];
if (room && room.players.some((player) => player.socketId === socket.id)) {
room.players = room.players.filter((player) => player.socketId !== socket.id);
if (room.players.length === 1) {
const remainingPlayer = room.players[0];
delete rooms['lobby']; // Move the last player in lobby to a new game, if any
if (!rooms[remainingPlayer.id]) createNewRoomForPlayer(remainingPlayer);
else movePlayerToExistingRoom(remainingPlayer, roomId);
}
}
}
});

function createNewRoomForPlayer(player: Player) {
if (rooms['lobby'] && rooms['lobby'].players.length > 1) {
const newRoomId = uuidv4();
rooms[newRoomId] = { id: newRoomId, players: [player], maxPlayers: 2 }; // Assuming a 2-player game for simplicity
player.socket.join(newRoomId);
player.socket.emit('room-joined', rooms[newRoomId]);
} else if (rooms['lobby']) {
const lobbyPlayer = rooms['lobby'].players[0];
delete rooms['lobby']; // Create a new room for the first player from the lobby and remove the lobby
rooms[uuidv4()] = { id: uuidv4(), players: [player, lobbyPlayer], maxPlayers: 2 };
player.socket.join(rooms[uuidv4()].id);
player.socket.emit('room-joined', rooms[uuidv4()]);
} else {
// Handle the case when there are no players in the lobby
}
}

function movePlayerToExistingRoom(player: Player, currentRoomId: string) {
const newRoomId = uuidv4();
rooms[newRoomId] = { id: newRoomId, players: [player], maxPlayers: Infinity }; // Assuming a room for multiple players in this example
player.socket.join(newRoomId);
player.socket.emit('room-joined', rooms[newRoomId]);

const currentRoom = rooms[currentRoomId];
if (currentRoom) {
delete rooms[currentRoomId]; // Move the player to a new room and remove them from the current one
rooms[newRoomId].players.push(currentRoom.players.pop()!);
io.to(currentRoomId).emit('player-left', currentRoom.players.pop()!);
}
}
});
