import express from 'express';
import { db } from './database';
import crypto from 'crypto';

const app = express();
app.use(express.json());

let users = [];
let sessions = {};

async function generateSessionId() {
return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password: string) {
// Replace this with a secure password hashing algorithm, such as bcrypt.
return crypto.createHash('sha512').update(password).digest('hex');
}

async function registerUser(username: string, password: string) {
const userExists = users.some((user) => user.username === username);
if (userExists) throw new Error('Username already exists.');

const userId = users.length + 1;
const sessionId = await generateSessionId();
const hashedPassword = hashPassword(password);

users.push({ id: userId, username, password: hashedPassword });
sessions[sessionId] = { userId, sessionId };

return sessionId;
}

function authenticateUser(username: string, password: string) {
const user = users.find((user) => user.username === username);
if (!user) throw new Error('Invalid username.');

const hashedPassword = hashPassword(password);
if (hashedPassword !== user.password) throw new Error('Invalid password.');

return user;
}

app.post('/register', async (req, res) => {
try {
const sessionId = await registerUser(req.body.username, req.body.password);
res.status(201).send({ sessionId });
} catch (error) {
res.status(400).send({ error: error.message });
}
});

app.post('/login', async (req, res) => {
try {
const user = await authenticateUser(req.body.username, req.body.password);
const sessionId = sessions[await generateSessionId()];
sessions[sessionId.sessionId] = { userId: user.id, sessionId };
res.status(200).send({ sessionId });
} catch (error) {
res.status(401).send({ error: error.message });
}
});

app.get('/verify-session/:sessionId', (req, res) => {
const session = sessions[req.params.sessionId];
if (!session) return res.status(403).send({ error: 'Invalid session.' });

db.query(`SELECT * FROM users WHERE id=${session.userId}`)
.then((result) => {
if (result.length === 0) throw new Error('User not found.');
res.status(200).send({ username: result[0].username });
})
.catch((error) => res.status(500).send({ error: error.message }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
