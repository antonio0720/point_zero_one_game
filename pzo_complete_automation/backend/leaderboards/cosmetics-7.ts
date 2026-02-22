import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({
user: 'dbuser',
host: 'localhost',
database: 'leaderboards_db',
password: 'your_password',
port: 5432,
});

app.use(express.json());

interface User {
id: string;
username: string;
password: string;
cosmetics: string[];
}

function hashPassword(password: string) {
return bcrypt.hashSync(password, 8);
}

async function createUser(username: string, password: string) {
const hashedPassword = hashPassword(password);
await pool.query('INSERT INTO users (id, username, password) VALUES ($1, $2, $3)', [uuidv4(), username, hashedPassword]);
}

async function getUser(username: string): Promise<User | null> {
const result = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
if (result.rows.length === 0) return null;
const user = result.rows[0];
delete user.password; // For security, do not return password in the response
return user as User;
}

async function updateUserCosmetics(userId: string, cosmetics: string[]) {
await pool.query('UPDATE users SET cosmetics=$1 WHERE id=$2', [JSON.stringify(cosmetics), userId]);
}

app.post('/register', async (req, res) => {
const { username, password } = req.body;
try {
await createUser(username, password);
res.status(201).json({ message: 'User created successfully.' });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while creating the user.' });
}
});

app.post('/login', async (req, res) => {
const { username, password } = req.body;
try {
const user = await getUser(username);
if (!user || !bcrypt.compareSync(password, user.password)) {
return res.status(401).json({ error: 'Invalid credentials.' });
}
res.status(200).json(user);
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while logging in.' });
}
});

app.put('/cosmetics/:userId', async (req, res) => {
const userId = req.params.userId;
const cosmetics = req.body.cosmetics || [];

try {
await updateUserCosmetics(userId, cosmetics);
res.status(200).json({ message: 'Cosmetics updated successfully.' });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while updating the cosmetics.' });
}
});

app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
