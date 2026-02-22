import express from 'express';
import { Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

interface ServiceInstance {
url: string;
weight: number;}

let serviceInstances: ServiceInstance[] = [
{ url: 'https://service-a.com', weight: 50 },
{ url: 'https://service-b.com', weight: 50 }
];

app.post('/api/traffic-split/:serviceName', async (req: Request, res: Response) => {
const serviceName = req.params.serviceName;
if (!serviceInstances.some(instance => instance.url === `https://${serviceName}.com`)) {
return res.status(404).send({ error: 'Service not found' });
}

const clientRequest = axios.create();
const decision = Math.random() * 100;
let chosenInstance: ServiceInstance | undefined;

serviceInstances.forEach((instance) => {
if (decision < instance.weight) {
chosenInstance = instance;
} else {
decision -= instance.weight;
}
});

if (!chosenInstance) {
return res.status(503).send({ error: 'No available service' });
}

try {
const result = await clientRequest.get(`${chosenInstance.url}/api/request`).catch((error) => {
console.error(error);
return { error: 'Service unavailable' };
});

res.send(result);
} catch (error) {
console.error(error);
res.status(503).send({ error: 'Service unavailable' });
}
});

app.listen(3000, () => {
console.log('Canary Rollout service is running on port 3000');
});
