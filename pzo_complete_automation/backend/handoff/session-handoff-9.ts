import * as express from 'express';
import { Client, RedisClientOptions } from 'redis';
import { createClient } from 'redis';
import { promisify } from 'util';

const app = express();
const redisPort = 6379;
const clients: Set<Client> = new Set();

const options: RedisClientOptions = {
port: redisPort,
};

function createNewClient(): Client {
const client = createClient(options);
clients.add(client);
client.on('error', (err) => console.error(`Error on client ${client.id}: ${err}`));
return client;
}

app.use((req, res, next) => {
if (!res.headersSent) {
res.set('Connection', 'keep-alive');
}
next();
});

// Session handoff middleware for incoming requests
function sessionHandoff(req: express.Request, res: express.Response, next: express.NextFunction) {
const sessionId = req.headers['x-session-id'];
if (!sessionId) {
return next();
}

const client = clients.values().next().value;
promisify(client.get)(sessionId).then((data) => {
if (data === null) {
req.session = {};
return next();
}
req.session = JSON.parse(data);
next();
});
}

// Session handoff middleware for outgoing responses
function sessionHandoffResponse(req: express.Request, res: express.Response, next: express.NextFunction) {
if (!res.headersSent && req.session && Object.keys(req.session).length > 0) {
const client = clients.values().next().value;
promisify(client.set)(req.sessionId, JSON.stringify(req.session), (err) => {
if (err) console.error(`Error on client ${client.id}: ${err}`);
});
}
next();
}

app.use('/', sessionHandoff, express.json(), (req, res) => {
// Handle requests here
});

const newClient = createNewClient();
newClient.on('ready', () => console.log(`New client ${newClient.id} is ready`));

app.listen(3000, () => {
console.log('App is listening on port 3000');
});
