import * as admin from 'firebase-admin';
import * as redis from 'redis';

const firebase = !admin.apps.length ? admin.initializeApp({
databaseURL: 'your_firebase_database_url'
}) : admin.app();

const redisClient = redis.createClient({ host: 'your_redis_host', port: your_redis_port });

interface Session {
id: string;
clientId: string;
deviceId: string;
}

async function createSession(clientId: string, deviceId: string): Promise<string> {
const sessionRef = firebase.database().ref(`sessions/${clientId}`);
const sessionKey = await redisClient.get(`session:${clientId}`);

if (!sessionKey) {
const newSessionRef = await sessionRef.push();
const sessionId = newSessionRef.key;
await sessionRef.set({ deviceId });
await redisClient.set(`session:${clientId}`, sessionId);
return sessionId;
} else {
return sessionKey;
}
}

function getSession(sessionId: string): Session | null {
const sessionRef = firebase.database().ref(`sessions/${sessionId}`);
const sessionKey = redisClient.getAsync(`session:${sessionRef.parent.key}`).then((data) => data as string);

return Promise.all([sessionRef, sessionKey]).then(([session, sessionKey]) => {
if (session.val()) {
const sessionData = session.val() as Session;
sessionData.id = sessionId;
return sessionData;
}

return null;
});
}

async function transferSession(fromClientId: string, toClientId: string, sessionId: string): Promise<void> {
const fromSessionRef = firebase.database().ref(`sessions/${fromClientId}/${sessionId}`);
const toSessionRef = firebase.database().ref(`sessions/${toClientId}/${sessionId}`);

await redisClient.set(`session:${toClientId}`, sessionId);

await fromSessionRef.remove();
await toSessionRef.set(fromSessionRef.parent.child(sessionId).val());
}
