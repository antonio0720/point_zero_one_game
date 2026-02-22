import express from 'express';
import { Router } from 'express';
import mongoose from 'mongoose';

const app = express();
const router = Router();

// MongoDB Connection
mongoose.connect('mongodb://localhost/leaderboard', { useNewUrlParser: true, useUnifiedTopology: true });

// User Schema & Model
const userSchema = new mongoose.Schema({
username: String,
badges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Badge' }]
});
const User = mongoose.model('User', userSchema);

// Badge Schema & Model
const badgeSchema = new mongoose.Schema({
name: String,
description: String,
points: Number
});
const Badge = mongoose.model('Badge', badgeSchema);

// Get all users
router.get('/users', async (req, res) => {
const users = await User.find().populate('badges');
res.json(users);
});

// Add a new user
router.post('/users', async (req, res) => {
const user = new User(req.body);
await user.save();
res.status(201).json(user);
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
const user = await User.findById(req.params.id).populate('badges');
if (!user) return res.status(404).send('User not found.');
res.json(user);
});

// Update user by ID
router.put('/users/:id', async (req, res) => {
const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
if (!user) return res.status(404).send('User not found.');
res.json(user);
});

// Delete user by ID
router.delete('/users/:id', async (req, res) => {
const user = await User.findByIdAndRemove(req.params.id);
if (!user) return res.status(404).send('User not found.');
res.json({ message: 'User deleted.' });
});

// Get all badges
router.get('/badges', async (req, res) => {
const badges = await Badge.find();
res.json(badges);
});

// Add a new badge
router.post('/badges', async (req, res) => {
const badge = new Badge(req.body);
await badge.save();
res.status(201).json(badge);
});

app.use('/api', router);

app.listen(3000, () => console.log('Server started on port 3000'));
