import express from 'express';
import { RateLimiterRedis } from 'rate-limiter-redis';
import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Set up Redis rate limiter for canary traffic
const redisClient = redis.createClient({
host: process.env.REDIS_HOST,
port: Number(process.env.REDIS_PORT),
});

const canaryRateLimiter = RateLimiterRedis(redisClient, {
points: 100, // Allow up to 100 requests per hour for canary traffic
duration: 60 * 60, // Duration is in seconds, set it to 1 hour here.
});

app.get('/canary', canaryRateLimiter, (req, res) => {
res.send('Welcome to Canary Rollouts!');
});

app.listen(port, () => {
console.log(`Canary rollouts service listening at http://localhost:${port}`);
});
