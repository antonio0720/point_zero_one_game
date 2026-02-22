import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3000;

interface User {
age: number;
}

app.use(express.json());

function authenticateToken(req: Request, res: Response, next: Function) {
const authHeader = req.headers['authorization'];
const token = authHeader && authHeader.split(' ')[1];

if (!token) return res.sendStatus(401); // unauthorized

jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string, (err: any, user: User) => {
if (err) return res.sendStatus(403); // forbidden
req.user = user;
next();
});
}

app.post('/api/age-gated', authenticateToken, (req: Request, res: Response) => {
const { age } = req.user;

if (age < 18) return res.sendStatus(403); // forbidden

// Restricted feature code here...
res.json({ message: 'Age-gated feature enabled.' });
});

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
