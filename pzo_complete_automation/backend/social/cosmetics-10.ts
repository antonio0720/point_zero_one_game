import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

interface User {
id: number;
score: number;
}

let users: User[] = [];

function addUser(userId: number, score: number) {
const userIndex = users.findIndex((user) => user.id === userId);

if (userIndex !== -1) {
users[userIndex].score += score;
} else {
users.push({ id: userId, score });
}
}

function getLeaderboard(limit: number): User[] {
return users.sort((a, b) => b.score - a.score).slice(0, limit);
}

app.post('/leaderboard/update', (req, res) => {
const { userId, score } = req.body;
addUser(userId, score);
res.sendStatus(204);
});

app.get('/leaderboard', (req, res) => {
const limit = parseInt(req.query.limit as string);
if (!isNaN(limit)) {
res.json(getLeaderboard(limit));
} else {
res.sendStatus(400);
}
});

app.listen(3000, () => console.log('Server started on port 3000'));
