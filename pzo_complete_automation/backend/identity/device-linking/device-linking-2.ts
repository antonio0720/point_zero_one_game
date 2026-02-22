import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const app = express();
const secretKey = fs.readFileSync('.secret').toString();

app.use(express.json());

let deviceLinks: Record<string, string[]> = {};

// Generate a new link for the given deviceId
function generateLink(deviceId: string) {
const link = uuidv4();
if (!deviceLinks[link]) deviceLinks[link] = [];
deviceLinks[link].push(deviceId);
return link;
}

// Verify the given token and return the associated deviceId or null if invalid
function getDeviceByIdentifier(identifier: string): string | null {
const decoded = jwt.verify(identifier, secretKey) as { deviceId: string };
return deviceLinks[decoded.link]?.includes(decoded.deviceId) ? decoded.deviceId : null;
}

// Create a new link for the given deviceId
app.post('/device-links', (req, res) => {
const deviceId = req.body.deviceId;
if (!deviceId) return res.status(400).send({ error: 'Device ID is required' });

const link = generateLink(deviceId);
res.json({ link });
});

// Recover the deviceId associated with the given token
app.get('/device/:identifier', (req, res) => {
const identifier = req.params.identifier;
const deviceId = getDeviceByIdentifier(identifier);
if (!deviceId) return res.status(401).send({ error: 'Invalid or expired link' });
res.json({ deviceId });
});

app.listen(3000, () => console.log('Server started on port 3000'));
