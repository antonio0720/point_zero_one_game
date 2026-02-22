import * as express from 'express';
import * as http from 'http';
import * as io from 'socket.io';
import * as redis from 'ioredis';

const app = express();
const server = http.createServer(app);
const ioServer = io(server);
const redisClient = new redis({ port: 6379 });

// Game structure
interface Game {
id: string;
players: string[];
masterSocket?: SocketIO.Socket;
}

let games: Game[] = [];

ioServer.on('connection', (socket) => {
socket.on('join', async () => {
const playerId = socket.id;
const availableGames = await getAvailableGames();

if (availableGames.length > 0) {
const chosenGameIndex = availableGames[0].players.length % 4;
const chosenGame = availableGames[chosenGameIndex];
joinGame(socket, chosenGame, playerId);
} else {
createNewGame(socket, playerId);
}
});

socket.on('disconnect', () => {
for (const game of games) {
if (game.players.includes(socket.id)) {
leaveGame(socket, game, findReplacementIfNeeded(game));
}
}
});
});

function getAvailableGames(): Game[] {
return games.filter((game) => game.players.length < 4);
}

async function joinGame(socket: SocketIO.Socket, game: Game, playerId: string) {
if (!game.masterSocket) {
game.masterSocket = socket;
startGame(game);
}

game.players.push(playerId);
socket.join(game.id);
socket.emit('game-joined', game.id);

updateGameState(game);
}

function findReplacementIfNeeded(game: Game): string | null {
const availablePlayers = getAvailablePlayers();

if (availablePlayers.length > 0) {
return availablePlayers[0];
} else {
return null;
}
}

function createNewGame(socket: SocketIO.Socket, playerId: string) {
const gameId = generateGameId();
games.push({ id: gameId, players: [playerId] });
updateGameState(games[games.length - 1]);

socket.join(gameId);
socket.emit('game-created', gameId);
}

function leaveGame(socket: SocketIO.Socket, game: Game, replacementPlayer?: string) {
const gameIndex = games.findIndex((g) => g.id === game.id);
if (gameIndex !== -1) {
games[gameIndex].players = games[gameIndex].players.filter((p) => p !== socket.id);

if (replacementPlayer) {
games[gameIndex].players.push(replacementPlayer);
}

updateGameState(games[gameIndex]);
}
}

function startGame(game: Game) {
game.masterSocket?.emit('game-started', game.id);
}

function updateGameState(game: Game) {
redisClient.setex(`game:${game.id}`, 60, JSON.stringify(game));
}

function getAvailablePlayers(): string[] {
return games.flatMap((g) => g.players).filter((p) => !games.map((g) => g.players).includes(Array.from(new Set([...games.flatMap((g) => g.players), p]))));
}

function generateGameId(): string {
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let gameId = '';

for (let i = 0; i < 6; ++i) {
gameId += chars[Math.floor(Math.random() * chars.length)];
}

return gameId;
}

server.listen(3000, () => {
console.log('Matchmaking server listening on port 3000');
});
