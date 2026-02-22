import * as express from 'express';
import * as http from 'http';
import * as socketIO from 'socket.io';
import * as redis from 'ioredis';

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const redisClient = new redis();

io.on('connection', (socket) => {
console.log('A user connected');

socket.on('joinSession', async ({ sessionId }) => {
const exists = await redisClient.exists(sessionId);

if (!exists) {
return socket.emit('error', 'Session not found');
}

socket.join(sessionId);
socket.broadcast.to(sessionId).emit('userJoined', socket.id);
});

socket.on('disconnect', () => {
console.log('User disconnected');
});
});

server.listen(3000, () => {
console.log('Server is running on port 3000');
});
