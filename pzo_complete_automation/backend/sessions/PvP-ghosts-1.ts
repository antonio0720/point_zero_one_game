const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.json());

let players = {};
let gameSessions = {};

// Routing for joining and leaving a game session
app.post('/join', (req, res) => {
const playerId = req.body.playerId;
if (!players[playerId]) {
players[playerId] = true;
res.json({ status: 'success' });
} else {
res.json({ status: 'error', message: 'Player already in game' });
}
});

app.post('/leave', (req, res) => {
const playerId = req.body.playerId;
if (players[playerId]) {
delete players[playerId];
if (Object.keys(gameSessions).length === 0 && Object.getOwnPropertyNames(gameSessions).length === 0) {
io.of('/').emit('clearGames');
}
res.json({ status: 'success' });
} else {
res.json({ status: 'error', message: 'Player not in game' });
}
});

// Routing for creating and joining games
app.post('/createGame', (req, res) => {
const playerId = req.body.playerId;
if (!players[playerId]) {
res.json({ status: 'error', message: 'Player not found' });
return;
}

if (!gameSessions[`session_${Date.now()}`]) {
gameSessions[`session_${Date.now()}`] = [playerId];
io.of('/').emit('newGame', `session_${Date.now()}`);
res.json({ status: 'success', gameSessionId: `session_${Date.now()}` });
} else {
const existingGame = Object.keys(gameSessions).find((key) => gameSessions[key].includes(playerId));
if (existingGame) {
gameSessions[existingGame].push(playerId);
res.json({ status: 'success', gameSessionId: existingGame });
} else {
gameSessions[`session_${Date.now()}`] = [playerId];
io.of('/').emit('newGame', `session_${Date.now()}`);
res.json({ status: 'success', gameSessionId: `session_${Date.now()}` });
}
}
});

app.post('/joinGame', (req, res) => {
const playerId = req.body.playerId;
const gameSessionId = req.body.gameSessionId;

if (!players[playerId]) {
res.json({ status: 'error', message: 'Player not found' });
return;
}

if (gameSessions[gameSessionId] && !gameSessions[gameSessionId].includes(playerId)) {
gameSessions[gameSessionId].push(playerId);
io.of('/').emit('playerJoin', { playerId, gameSessionId });
res.json({ status: 'success' });
} else {
res.json({ status: 'error', message: 'Invalid game session or player already in game' });
}
});

// Socket.io events for PvP-ghosts-1 game logic
io.on('connection', (socket) => {
socket.on('disconnect', () => {
const playerId = socket.handshake.query.playerId;
delete players[playerId];
});

socket.on('joinGame', (gameSessionData) => {
const { gameSessionId, opponentPlayerId } = gameSessionData;

socket.join(gameSessionId);

socket.to(`${gameSessionId}`).emit('opponentJoin', { opponentPlayerId });
});

socket.on('move', (data) => {
const { x, y } = data;
const gameSessionId = socket.id.split('-')[1];

socket.to(`${gameSessionId}`).emit('opponentMove', { x, y });
});
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
