import express from 'express';
import bodyParser from 'body-parser';
import { getUsers, addUser } from './userRepository';

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

async function start() {
console.log(`Server is running on port ${PORT}`);

app.get('/users', async (req, res) => {
const users = await getUsers();
res.json(users);
});

app.post('/users', async (req, res) => {
const userData = req.body;
if (!userData || !userData.name) {
return res.status(400).send('Invalid input');
}

try {
await addUser(userData);
res.status(201).send('User added successfully');
} catch (error) {
console.error(error);
res.status(500).send('Error adding user');
}
});

app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});
}

start();
