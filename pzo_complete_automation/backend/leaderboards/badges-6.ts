import express from 'express';
import { Schema, model } from 'mongoose';

const router = express.Router();

const badgeSchema = new Schema({
userId: String,
badgeId: Number,
level: Number,
});

const Badge = model('Badge', badgeSchema);

router.get('/:userId', async (req, res) => {
try {
const badges = await Badge.find({ userId: req.params.userId }).exec();
res.status(200).json(badges);
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

router.post('/:userId', async (req, res) => {
try {
const newBadge = new Badge({ userId: req.params.userId, badgeId: req.body.badgeId, level: 1 });
await newBadge.save();
res.status(201).json(newBadge);
} catch (error) {
console.error(error);
res.status(500).send('Internal Server Error');
}
});

export default router;
