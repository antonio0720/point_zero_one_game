import * as admin from 'firebase-admin';

const serviceAccount = {
/* Your Firebase project service account key JSON object */
};

admin.initializeApp({
credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();
const dbRef = admin.database().ref('handoff_data');

// Write data to Firestore and Realtime Database for new handoff session
function writeSessionData(sessionId: string, clientId: string) {
const sessionDocRef = firestore.doc(`sessions/${sessionId}`);
const sessionVal = { sessionId, clientIds: [clientId] };
sessionDocRef.set(sessionVal);

dbRef.child(sessionId).set(sessionVal);
}

// Listen for new handoff sessions and update clients' data
dbRef.on('child_added', (snapshot) => {
const sessionData = snapshot.val();
const { sessionId } = sessionData;

firestore.doc(`sessions/${sessionId}`).onSnapshot((doc) => {
const newSessionData = doc.data();
if (newSessionData.clientIds.length > 1 && !newSessionData.currentClientId) {
// Handle handoff if there's more than one client and no current client
}
});
});
