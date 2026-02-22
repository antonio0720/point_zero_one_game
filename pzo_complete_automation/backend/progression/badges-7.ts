import express from 'express';
import mongoose from 'mongoose';
import { Reward, RewardSchema } from './rewards';

const router = express.Router();
const User = mongoose.model('User', new mongoose.Schema({}));

router.post('/:userId/unlock/:badgeId', async (req, res) => {
try {
const user = await User.findById(req.params.userId);
if (!user) return res.status(404).send('User not found');

const reward = await Reward.findOne({ _id: req.params.badgeId });
if (!reward) return res.status(404).send('Badge not found');

// Check if the user has already unlocked this badge
if (user.badges.includes(req.params.badgeId)) {
return res.status(400).send('User has already unlocked this badge');
}

// Update the user's badges array with the new badge id
user.badges.push(req.params.badgeId);
await user.save();

res.status(200).send('Badge unlocked successfully');
} catch (err) {
console.error(err);
res.status(500).send('An error occurred while unlocking the badge');
}
});

export default router;
