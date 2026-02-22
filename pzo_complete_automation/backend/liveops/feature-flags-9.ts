import express from 'express';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const redisClient = createClient();
const port = process.env.PORT || 3000;

redisClient.on('error', (err) => console.log(`Error ${err}`));

app.use(express.json());

app.post('/feature-flags/:featureName', async (req, res) => {
const featureName = req.params.featureName;
const { value } = req.body;

if (!featureName || !value) {
return res.status(400).json({ error: 'Missing required parameters' });
}

await redisClient.set(`feature-flag-${featureName}`, value, (err, reply) => {
if (err) throw err;
console.log(`Added feature flag ${featureName}: ${value}`);
});

res.status(201).json({ message: 'Feature flag added successfully' });
});

app.get('/feature-flags/:featureName', async (req, res) => {
const featureName = req.params.featureName;

const value = await redisClient.get(`feature-flag-${featureName}`);

if (!value) {
return res.status(404).json({ error: 'Feature flag not found' });
}

res.json({ featureName, value });
});

app.listen(port, () => console.log(`Feature flag service listening on port ${port}`));
