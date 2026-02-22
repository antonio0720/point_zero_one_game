import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
const app = express();
const saltRounds = 10;
const secretKey = process.env.SECRET_KEY || 'your-secret-key';

interface User {
id: string;
username: string;
password: string;
}

let users: User[] = [];

// Register a new user
app.post('/register', async (req, res) => {
const { username, password } = req.body;
if (!username || !password) return res.status(400).send('Invalid request');

// Check if the username already exists
const existingUser = users.find((user) => user.username === username);
if (existingUser) return res.status(409).send('Username already taken');

// Hash the password
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Save the new user
users.push({ id: uuidv4(), username, password: hashedPassword });
res.status(201).send('User registered');
});

// Login a user and create/return session
app.post('/login', async (req, res) => {
const { username, password } = req.body;
if (!username || !password) return res.status(400).send('Invalid request');

// Find the user by username
const user = users.find((user) => user.username === username);
if (!user) return res.status(401).send('Incorrect username or password');

// Compare the provided password with the stored hashed password
const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) return res.status(401).send('Incorrect username or password');

// Create and sign JWT token
const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: '24h' });

// Return the session (token)
res.json({ session: token });
});

// Recover a lost session by username and device token
app.post('/recover', async (req, res) => {
const { username, deviceToken } = req.body;
if (!username || !deviceToken) return res.status(400).send('Invalid request');

// Find the user by username
const user = users.find((user) => user.username === username);
if (!user) return res.status(401).send('Incorrect username or device token');

// Generate a new session (token)
const newSession = uuidv4();

// Save the new session for the user
user.session = newSession;

// Return the new session
res.json({ session: newSession });
});
