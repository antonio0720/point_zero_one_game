import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

interface User {
id: string;
name: string;
score: number;
badges: string[];
}

let users: User[] = [];

function getUserById(id: string): User | undefined {
return users.find((user) => user.id === id);
}

function addUser(user: User) {
users.push(user);
}

function updateUser(id: string, updates: Partial<User>) {
const user = getUserById(id);

if (user) {
Object.assign(user, updates);
}
}

app.get('/users', (req, res) => {
res.json(users);
});

app.post('/users', (req, res) => {
const user = req.body as User;

if (!user || !user.id || !user.name || !user.score) {
return res.status(400).json({ error: 'Invalid user data' });
}

addUser(user);
res.status(201).json(user);
});

app.put('/users/:id', (req, res) => {
const id = req.params.id;
const updates = req.body as Partial<User>;

if (!updates.score || isNaN(updates.score)) {
return res.status(400).json({ error: 'Invalid score' });
}

updateUser(id, updates);
const updatedUser = getUserById(id);

if (updatedUser) {
res.json(updatedUser);
} else {
res.status(404).json({ error: 'User not found' });
}
});

app.listen(3000, () => console.log('Server running on port 3000'));
