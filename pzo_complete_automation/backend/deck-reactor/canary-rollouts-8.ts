import express from 'express';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import { Client as RedisClient } from 'redis';

const app = express();
app.use(bodyParser.json());

const redisClient = new RedisClient({ host: 'localhost', port: 6379 });

interface FeatureToggle {
name: string;
version: number;
}

interface TrafficSplit {
totalUsers: number;
traffic: Record<number, number>;
}

const featureToggles: FeatureToggle[] = [
// List of features and their versions here
];

const trafficSplits: TrafficSplit[] = [
// List of traffic splits for each feature version here
];

function getVersionForUser(userId: string): number | null {
for (let i = 0; i < featureToggles.length; i++) {
const split = trafficSplits[i];
if (split.traffic[userId] > Math.random()) return i;
}
return null;
}

app.post('/api/user/:userId', async (req, res) => {
const userId = req.params.userId;
const version = getVersionForUser(userId);

if (!version) {
return res.status(404).send({ message: 'Not found' });
}

await redisClient.hset('feature_toggles', featureToggles[version].name, userId);

res.status(200).send({ userId, version });
});

app.listen(3000, () => console.log('Server running on port 3000'));
