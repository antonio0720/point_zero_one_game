import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/adapter-redis';
import redis from 'ioredis';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
cors: {
origin: '*',
},
});

// Create Redis adapter instance
const redisClient = new redbis();
const adapter = createAdapter(redisClient);
io.adapter(adapter);

// Set up Socket.io on connection and disconnection events
io.on('connection', (socket) => {
console.log(`User connected: ${socket.id}`);

// Handle tick updates for the user
socket.on('joinRoom', ({ room }) => {
socket.join(room);
console.log(`User ${socket.id} joined room ${room}`);

socket.on('tickUpdate', (data) => {
io.to(room).emit('tickUpdate', data);
});
});
});

io.listen(3001, () => console.log('Listening on port 3001'));
