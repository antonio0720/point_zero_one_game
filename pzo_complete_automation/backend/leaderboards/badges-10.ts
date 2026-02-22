import express from 'express';
import mongoose from 'mongoose';
import { Router } from 'express-router';
import bodyParser from 'body-parser';

// User schema
const userSchema = new mongoose.Schema({
username: String,
points: Number,
});

// Badge schema
const badgeSchema = new mongoose.Schema({
name: String,
description: String,
requiredPoints: Number,
});

const User = mongoose.model('User', userSchema);
const Badge = mongoose.model('Badge', badgeSchema);

const app = express();
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('<your_mongo_uri>', { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error(err));

// Router for the leaderboard API
const router = Router();

router.get('/', async (req, res) => {
const users = await User.find().sort({ points: -1 }).exec();
res.json(users);
});

router.get('/:userId/badges', async (req, res) => {
const userId = req.params.userId;
const user = await User.findOne({ _id: userId }).exec();
if (!user) return res.status(404).send('User not found');

const badges = [];
const collectedBadges = user.badges || [];

const allBadges = await Badge.find().exec();
for (const badge of allBadges) {
if (collectedBadges.includes(badge._id)) {
badges.push({ ...badge.toJSON(), isCollected: true });
} else if (user.points >= badge.requiredPoints) {
await User.findOneAndUpdate(
{ _id: userId },
{ $addToSet: { badges: badge._id } },
{ new: true }
).exec();
badges.push({ ...badge.toJSON(), isCollected: false });
} else {
badges.push(badge.toJSON());
}
}

res.json(badges);
});

router.post('/:userId/badges/:badgeId', async (req, res) => {
const userId = req.params.userId;
const badgeId = req.params.badgeId;

const user = await User.findOne({ _id: userId }).exec();
if (!user) return res.status(404).send('User not found');

const badge = await Badge.findOne({ _id: badgeId }).exec();
if (!badge) return res.status(404).send('Badge not found');

if (user.points >= badge.requiredPoints) {
await User.findOneAndUpdate(
{ _id: userId },
{ $addToSet: { badges: badgeId } },
{ new: true }
).exec();
res.json({ success: true });
} else {
res.status(401).send('Insufficient points to collect the badge');
}
});

// Mount the router and start the server
app.use('/api', router);
app.listen(3000, () => console.log('Server running on port 3000'));
