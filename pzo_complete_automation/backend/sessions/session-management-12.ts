import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';

const app = express();
const pool = new Pool({
user: 'your_db_user',
host: 'your_db_host',
database: 'your_database',
password: 'your_password',
port: your_port,
});

app.use(express.json());

interface Session {
id: string;
user_id: number;
}

const createSession = (userId: number) => {
const sessionId = uuidv4();
return pool.query('INSERT INTO sessions (id, user_id) VALUES ($1, $2)', [sessionId, userId]);
};

const getSessionById = (sessionId: string) => {
return pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
};

const matchUsers = async () => {
const availableSessions = await pool.query('SELECT * FROM sessions WHERE status = "available"');
const users = await pool.query('SELECT * FROM users');

for (let session of availableSessions.rows) {
let matchingUser;

// This is a placeholder for the actual matchmaking algorithm.
// You should replace it with your own logic based on user preferences, skills, etc.
for (let user of users.rows) {
if (!matchingUser && user.status === 'available') {
matchingUser = user;
break;
}
}

if (matchingUser) {
await pool.query('UPDATE sessions SET status = "matched" WHERE id = $1', [session.id]);
await pool.query('UPDATE users SET status = "matched" WHERE id = $1', [matchingUser.id]);
}
}
};

app.post('/sessions', async (req, res) => {
const userId = req.body.userId;
try {
await createSession(userId);
res.json({ sessionId: uuidv4() });
} catch (error) {
res.status(500).json({ error: 'Internal Server Error' });
}
});

app.get('/sessions/:sessionId', async (req, res) => {
const sessionId = req.params.sessionId;
try {
const result = await getSessionById(sessionId);
if (result.rowCount > 0) {
res.json(result.rows[0]);
} else {
res.status(404).json({ error: 'Session Not Found' });
}
} catch (error) {
res.status(500).json({ error: 'Internal Server Error' });
}
});

app.get('/match', async (req, res) => {
try {
await matchUsers();
res.json({ message: 'Matchmaking complete' });
} catch (error) {
res.status(500).json({ error: 'Internal Server Error' });
}
});

app.listen(3000, () => console.log('Server running on port 3000'));
