import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { Router } from 'express';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

// Define routes for Canary management
const canaryRoutes = Router();

interface Canary {
id: number;
serviceName: string;
currentVersion: string;
}

let canaries: Canary[] = [];

canaryRoutes.get('/', (req, res) => {
res.json(canaries);
});

canaryRoutes.post('/', async (req, res) => {
const newCanary: Canary = req.body;

canaries.push(newCanary);
res.status(201).json(newCanary);
});

canaryRoutes.put('/:id', async (req, res) => {
const id = parseInt(req.params.id);
const updatedCanaryIndex = canaries.findIndex((canary) => canary.id === id);

if (updatedCanaryIndex !== -1) {
canaries[updatedCanaryIndex] = req.body;
res.json(canaries[updatedCanaryIndex]);
} else {
res.status(404).send('Canary not found');
}
});

canaryRoutes.delete('/:id', async (req, res) => {
const id = parseInt(req.params.id);
const canaryIndex = canaries.findIndex((canary) => canary.id === id);

if (canaryIndex !== -1) {
canaries.splice(canaryIndex, 1);
res.status(204).send();
} else {
res.status(404).send('Canary not found');
}
});

// Attach Canary routes to the main app
app.use('/api/canaries', canaryRoutes);

// Define routes for Feature Toggle (API calls to services)
const featureToggleRoutes = Router();

featureToggleRoutes.get('/:serviceName/:featureName', async (req, res) => {
const { serviceName, featureName } = req.params;
const canary = canaries.find((canary) => canary.serviceName === serviceName);

if (canary) {
try {
const response = await axios.get(`http://${canary.currentVersion}/api/toggle/${featureName}`);
res.json(response.data);
} catch (error) {
res.status(503).send('Service unavailable');
}
} else {
res.status(404).send('Canary not found');
}
});

// Attach Feature Toggle routes to the main app
app.use('/api/toggle', featureToggleRoutes);

app.listen(port, () => {
console.log(`Server is running on port ${port}`);
});
