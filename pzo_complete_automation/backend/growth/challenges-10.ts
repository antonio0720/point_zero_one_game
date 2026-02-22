import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

app.use(express.json());

// Define User and Challenge models
interface User {
id: number;
username: string;
}

interface Challenge {
id: number;
title: string;
description: string;
points: number;
completedBy: User[];
}

// Routes for user registration and login (assuming you have implemented them)

// POST /api/challenges
app.post('/api/challenges', async (req, res) => {
const { title, description, points } = req.body;

try {
const newChallenge = await prisma.challenge.create({
data: {
title,
description,
points,
},
});

res.status(201).json(newChallenge);
} catch (err) {
console.error(err);
res.status(500).send('Error creating challenge');
}
});

// GET /api/challenges
app.get('/api/challenges', async (req, res) => {
try {
const challenges = await prisma.challenge.findMany();
res.json(challenges);
} catch (err) {
console.error(err);
res.status(500).send('Error fetching challenges');
}
});

// GET /api/challenges/:id
app.get('/api/challenges/:id', async (req, res) => {
const id = parseInt(req.params.id);

try {
const challenge = await prisma.challenge.findUnique({ where: { id } });

if (!challenge) {
return res.status(404).send('Challenge not found');
}

res.json(challenge);
} catch (err) {
console.error(err);
res.status(500).send('Error fetching challenge');
}
});

// PATCH /api/challenges/:id/complete
app.patch('/api/challenges/:id/complete', async (req, res) => {
const id = parseInt(req.params.id);
const { userId } = req.body;

try {
// Fetch user by ID and the challenge by ID
const user = await prisma.user.findUnique({ where: { id: userId } });
const challenge = await prisma.challenge.findUnique({ where: { id } });

if (!user || !challenge) {
return res.status(404).send('User or Challenge not found');
}

// Add user to the completedBy array of the challenge
await prisma.challenge.update({
where: { id },
data: {
completedBy: {
connect: { id: userId },
},
},
});

res.send('User marked as completed for the challenge');
} catch (err) {
console.error(err);
res.status(500).send('Error marking user as completed for the challenge');
}
});

app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
