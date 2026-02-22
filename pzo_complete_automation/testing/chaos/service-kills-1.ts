import * as express from 'express';
import * as axios from 'axios';
import { Random } from 'meteor/random';
import { ServiceConfig } from './config';

const app = express();
const services: Array<ServiceConfig> = [/* Add your service configurations here */];

// Simulate request load
app.get('/', (req, res) => {
const randomServiceIndex = Random.randomInt(0, services.length - 1);
const service = services[randomServiceIndex];

axios.get(`http://${service.host}:${service.port}`)
.then(() => {
res.send('Request processed');
})
.catch((error) => {
console.error(`Error while connecting to ${service.host}: ${error.message}`);
res.sendStatus(503);
});
});

// Chaos Monkey functionality: Kill a random service during load testing
const chaosInterval = 1000 * 60 * 5; // 5 minutes
let chaosActive = false;
setInterval(() => {
if (!chaosActive) {
chaosActive = true;
const randomServiceIndex = Random.randomInt(0, services.length - 1);
const service = services[randomServiceIndex];
axios.get(`http://${service.host}:${service.port}`)
.then(() => {
// Do nothing if the service is already down or not running during chaos testing
if (services[randomServiceIndex].status === 'down') return;

services[randomServiceIndex].status = 'down';
console.log(`Killing service ${service.name} (${service.host}:${service.port}) during chaos testing`);
})
.catch((error) => {
console.error(`Error while connecting to ${service.host}: ${error.message}`);
});

setTimeout(() => {
chaosActive = false;
services[randomServiceIndex].status = 'up';
console.log(`Reviving service ${service.name} (${service.host}:${service.port})`);
}, 30 * 1000); // Chaos lasts for 30 seconds
}
}, chaosInterval);

const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`Server running on port ${port}`);
});
