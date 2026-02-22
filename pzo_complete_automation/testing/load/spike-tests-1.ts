import * as assert from 'assert';
import { Agent, createAgent } from 'http';
import * as LoadTest from 'loadtest';

const agent = createAgent({});

function request(url: string) {
return new Promise((resolve, reject) => {
const req = new (agent as any).ClientRequest(url, 'GET', {});
let responseData = '';

req.on('error', reject);
req.on('response', res => {
res.setEncoding('utf8');
res.on('data', chunk => (responseData += chunk));
res.on('end', () => resolve(responseData));
});
});
}

const test = new LoadTest({
name: 'Spike Tests 1',
duration: 60,
iterations: 20,
warmup: 5,
concurrency: 100,
});

test.addScenario('GET /', async (context) => {
try {
for (let i = 0; i < context.concurrency; i++) {
await request(`http://localhost:3000/`);
}
} catch (err) {
assert.ifError(err);
}
});

test.run((error, stats) => {
if (error) {
console.error('Test failed:\n', error.stack);
process.exitCode = 1;
} else {
console.log('Test complete:\n', stats.toString());
process.exitCode = 0;
}
});
