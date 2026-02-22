import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());

const users = [
{ id: 1, username: 'admin', password: bcrypt.hashSync('password', 8) },
];

const JWT_SECRET = process.env.JWT_SECRET;

app.post('/login', (req, res) => {
const { username, password } = req.body;

if (!username || !password) {
return res.status(400).json({ error: 'Missing credentials' });
}

const user = users.find((u) => u.username === username);

if (!user) {
return res.status(401).json({ error: 'Invalid credentials' });
}

if (bcrypt.compareSync(password, user.password)) {
const token = jwt.sign({ userId: user.id }, JWT_SECRET);
return res.json({ token });
}

return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/protected', authenticateToken, (req, res) => {
res.send('Welcome!');
});

function authenticateToken(req, res, next) {
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.split(' ')[1];

if (!token) {
return res.sendStatus(401);
}

jwt.verify(token, JWT_SECRET, (err, user) => {
if (err) {
return res.sendStatus(403);
}
req.user = user;
next();
});
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
