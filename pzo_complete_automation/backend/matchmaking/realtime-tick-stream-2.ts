import * as express from 'express';
import { Server } from 'socket.io';
import { createClient } from 'redis';

const app = express();
const server = app.listen(3000);
const io = new Server(server);

// Create a Redis client for session management.
const redisClient = createClient({ host: 'localhost', port: 6379 });
redisClient.on('error', (err) => {
console.error(`Error connecting to Redis: ${err}`);
});

// Store the session data in Redis under a key with the format `sessionId:userId`.
const setSessionData = (sessionId: string, userId: string, data: any) => {
redisClient.set(sessionId, JSON.stringify({ userId, data }));
};

// Get the session data for a given userId from Redis.
const getSessionData = async (userId: string): Promise<any> => {
const key = `session:${userId}`;
return new Promise((resolve) => {
redisClient.get(key, (err, reply) => {
if (err) throw err;
resolve(JSON.parse(reply || '{}'));
});
});
};

// Remove session data from Redis when a session ends or times out.
const deleteSessionData = (sessionId: string) => {
redisClient.del(sessionId);
};

io.on('connection', (socket) => {
// Handle user authentication and session creation.
socket.on('authenticate', async ({ userId, token }) => {
const sessionData = await getSessionData(userId);

if (!sessionData.token || sessionData.token !== token) {
return socket.emit('error', 'Invalid credentials');
}

// Set the new sessionId and send it back to the client.
const sessionId = generateSessionId();
setSessionData(sessionId, userId, { token });
socket. SessionId = sessionId;
socket.emit('authenticated', { sessionId });
});

// Handle tick data streaming.
socket.on('tick', (data) => {
io.to(socket.SessionId).emit('tick', data);
});

// Handle disconnecting and cleanup.
socket.on('disconnect', () => {
deleteSessionData(socket.SessionId || '');
});
});

// Generate a unique session ID for each new connection.
const generateSessionId = () => `session:${crypto.randomUUID()}`;
