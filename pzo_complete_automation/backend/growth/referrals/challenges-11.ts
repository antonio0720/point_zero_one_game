import express from 'express';
import { Reward, User, Referral } from './models'; // Import the necessary models here

const router = express.Router();

router.post('/create', async (req, res) => {
const { userId, referrerId } = req.body;

// Validate user and referrer existance
const user = await User.findOne({ where: { id: userId } });
if (!user) return res.status(404).json({ error: 'User not found' });

const referrer = await User.findOne({ where: { id: referrerId } });
if (!referrer) return res.status(404).json({ error: 'Referrer not found' });

// Check if the user has already been referred
const referral = await Referral.findOne({ where: { userId } });
if (referral) return res.status(409).json({ error: 'User already has a referral' });

// Create a new referral and reward
const newReferral = await Referral.create({ userId, referrerId });
const newReward = await Reward.create();

// Increase the referrer's rewards balance
referrer.rewardsBalance += newReward.amount;
await referrer.save();

res.status(201).json({ success: true });
});

export default router;
