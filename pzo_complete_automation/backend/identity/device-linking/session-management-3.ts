import express from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';

const app = express();
const redisClient = createClient({ host: 'localhost', port: 6379 });

// Set up Redis client for session storage.
redisClient.on('error', (err) => console.log(`Redis Error ${err}`));

app.use(express.json());

const secretKey = process.env.JWT_SECRET_KEY || 'your-secret-key';

// Generate a new session for the user with a JWT.
function createSession(userId: string) {
const payload = { userId };
const token = jwt.sign(payload, secretKey, { expiresIn: '1d' });
return { token, userId };
}

// Store session in Redis by key.
async function storeSession(key: string, sessionData: any) {
redisClient.set(key, JSON.stringify(sessionData), (err) => {
if (err) console.log(`Error storing session ${JSON.stringify(err)}`);
});
}

// Get session data from Redis by key.
async function getSession(key: string): Promise<any> {
return new Promise((resolve, reject) => {
redisClient.get(key, (err, reply) => {
if (err) reject(err);
else resolve(JSON.parse(reply || '{}'));
});
});
}

// Delete session from Redis by key.
function deleteSession(key: string) {
redisClient.del(key, (err) => {
if (err) console.log(`Error deleting session ${JSON.stringify(err)}`);
});
}

app.post('/login', async (req, res) => {
const userId = req.body.userId;
if (!userId) return res.status(400).send('Invalid user ID.');

const { token, userId } = createSession(userId);
const sessionKey = `session:${token}`;

await storeSession(sessionKey, { userId });
res.json({ token });
});

app.get('/recover/:token', async (req, res) => {
const token = req.params.token;
const sessionKey = `session:${token}`;

try {
const sessionData = await getSession(sessionKey);
if (!sessionData.userId) return res.status(401).send('Invalid or expired session.');

res.json({ userId: sessionData.userId });
} catch (err) {
console.error(`Error recovering session ${JSON.stringify(err)}`);
res.status(500).send();
}
});

app.delete('/logout/:token', async (req, res) => {
const token = req.params.token;
const sessionKey = `session:${token}`;

try {
await deleteSession(sessionKey);
res.send();
} catch (err) {
console.error(`Error logging out session ${JSON.stringify(err)}`);
res.status(500).send();
}
});

app.listen(3000, () => console.log('Server started on port 3000'));
