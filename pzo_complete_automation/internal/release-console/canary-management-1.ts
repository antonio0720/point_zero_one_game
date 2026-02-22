import express from 'express';
import bodyParser from 'body-parser';
import { canaryDeploy, rollbackCanary } from './canary-deployment';

const app = express();
app.use(bodyParser.json());

// Deploy a new canary release
app.post('/deploy', async (req, res) => {
try {
const deploymentResult = await canaryDeploy(req.body);
res.status(200).send(deploymentResult);
} catch (error) {
console.error(error);
res.status(500).send({ error: 'Failed to deploy canary release' });
}
});

// Promote the canary release to production if successful
app.post('/promote', async (req, res) => {
try {
await promoteCanary(req.body);
res.status(200).send({ message: 'Successfully promoted canary release' });
} catch (error) {
console.error(error);
res.status(500).send({ error: 'Failed to promote canary release' });
}
});

// Rollback the current production release to the previous canary release
app.post('/rollback', async (req, res) => {
try {
await rollbackCanary();
res.status(200).send({ message: 'Successfully rolled back release' });
} catch (error) {
console.error(error);
res.status(500).send({ error: 'Failed to rollback release' });
}
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`Server is running on port ${PORT}`);
});
