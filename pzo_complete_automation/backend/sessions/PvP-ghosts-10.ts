import { Server, Socket } from 'socket.io';
import * as express from 'express';

const app = express();
const server = app.listen(3000);
const io = new Server(server);

let playerIds: string[] = [];
let sessions: Map<number, Set<string>> = new Map();

io.on('connection', (socket: Socket) => {
socket.on('join', (playerId: string) => {
if (!playerIds.includes(playerId)) {
playerIds.push(playerId);
socket.emit('id', playerId);

let sessionId = Math.floor(Math.random() * 1000);
sessions.set(sessionId, new Set());
sessions.get(sessionId)?.add(playerId);

socket.join(sessionId.toString());
socket.broadcast.to(sessionId.toString()).emit('newPlayer', playerId);
}
});

socket.on('message', (message: string) => {
const [sessionId, targetPlayerId] = message.split('_');
if (sessions.has(parseInt(sessionId)) && playerIds.includes(targetPlayerId)) {
let opponents = sessions.get(sessionId) || new Set();
if (!opponents.has(socket.id)) {
opponents.add(socket.id);
io.to(socket.id).emit('opponent', targetPlayerId);
}
}
});

socket.on('disconnect', () => {
playerIds = playerIds.filter((id) => id !== socket.id);
sessions.forEach((session, sessionId) => {
if (session.has(socket.id)) {
session.delete(socket.id);
if (session.size === 1) {
let playerId = Array.from(session)[0];
io.to(playerId).emit('leave');
sessions.delete(sessionId);
}
}
});
});
});
