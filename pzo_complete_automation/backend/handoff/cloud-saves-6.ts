import * as admin from 'firebase-admin';

const serviceAccount = require('./path/to/your-service-account-file.json');

// Initialize Firebase Admin SDK with your service account credentials
admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
databaseURL: 'https://<YOUR_DATABASE_NAME>.firebaseio.com'
});

const db = admin.database();
const handoffRef = db.ref('.info/connected');

// Initialize handoff clients
const handoffClients: Map<string, any> = new Map();

function createHandoffClient(clientId: string) {
const client = db.ref(`handoff/${clientId}`);

// Save user data to the database when it changes
client.on('value', (snapshot) => {
const userData = snapshot.val();

if (userData) {
handoffClients.set(clientId, userData);
} else {
handoffClients.delete(clientId);
}
});

// Listen for new clients connecting to the database
client.on('child_connected', (snapshot) => {
if (handoffClients.has(snapshot.key)) {
const userData = handoffClients.get(snapshot.key);
snapshot.ref.set(userData);
}
});

// Handle client disconnections
client.on('child_removed', (snapshot) => {
handoffClients.delete(snapshot.key);
});

return client;
}

// Start the main loop
handoffRef.on('value', (snapshot) => {
if (snapshot.val() === true) {
// Loop through clients and create or update their data in the database
for (const [clientId, userData] of handoffClients.entries()) {
const client = createHandoffClient(clientId);
client.set(userData);
}
}
});
