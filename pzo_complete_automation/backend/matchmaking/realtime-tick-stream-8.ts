import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createClient, RedisClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let sessions: Record<string, any> = {};
const redisClient = createClient({
host: '127.0.0.1',
port: 6379,
});

redisClient.on('error', (err) => {
console.error(`Error connecting to Redis: ${err}`);
});

io.on('connection', (socket) => {
socket.on('join', ({ userId }) => {
// Store the socket in the session object for real-time communication
sessions[userId] = socket;

redisClient.hgetall(`session:${userId}`, (err, data) => {
if (err) {
console.error(err);
} else if (data) {
// Initialize the session with player data from Redis
const sessionData = JSON.parse(JSON.stringify(data));
socket.emit('initialize', sessionData);
} else {
// Generate a unique user ID if it doesn't exist yet
const newUserId = uuidv4();
redisClient.hset(`session:${newUserId}`, 'userData', JSON.stringify({}), 'ex', 3600);
socket.emit('initialize', { userId: newUserId });
}
});
});

socket.on('send-tick', ({ tick }) => {
// Broadcast the tick to all connected users except the sender
for (const [userId, client] of Object.entries(sessions)) {
if (socket !== client) {
client.emit('receive-tick', tick);
}
}
});

socket.on('disconnect', () => {
// Remove the disconnected socket from the sessions object
for (const userId in sessions) {
if (sessions[userId] === socket) {
delete sessions[userId];
}
}

redisClient.hdel(`session:${socket.handshake.query.userId}`, '*');
});
});

server.listen(3000, () => console.log('Server is running on port 3000'));
