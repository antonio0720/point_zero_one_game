import redis from 'ioredis';

const client = new redis();

interface User {
id: string;
name: string;
score: number;
proofWeight: number;
}

function getLeaderboard(): Promise<User[]> {
return client.zrevrange('leaderboard', 0, -1, 'WITHSCORES').then((scores) => {
const leaderboard: User[] = [];
scores.forEach((scoreAndRank) => {
leaderboard.push({
id: scoreAndRank[0],
name: client.get(scoreAndRank[0]),
score: parseInt(scoreAndRank[1]),
proofWeight: 1, // Placeholder for actual proof weight
});
});
return leaderboard;
});
}

function addOrUpdateScore(userId: string, newScore: number, proofWeight?: number): Promise<void> {
return client.multi()
.zadd('leaderboard', { score: newScore }, userId)
.set(userId, JSON.stringify({ name: '', score: newScore, proofWeight }))
.exec();
}

function calculateProofWeightedScore(userA: User, userB: User): number {
return userA.score * (1 + userB.proofWeight);
}
