import { RateLimiterRedis } from "rate-limiter-flexible";
import crypto from 'crypto';
import redis from 'redis';

const client = redis.createClient();
const rateLimiter = new RateLimiterRedis({ storeClient: client });

interface Player {
id: string;
hash: string;
}

class AntiCheatSystem {
players: Map<string, Player>;

constructor() {
this.players = new Map();
}

async addPlayer(playerId: string) {
const playerHash = crypto.createHash('sha256').update(playerId).digest('hex');

await rateLimiter.consume(1, playerId);

if (this.players.has(playerId)) return;

this.players.set(playerId, { id: playerId, hash: playerHash });
}

async verifyPlayer(playerId: string, playerHash: string) {
const storedPlayer = this.players.get(playerId);

if (!storedPlayer || storedPlayer.hash !== playerHash) return false;

await rateLimiter.consume(10, playerId);
return true;
}
}

const antiCheatSystem = new AntiCheatSystem();
