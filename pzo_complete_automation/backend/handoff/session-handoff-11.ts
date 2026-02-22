import express from 'express';
import { Client, Message, Session, Handoff } from 'js-session-manager';

const app = express();
const sessionManager = new Session('mySessionManager');
const clientIdPrefix = 'client_';

app.use(sessionManager.sessionMiddleware({
secret: 'mySecret',
resave: false,
saveUninitialized: true,
cookie: { maxAge: 60000 },
}));

app.get('/handoff/:clientId', (req, res) => {
const clientId = req.params.clientId;
const handoffSessionId = req.sessionID;

sessionManager.getSession(handoffSessionId).then((session: Session) => {
const handoffData: Handoff = {
data: JSON.stringify({ key1: 'value1', key2: 'value2' }), // replace with actual data to be handed off
};

sessionManager.handoff(handoffSessionId, clientId, handoffData).then(() => {
res.json({ success: true });
}).catch((err) => {
console.error(err);
res.status(500).json({ success: false });
});
});
});

app.get('/sync/:clientId', (req, res) => {
const clientId = req.params.clientId;
const client = sessionManager.createClient(`${clientIdPrefix}${clientId}`);

client.on('message', (msg: Message) => {
const handoffData: Handoff = JSON.parse(msg.data);

// Handle received handoff data here
console.log('Received handoff data:', handoffData.data);
});

client.connect().then(() => {
sessionManager.getClientSessions(`${clientIdPrefix}${clientId}`).then((sessions) => {
sessions.forEach((session: Session) => {
if (session.handoffData) {
console.log('Found handoff data in session', session);
client.send(session.handoffData);
sessionManager.removeHandoffData(session.id); // remove the handoff data from the session after sending it to the client
}
});
});
});
});

app.listen(3000, () => {
console.log('Server started on port 3000');
});
