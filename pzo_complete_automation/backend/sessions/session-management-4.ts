import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { User } from '../models/user';
import { GameSession } from '../models/game-session';
import { io } from '../app';

interface SessionData {
gameId: string;
players: User[];
}

let sessionMap: Map<string, SessionData> = new Map();

io.on('connection', (socket: Socket) => {
socket.on('join-game', async ({ userId, gameId }) => {
const user = await User.findById(userId);

if (!user) {
return;
}

let sessionData = sessionMap.get(gameId);

if (!sessionData) {
sessionData = { gameId, players: [] };
sessionMap.set(gameId, sessionData);
}

sessionData.players.push(user);
socket.join(gameId);

io.to(gameId).emit('player-connected', user);
});

socket.on('disconnect', () => {
const user = socket.request as any;
const userId = user.params.userId;

if (!userId) {
return;
}

const userToRemove = await User.findById(userId);

if (!userToRemove) {
return;
}

socket.broadcast.to((gameId: any) => sessionMap.has(gameId), 'player-disconnected', userToRemove);

let sessionData = sessionMap.get(socket.nsp.rooms[socket.id]);

if (sessionData) {
const playerIndex = sessionData.players.findIndex((p: any) => p._id === userId);

if (playerIndex !== -1) {
sessionData.players.splice(playerIndex, 1);

if (sessionData.players.length === 0) {
sessionMap.delete(socket.nsp.rooms[socket.id]);
}
}
}
});
});

export const checkSession = async (req: Request, res: Response, next: NextFunction) => {
const gameId = req.params.gameId;
const sessionData = sessionMap.get(gameId);

if (!sessionData || sessionData.players.length < 2) {
return res.status(404).json({ error: 'Game not found or not enough players' });
}

next();
};
