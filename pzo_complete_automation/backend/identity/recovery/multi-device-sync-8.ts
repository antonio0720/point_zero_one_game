import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const app = express();
const usersPath = path.join(__dirname, '../data/users.json');

app.use(express.json());

interface User {
id: string;
email: string;
passwordHash: string;
recoveryCodes: string[];
}

function hashPassword(password: string): Promise<string> {
return bcrypt.hash(password, 10);
}

function comparePassword(password: string, hashedPassword: string): boolean {
return bcrypt.compare(password, hashedPassword);
}

function generateRecoveryCode(): string {
return uuidv4();
}

async function getUserByEmail(email: string): Promise<User | null> {
const rawData = fs.readFileSync(usersPath);
const users = JSON.parse(rawData) as User[];
return users.find((user) => user.email === email) || null;
}

async function createUser(email: string, password: string): Promise<User> {
const user = { id: uuidv4(), email, passwordHash: await hashPassword(password), recoveryCodes: [] };
const rawData = fs.readFileSync(usersPath);
const users = JSON.parse(rawData) as User[];
users.push(user);
fs.writeFileSync(usersPath, JSON.stringify(users));
return user;
}

async function addRecoveryCode(userId: string, recoveryCode: string): Promise<void> {
const user = await getUserByEmail(`${userId}`);
if (!user) throw new Error('User not found');
user.recoveryCodes.push(recoveryCode);
fs.writeFileSync(usersPath, JSON.stringify([...users]));
}

async function useRecoveryCode(email: string, recoveryCode: string): Promise<{ id: string, token: string }> {
const user = await getUserByEmail(email);
if (!user) throw new Error('User not found');

const index = user.recoveryCodes.findIndex((code) => code === recoveryCode);
if (index === -1) throw new Error('Invalid recovery code');

const id = user.id;
const token = jwt.sign({ id }, 'SECRET_KEY', { expiresIn: '1h' });
return { id, token };
}

app.post('/register', async (req, res) => {
const { email, password } = req.body;
try {
const user = await createUser(email, password);
res.json({ message: 'User created successfully', user });
} catch (error) {
console.error(error);
res.status(500).json({ error: error.message });
}
});

app.post('/login', async (req, res) => {
const { email, password } = req.body;
try {
const user = await getUserByEmail(email);
if (!user) throw new Error('User not found');
if (!(await comparePassword(password, user.passwordHash))) throw new Error('Invalid password');

const token = jwt.sign({ id: user.id }, 'SECRET_KEY', { expiresIn: '1h' });
res.json({ message: 'Login successful', token });
} catch (error) {
console.error(error);
res.status(401).json({ error: error.message });
}
});

app.post('/recovery/generate-code', async (req, res) => {
const { email } = req.body;
try {
const user = await getUserByEmail(email);
if (!user) throw new Error('User not found');
const recoveryCode = generateRecoveryCode();
await addRecoveryCode(user.id, recoveryCode);
res.json({ message: 'Recovery code generated successfully', recoveryCode });
} catch (error) {
console.error(error);
res.status(500).json({ error: error.message });
}
});

app.post('/recovery/use-code', async (req, res) => {
const { email, recoveryCode } = req.body;
try {
const { id, token } = await useRecoveryCode(email, recoveryCode);
res.json({ message: 'Recovery successful', id, token });
} catch (error) {
console.error(error);
res.status(401).json({ error: error.message });
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
