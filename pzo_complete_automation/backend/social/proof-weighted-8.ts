import { createClient } from 'redis';

const redisClient = createClient();

interface User {
id: string;
score: number;
}

async function getLeaderboard(limit?: number): Promise<User[]> {
const leaderboard: User[] = [];

for await (const key of redisClient.scanIter(['score:*'])) {
const [userId, score] = key.split(':');
leaderboard.push({ id: userId, score: Number(score) });

if (limit !== undefined && leaderboard.length >= limit) break;
}

return leaderboard.sort((a, b) => b.score - a.score);
}

async function updateScore(userId: string, delta: number): Promise<void> {
const scoreKey = `score:${userId}`;
const currentScore = await redisClient.get(scoreKey);
let newScore = Number(currentScore) || 0;
newScore += delta;

await redisClient.setex(scoreKey, 86400, String(newScore)); // Expire score in 24 hours
}

export { getLeaderboard, updateScore };
