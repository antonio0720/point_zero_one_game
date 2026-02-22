import { Router } from 'express';
import User from './user';
import Item from './item';
import Leaderboard from './leaderboard';

const router = Router();

// Initialize users, items, and leaderboards
const users: User[] = [];
const items: Item[] = [];
const leaderboards: Leaderboard[] = [];

router.get('/users', (req, res) => {
res.json(users);
});

router.post('/users', (req, res) => {
const user = new User(req.body);
users.push(user);
res.status(201).json(user);
});

router.get('/items', (req, res) => {
res.json(items);
});

router.post('/items', (req, res) => {
const item = new Item(req.body);
items.push(item);
res.status(201).json(item);
});

router.get('/leaderboards', (req, res) => {
res.json(leaderboards);
});

router.post('/leaderboards', (req, res) => {
const leaderboard = new Leaderboard(req.body);
leaderboards.push(leaderboard);
res.status(201).json(leaderboard);
});

// Add custom methods for social features like following users or gifting items
router.post('/users/:id/follow', (req, res) => {
const userId = parseInt(req.params.id);
const followerId = req.body.followerId;

const userIndex = users.findIndex((user) => user.id === userId);
if (userIndex === -1) return res.status(404).send('User not found');

const followerIndex = users.findIndex((user) => user.id === followerId);
if (followerIndex === -1) return res.status(404).send('Follower not found');

users[userIndex].followers.push(users[followerIndex]);
users[followerIndex].following.push(users[userIndex]);

res.status(200).json({ success: true });
});

router.post('/items/:id/gift', (req, res) => {
const itemId = parseInt(req.params.id);
const gifterId = req.body.gifterId;
const recipientId = req.body.recipientId;

const itemIndex = items.findIndex((item) => item.id === itemId);
if (itemIndex === -1) return res.status(404).send('Item not found');

const gifterIndex = users.findIndex((user) => user.id === gifterId);
if (gifterIndex === -1) return res.status(404).send('Gifter not found');

const recipientIndex = users.findIndex((user) => user.id === recipientId);
if (recipientIndex === -1) return res.status(404).send('Recipient not found');

items[itemIndex].owner = recipientId;
users[gifterIndex].itemsGifted.push(items[itemIndex]);
users[recipientIndex].itemsOwned.push(items[itemIndex]);

res.status(200).json({ success: true });
});
