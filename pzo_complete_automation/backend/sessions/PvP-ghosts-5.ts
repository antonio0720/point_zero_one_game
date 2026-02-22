import { Player } from './Player';

interface SessionData {
players: Player[];
gameServerAddress: string;
}

class Matchmaking {
private queue: Player[] = [];

public enqueue(player: Player) {
this.queue.push(player);
}

public dequeue(): Player | null {
return this.queue.length > 0 ? this.queue.shift() : null;
}

public isEmpty(): boolean {
return this.queue.length === 0;
}
}

class SessionManager {
private sessions: Map<number, SessionData> = new Map();

public createSession(gameServerAddress: string): number {
const sessionId = Math.floor(Math.random() * 1000000);
this.sessions.set(sessionId, { players: [], gameServerAddress });
return sessionId;
}

public joinSession(player: Player, sessionId: number): void {
const session = this.sessions.get(sessionId);

if (!session) {
throw new Error('Session not found');
}

session.players.push(player);
}

public startSession(sessionId: number): void {
const session = this.sessions.get(sessionId);

if (!session) {
throw new Error('Session not found');
}

// Connect players to the game server and start the game
const gameServerAddress = session.gameServerAddress;
session.players.forEach((player) => player.connectToGameServer(gameServerAddress));
}
}
