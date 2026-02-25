/**
 * Creator Economy Routes for API Gateway
 */

import express from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import jwt from 'jsonwebtoken';
import { User, Creator, Subscription, Transaction } from '../models';

const router = express.Router();
const rateLimit = new RateLimiterRedis({ points: 10, duration: 60 });

// JWT authentication middleware
function auth(req, res, next) {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).send('Access denied.');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).send('Invalid token.');
  }
}

// GET /creators - List all creators
router.get('/creators', auth, async (req, res) => {
  try {
    const creators = await Creator.findAll();
    res.json(creators);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error.');
  }
});

// GET /creators/:id - Get a creator by ID
router.get('/creators/:id', auth, async (req, res) => {
  try {
    const creator = await Creator.findByPk(req.params.id);
    if (!creator) return res.status(404).send('Creator not found.');
    res.json(creator);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error.');
  }
});

// POST /subscriptions - Create a new subscription
router.post('/subscriptions', rateLimit, auth, async (req, res) => {
  try {
    const { creatorId, userId } = req.body;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).send('User not found.');

    const subscription = await Subscription.create({ creatorId });
    await user.addSubscription(subscription);
    await subscription.save();

    res.json(subscription);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error.');
  }
});

// POST /transactions - Create a new transaction
router.post('/transactions', rateLimit, auth, async (req, res) => {
  try {
    const { creatorId, userId, amount } = req.body;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).send('User not found.');

    const transaction = await Transaction.create({ creatorId, userId, amount });
    await user.addTransaction(transaction);
    await transaction.save();

    res.json(transaction);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error.');
  }
});

export default router;

SQL:

-- Creator table
CREATE TABLE IF NOT EXISTS creators (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  imageUrl VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Subscription table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  creatorId INT NOT NULL,
  userId INT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creatorId) REFERENCES creators(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

-- Transaction table
CREATE TABLE IF NOT EXISTS transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  creatorId INT NOT NULL,
  userId INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creatorId) REFERENCES creators(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

Bash:

#!/bin/sh
set -euo pipefail
echo "Starting script"
# Your commands here
echo "Script finished"

Terraform (assuming you are using AWS):

provider "aws" {
  region = "us-west-2"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

# ... other resources omitted for brevity
