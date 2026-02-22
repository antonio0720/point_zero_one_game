import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import config from '../../config';

const SESSION_SECRET = config.sessionSecret;

export const createSession = (req: Request, res: Response) => {
const userId = req.body.userId;
const sessionId = jwt.sign({ userId }, SESSION_SECRET, { expiresIn: '24h' });

res.json({ sessionId });
};

export const recoverSession = (req: Request, res: Response) => {
const token = req.body.token;
try {
const decoded = jwt.verify(token, SESSION_SECRET);
const userId = decoded.userId;

res.json({ userId });
} catch (err) {
res.status(401).json({ error: 'Invalid session token' });
}
};

export const authenticateSession = (req: Request, res: Response, next: NextFunction) => {
const authHeader = req.headers['authorization'];
if (!authHeader) return res.status(401).json({ error: 'Missing authorization header' });

const token = authHeader.split(' ')[1];
try {
const decoded = jwt.verify(token, SESSION_SECRET);
req.user = { id: decoded.userId };
next();
} catch (err) {
res.status(401).json({ error: 'Invalid session token' });
}
};
