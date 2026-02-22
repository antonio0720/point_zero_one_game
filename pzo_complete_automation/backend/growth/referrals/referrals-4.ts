import express from 'express';
import { prisma } from '../database/prismaClient';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Generate unique referral code for a user
router.post('/generate-referral-code', async (req, res) => {
try {
const userId = req.user.id;
const referralCode = uuidv4();
await prisma.user.update({
where: { id: userId },
data: { referralCode },
});
res.status(200).json({ referralCode });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while generating the referral code.' });
}
});

// Register a new user using a referral code and reward the referrer
router.post('/register', async (req, res) => {
try {
const { email, password, referralCode } = req.body;
// Validate the email, password, and referralCode here
const userExists = await prisma.user.count({ where: { email } });
if (userExists > 0) {
return res.status(400).json({ error: 'User with that email already exists.' });
}

// Find the referrer by their referral code
const referrer = await prisma.user.findFirst({ where: { referralCode } });
if (!referrer) {
return res.status(400).json({ error: 'Invalid or expired referral code.' });
}

// Create a new user and associate it with the referrer (update referral count)
const newUser = await prisma.user.create({
data: { email, password },
});
await prisma.user.update({
where: { id: referrer.id },
data: { referralCount: { increment: 1 } },
});

res.status(201).json({ message: 'User created successfully.', user: newUser });
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while registering the user.' });
}
});

export default router;
