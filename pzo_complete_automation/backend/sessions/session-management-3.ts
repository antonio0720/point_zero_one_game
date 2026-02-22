import express from 'express';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = require('http').createServer(app);
const io = new Server(server);

let activeSessions: Record<string, any> = {};

app.use(express.json());

io.on('connection', (socket) => {
console.log('a user connected');

socket.on('join-session', ({ sessionId }) => {
if (!activeSessions[sessionId]) {
return;
}

activeSessions[sessionId].sockets.push(socket);
socket.join(sessionId);

socket.on('message', (data) => {
io.to(sessionId).emit('message', data);
});
});

socket.on('disconnect', () => {
console.log('user disconnected');

for (const session in activeSessions) {
if (activeSessions[session].sockets.includes(socket)) {
activeSessions[session].sockets = activeSessions[session]
.sockets.filter((s: any) => s !== socket);
if (activeSessions[session].sockets.length === 0) {
delete activeSessions[session];
}
}
}
});
});

app.post('/create-session', (req, res) => {
const sessionId = uuidv4();
activeSessions[sessionId] = { sockets: [req.socket.id] };
res.json({ sessionId });
});

server.listen(3000, () => console.log('listening on *:3000'));
