import express from 'express';
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const router = Router();

// Define User and Challenge schemas
const userSchema = z.object({
id: z.string(),
name: z.string(),
email: z.string().email(),
passwordHash: z.string(),
});

const challengeSchema = z.object({
id: z.string(),
title: z.string(),
description: z.string(),
rewardPoints: z.number(),
status: z.enum(['open', 'completed', 'expired']),
});

// Define functions for hashing passwords, generating JWT tokens and checking them
const saltRounds = 10;
function hashPassword(password: string): Promise<string> {
return bcrypt.hash(password, saltRounds);
}

function generateToken(userId: string): string {
const secretKey = process.env.JWT_SECRET as string;
return jwt.sign({ userId }, secretKey, { expiresIn: '24h' });
}

function verifyToken(token: string): Promise<string> {
const secretKey = process.env.JWT_SECRET as string;
return jwt.verify(token, secretKey);
}

// Database setup (mock data or actual database connection)
const users: Record<string, any> = {
'user1@example.com': { id: 'user1', name: 'John Doe', email: 'user1@example.com', passwordHash: '$2a$10$rZfQ738KlF6Nn5qwH3cXEuRjYoBhC9UJyT4bPzS0xGmZIk' },
}; // replace with real user data and hashed passwords

const challenges: Record<string, any> = {
'challenge1': { id: 'challenge1', title: 'Refer 3 friends', description: 'Earn 500 points by referring 3 new friends.', rewardPoints: 500, status: 'open' },
}; // replace with more challenges and manage their statuses

// Routes
router.post('/register', async (req, res) => {
const { email, password } = req.body;

if (!email || !password) return res.status(400).send({ error: 'Email and password are required.' });

const hashedPassword = await hashPassword(password);
users[email] = { id: email, name: email.split('@')[0], email, passwordHash: hashedPassword };
res.status(201).send({ message: 'User created.' });
});

router.post('/login', async (req, res) => {
const { email, password } = req.body;

if (!email || !password) return res.status(400).send({ error: 'Email and password are required.' });

const user = users[email];
if (!user) return res.status(404).send({ error: 'User not found.' });

const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
if (!isPasswordValid) return res.status(401).send({ error: 'Invalid password.' });

const token = generateToken(user.id);
res.status(200).send({ token });
});

router.get('/challenges', async (req, res) => {
const token = req.headers['authorization'] as string;

if (!token) return res.status(401).send({ error: 'Authorization token is required.' });

try {
const userId = await verifyToken(token);
const challengesArray = Object.values(challenges);
res.status(200).send(challengesArray);
} catch (error) {
res.status(401).send({ error: 'Invalid authorization token.' });
}
});

router.post('/challenges/:id/join', async (req, res) => {
const token = req.headers['authorization'] as string;
const challengeId = req.params.id;

if (!token || !challengeId) return res.status(401).send({ error: 'Authorization token and challenge ID are required.' });

try {
const userId = await verifyToken(token);
const user = users[userId];
const challenge = challenges[challengeId];

if (!user || !challenge) return res.status(404).send({ error: 'User or challenge not found.' });

// Add the user to the challenge participants (mock data example)
user.challenges = user.challenges || [];
user.challenges.push(challengeId);

res.status(200).send({ message: 'Joined the challenge.' });
} catch (error) {
res.status(401).send({ error: 'Invalid authorization token.' });
}
});

// Add more routes for completing challenges, checking progress, etc.

app.use('/api/referrals/challenges', router);
