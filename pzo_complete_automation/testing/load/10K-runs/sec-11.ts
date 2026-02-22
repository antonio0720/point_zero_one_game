import * as express from 'express';
import * as cmo from 'chaos-monkey-orchestrator';
import { randomInRange } from './utils';

const app = express();
const port = 3000;
const chaosMonkey = new cmo({
minResources: 10,
maxResources: 20,
failurePercentage: 0.2,
});

chaosMonkey.on('fail', (resourceName) => {
console.log(`Resource ${resourceName} is failing`);
});

app.get('/', (req, res) => {
res.send('Hello World!');
});

app.listen(port, () => {
console.log(`Server listening at http://localhost:${port}`);
chaosMonkey.start();
});

function randomInRange(min: number, max: number): number {
return Math.floor(Math.random() * (max - min + 1) ) + min;
}
