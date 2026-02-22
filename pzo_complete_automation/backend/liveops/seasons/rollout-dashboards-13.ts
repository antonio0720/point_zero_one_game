import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { RolloutDashboardsService } from './services/rollout-dashboards-service';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const rolloutDashboardsService = new RolloutDashboardsService();

// Example route to get a list of rollouts
app.get('/rollouts', async (req, res) => {
try {
const rollouts = await rolloutDashboardsService.getRollouts();
res.status(200).json(rollouts);
} catch (error) {
console.error(error);
res.status(500).send('Error fetching rollouts');
}
});

// Example route to start or update a rollout
app.put('/rollouts/:id', async (req, res) => {
try {
const id = req.params.id;
const updatedRollout = await rolloutDashboardsService.updateRollout(id, req.body);
res.status(200).json(updatedRollout);
} catch (error) {
console.error(error);
res.status(500).send('Error updating rollout');
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
