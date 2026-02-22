import express from 'express';
import bodyParser from 'body-parser';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const app = express();
app.use(bodyParser.json());

interface RolloutStatus {
trafficPercentage: number;
revisionName: string;
}

function getRolloutStatus(): Promise<RolloutStatus> {
// Read the deployment configuration file and execute kubectl command to get rollout status
const deploymentFileContent = readFileSync('deployment.yaml', 'utf8');
const rolloutStatusCmd = `kubectl rollout status deployment/api-service -o jsonpath='{.status.updatedReplicas, .spec.template.metadata.annotations."deployment\.kubernetes\.io/revision"}'`;
const [trafficPercentage, revisionName] = execSync(rolloutStatusCmd)
.toString()
.trim()
.split(/\s+/)
.map((v) => parseInt(v));

return Promise.resolve({ trafficPercentage, revisionName });
}

app.post('/canary', async (req, res) => {
const { trafficPercentage } = await getRolloutStatus();
const desiredTrafficPercentage = req.body.trafficPercentage || 10; // Default to 10% if not provided

if (trafficPercentage < desiredTrafficPercentage) {
console.log(`Scaling up deployment revision ${req.body.revisionName} to ${desiredTrafficPercentage}%`);
execSync(`kubectl set traffic-policy deployment/api-service --traffic-percent=${desiredTrafficPercentage}`);
} else {
console.log('No action required, current traffic percentage is greater than or equal to the desired value');
}

res.status(200).send();
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`Deck Reactor - Canary Rollouts listening on port ${port}`);
});
