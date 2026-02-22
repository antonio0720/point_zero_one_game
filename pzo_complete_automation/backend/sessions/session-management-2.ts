import express from 'express';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = require('http').Server(app);
const io = new Server(server);

let sessions: any[] = [];

// For matchmaking, we'll use a simple queue approach.
let queue: string[] = [];

io.on('connection', (socket) => {
socket.on('join-session', ({ userId }) => {
// If user is not in the session list, add them to the queue for matchmaking.
if (!sessions.some((session) => session.includes(userId))) {
queue.push(userId);
}

// Find a matching session for the user.
const findMatch = () => {
const potentialMatch = queue.find((id) => id !== userId && sessions.every((session) => !session.includes(id)));

if (potentialMatch) {
const newSession: string[] = [userId, potentialMatch];
sessions.push(newSession);
socket.join(uuidv4()); // Join the private room for this session
io.to(potentialMatch).emit('match', newSession);
queue = queue.filter((id) => id !== potentialMatch);
} else if (queue.length > 0) {
setTimeout(findMatch, 1000); // Keep searching for a match every second
}
};

findMatch();
});

socket.on('disconnect', () => {
sessions = sessions.filter((session) => !session.includes(socket.id));
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
