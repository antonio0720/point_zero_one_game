import * as express from 'express';
import { Server, Socket } from 'socket.io';
import { Adapter } from '@socketio/redis';

const app = express();
const server = app.listen(3000);
const io = new Server(server, {
adapter: new Adapter({ host: 'localhost', port: 6379 }),
});

let activeUsers: Set<string> = new Set();
let userSessions: Map<string, Socket[]> = new Map();

io.on('connection', (socket: Socket) => {
socket.on('join', (username: string) => {
if (!activeUsers.has(username)) {
activeUsers.add(username);
userSessions.set(username, [socket]);
} else {
const currentSession = userSessions.get(username);
if (currentSession) {
currentSession.forEach((session: Socket) => session.emit('existingUser', username));
}
}
});

socket.on('message', (data: string) => {
const { receiver, message } = JSON.parse(data);
if (userSessions.has(receiver)) {
userSessions.get(receiver)?.forEach((session: Socket) => session.emit('newMessage', message));
}
});

socket.on('disconnect', () => {
const user = Array.from(activeUsers).find(([username]) => userSessions.get(username)?.includes(socket));
if (user) {
activeUsers.delete(user[0]);
const sessions = userSessions.get(user[0]);
sessions?.splice(sessions.indexOf(socket), 1);
if (!sessions.length) activeUsers.delete(user[0]);
}
});
});
