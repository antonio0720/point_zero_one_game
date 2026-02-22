import * as express from 'express';
import redis from 'redis';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const client = redis.createClient({ host: 'localhost', port: 6379 });

app.use(express.json());

interface Session {
id: string;
user_id: string | null;
device_info: any;
}

let sessionMap: Map<string, Session> = new Map();

function getSessionId(userId?: string): string {
const sessionId = uuidv4();
if (userId) {
const existingSession = sessionMap.get(userId);
if (existingSession) {
delete sessionMap.get(existingSession.id);
}
}
return sessionId;
}

function setSession(session: Session): void {
sessionMap.set(session.id, session);
}

function getSession(sessionId: string): Session | null {
return sessionMap.get(sessionId);
}

client.on('error', (err) => {
console.error(`Error connecting to Redis: ${err}`);
});

app.post('/session', async (req, res) => {
const userId = req.body.userId;
if (!userId) return res.status(400).send('Missing user id');

const sessionId = getSessionId(userId);

res.json({ sessionId });
});

app.post('/sync', async (req, res) => {
const sessionId = req.body.sessionId;
if (!sessionId) return res.status(400).send('Missing session id');

const session = getSession(sessionId);
if (!session) return res.status(404).send('Session not found');

res.json(session);
});

app.post('/handoff', async (req, res) => {
const oldSessionId = req.body.oldSessionId;
const newSessionId = req.body.newSessionId;

const oldSession = getSession(oldSessionId);
if (!oldSession) return res.status(404).send('Old session not found');

const newSession = getSession(newSessionId);
if (newSession) return res.status(409).send('New session already exists');

oldSession.device_info = req.body.deviceInfo;
setSession(oldSession);
client.set(oldSession.id, JSON.stringify(oldSession), 'EX', 60 * 60 * 24); // Cache for 1 day

res.sendStatus(200);
});

app.listen(3000, () => console.log('Server started on port 3000'));
