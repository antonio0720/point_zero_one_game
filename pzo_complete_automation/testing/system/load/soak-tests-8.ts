import * as stress from 'stress-test';
import { PerformanceObserver } from 'perf_hooks';
import { createServer, Server } from 'http';

const PORT = 3000;
const server: Server = createServer((req, res) => {
res.statusCode = 200;
res.setHeader('Content-Type', 'text/plain');
res.end('Hello, World!');
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

const PO = new PerformanceObserver((list) => {
list.getEntries().forEach((entry) => {
console.log(`${entry.name}: ${entry.duration}ms`);
});
});
PO.observe({ entryTypes: ['measure'] });

stress.on('start', () => console.log('Starting stress test'));
stress.on('end', () => {
PO.disconnect();
server.close(() => console.log('Stress test has ended'));
});

stress(async function () {
for (let i = 0; i < 1000; i++) {
const response = await new Promise((resolve) => {
const req = require('http').request(`http://localhost:${PORT}`, (res) => resolve(res));
req.on('error', () => process.exit(1));
req.end();
});

response.on('data', (chunk) => {});
}
});
