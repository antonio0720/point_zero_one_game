import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

interface ServiceInstance {
id: string;
isActive: boolean;
}

let serviceInstances: ServiceInstance[] = [];

function createServiceInstance(id: string): ServiceInstance {
return { id, isActive: false };
}

app.post('/services', (req, res) => {
const { name } = req.body;

if (!name) {
return res.status(400).send('Service name is required.');
}

const newInstance = createServiceInstance(name);
serviceInstances.push(newInstance);
res.status(201).send(newInstance);
});

app.put('/services/:serviceId/activate', (req, res) => {
const { serviceId } = req.params;
const serviceIndex = serviceInstances.findIndex((instance) => instance.id === serviceId);

if (serviceIndex === -1) {
return res.status(404).send('Service not found.');
}

serviceInstances[serviceIndex].isActive = true;
res.status(200).send(`Activated service: ${serviceId}`);
});

app.put('/services/:serviceId/deactivate', (req, res) => {
const { serviceId } = req.params;
const serviceIndex = serviceInstances.findIndex((instance) => instance.id === serviceId);

if (serviceIndex === -1) {
return res.status(404).send('Service not found.');
}

serviceInstances[serviceIndex].isActive = false;
res.status(200).send(`Deactivated service: ${serviceId}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
