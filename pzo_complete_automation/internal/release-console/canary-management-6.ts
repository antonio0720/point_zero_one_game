import express from 'express';
import bodyParser from 'body-parser';
import { Router } from 'express';
import { CanaryDeploymentService } from './canary-deployment.service';

const app = express();
app.use(bodyParser.json());

const router = Router();
const canaryDeploymentService = new CanaryDeploymentService();

router.post('/deploy', async (req, res) => {
try {
const deploymentId = await canaryDeploymentService.deploy(req.body);
res.status(201).json({ id: deploymentId });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

router.delete('/rollback/:id', async (req, res) => {
try {
await canaryDeploymentService.rollback(req.params.id);
res.sendStatus(204);
} catch (error) {
res.status(500).json({ error: error.message });
}
});

app.use('/api', router);

export default app;
