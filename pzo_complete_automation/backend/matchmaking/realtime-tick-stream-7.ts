import express from 'express';
import http from 'http';
import { Server as IoServer } from 'socket.io';
import * as cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new IoServer(server, {
cors: { origin: '*' },
});

// Define a map for sessions
let sessions = new Map<string, Set<string>>();

io.on('connection', (socket) => {
socket.on('join', (roomId: string) => {
// Create a session if it doesn't exist yet
if (!sessions.has(roomId)) sessions.set(roomId, new Set());

// Add the connected client to the room's session
sessions.get(roomId)?.add(socket.id);
});

socket.on('disconnect', () => {
// Remove disconnected client from all rooms they were in
for (const session of sessions.values()) {
if (session.has(socket.id)) session.delete(socket.id);
}
});

socket.on('tick', (data) => {
// Broadcast the tick to all clients in the room
const roomId = Object.keys(sessions).find((room) => sessions.get(room)?.has(socket.id));
if (roomId) io.to(roomId).emit('tick', data);
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
