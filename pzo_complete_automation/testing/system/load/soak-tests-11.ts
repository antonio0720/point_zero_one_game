import * as express from 'express';
import * as soak from 'soak-tests';
import { Server } from 'socket.io';

const app = express();
const io = new Server(app);

// Your application logic and routes go here

soak.loadTest({
name: 'Concurrent Users',
concurrency: 100, // Number of concurrent users
duration: 60 * 5, // Test duration in seconds (e.g., 300 seconds = 5 minutes)
assertions: {
'/users': soak.assert.responseTime(200, 100), // Response time should be less than 100ms for the '/users' route
},
});

soak.stressTest({
name: 'Max Users',
users: 500, // Max number of users to simulate
assertions: {
'/': soak.assert.statusCode(200), // Ensure all requests receive a 200 status code
},
});

soak.chaosTest({
name: 'Random Latency',
interval: 1, // Time between each chaos event in seconds (e.g., 1 second)
tests: [
soak.chaos.networkLatency({ min: 50, max: 200 }), // Introduce random network latency between 50ms and 200ms
],
});

io.listen(3000);
