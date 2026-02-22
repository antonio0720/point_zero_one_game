import redis from 'redis';
const client = redis.createClient();

interface User {
id: string;
name: string;
score: number;
}

async function getLeaderboard(limit?: number): Promise<User[]> {
const sortedSetKey = 'leaderboard:scores';

client.zrevrange(sortedSetKey, 0, limit || -1, (err, users) => {
if (err) throw err;

return users.map((id) => JSON.parse(client.get(id, (_, score) => score));
});
}

async function addScore(userId: string, newScore: number): Promise<void> {
client.zadd(
'leaderboard:scores',
newScore,
userId,
(err, result) => {
if (err) throw err;
if (!result) client.set(userId, JSON.stringify({ id: userId, score: newScore }));
}
);
}

export default { getLeaderboard, addScore };
