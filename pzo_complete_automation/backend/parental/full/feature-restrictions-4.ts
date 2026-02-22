import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const saltRounds = 10;

// User model (simplified for example)
interface User {
id: number;
username: string;
password: string;
age: number;
}

// Token payload and secret key
interface TokenPayload {
userId: number;
age: number;
}
const tokenSecret = 'your-secret-key';

// Sample user data (replace with real database access)
let users: User[] = [
{ id: 1, username: 'user1', password: bcrypt.hashSync('password1', saltRounds), age: 25 },
];

app.post('/login', (req, res) => {
const { username, password } = req.body;
const user = users.find((u) => u.username === username);

if (!user || !bcrypt.compareSync(password, user.password)) {
return res.status(401).json({ message: 'Invalid credentials' });
}

const tokenData: TokenPayload = { userId: user.id, age: user.age };
const token = jwt.sign(tokenData, tokenSecret);

res.json({ token });
});

app.get('/restricted-feature', (req, res) => {
try {
const token = req.headers.authorization?.split(' ')[1];
const decoded = jwt.verify(token, tokenSecret) as TokenPayload;

if (decoded.age < 18) {
return res.status(403).json({ message: 'Access denied due to age restriction' });
}

res.json({ message: 'Access granted to the restricted feature' });
} catch (err) {
return res.status(401).json({ message: 'Invalid or expired token' });
}
});

app.listen(3000, () => console.log('Server running on port 3000'));
