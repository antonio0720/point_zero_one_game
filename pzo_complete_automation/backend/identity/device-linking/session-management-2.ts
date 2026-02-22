import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());

interface Device {
id: string;
sessionId?: string;
}

let devices: Record<string, Device> = {};

function generateSessionId(): string {
return uuidv4();
}

function createDevice(deviceId: string): Device {
if (!devices[deviceId]) {
devices[deviceId] = { id: deviceId };
}
return devices[deviceId];
}

function updateSessionId(device: Device, sessionId: string) {
device.sessionId = sessionId;
}

app.post('/link', async (req, res) => {
const { deviceId, password } = req.body;

if (!deviceId || !password) {
return res.status(400).json({ error: 'Missing required fields' });
}

const device = createDevice(deviceId);

// Check password (you can replace this with an actual authentication method)
if (!(await bcrypt.compare(password, process.env.HASH_PASSWORD))) {
return res.status(401).json({ error: 'Invalid password' });
}

const sessionId = generateSessionId();
updateSessionId(device, sessionId);

res.json({ sessionId });
});

app.post('/recover', async (req, res) => {
const { deviceId, recoveryCode } = req.body;

if (!deviceId || !recoveryCode) {
return res.status(400).json({ error: 'Missing required fields' });
}

const device = createDevice(deviceId);

// Check recovery code (you can replace this with an actual recovery method)
if (recoveryCode !== process.env.RECOVERY_CODE) {
return res.status(403).json({ error: 'Invalid recovery code' });
}

const sessionId = generateSessionId();
updateSessionId(device, sessionId);

res.json({ sessionId });
});

app.post('/login', async (req, res) => {
const { deviceId, password } = req.body;

if (!deviceId || !password) {
return res.status(400).json({ error: 'Missing required fields' });
}

const device = createDevice(deviceId);

// Check password (you can replace this with an actual authentication method)
if (!(await bcrypt.compare(password, process.env.HASH_PASSWORD))) {
return res.status(401).json({ error: 'Invalid password' });
}

const sessionId = device.sessionId || generateSessionId();

// Generate and assign JWT token
const token = jwt.sign({ sessionId }, process.env.JWT_SECRET, { expiresIn: '1h' });

res.json({ token });
});

app.listen(3000, () => console.log('Server listening on port 3000'));
