import express from 'express';
import { REDIS_CLIENT } from './redis';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// User model with username and cosmetic preferences
interface User {
username: string;
cosmetics: string[];
}

// Leaderboard key prefix
const LEADERBOARD_KEY = 'leaderboard:';

app.get('/leaderboard', async (req, res) => {
const leaderboard = await REDIS_CLIENT.ZRANGEBYSCORE(LEADERBOARD_KEY + 'score', 0, -1, 'WITHSCORES');
const formattedLeaderboard: User[] = leaderboard.map((item) => JSON.parse(item[1])).sort((a, b) => b.score - a.score);
res.json(formattedLeaderboard);
});

app.post('/user', async (req, res) => {
const user: User = req.body;
await REDIS_CLIENT.ZADD(`${LEADERBOARD_KEY}score`, user.score || 0, JSON.stringify({ username: user.username, cosmetics: user.cosmetics }));
res.status(201).json({ message: 'User created successfully' });
});

app.put('/user/:id', async (req, res) => {
const userId = req.params.id;
const user: User = req.body;
await REDIS_CLIENT.ZREMOVE(`${LEADERBOARD_KEY}score`, userId);
await REDIS_CLIENT.ZADD(`${LEADERBOARD_KEY}score`, user.score || 0, JSON.stringify({ username: user.username, cosmetics: user.cosmetics }));
res.status(200).json({ message: 'User updated successfully' });
});

app.listen(port, () => {
console.log(`App running on port ${port}`);
});
